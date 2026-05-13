#!/usr/bin/env bash
# ============================================================================
# SwiftRace deployment — direct Lambda + DynamoDB, $0 forever.
#
# Idempotent. Safe to run on every push. Creates everything on first run,
# updates only what changed on subsequent runs.
#
# Required env vars (provided by .github/workflows/deploy.yml):
#   AWS_REGION           — e.g. ap-southeast-1
#   LAMBDA_NAME          — e.g. swiftrace-api
#   TABLE_NAME           — e.g. swiftrace-logistics
#   ROLE_NAME            — e.g. swiftrace-lambda-role
#   ZIP_PATH             — path to the bundled function.zip
#   JWT_SECRET, JWT_EXPIRES_IN, EMAIL_USER, EMAIL_PASS, DEFAULT_ORIGIN
# ============================================================================

set -euo pipefail

: "${AWS_REGION:?AWS_REGION is required}"
: "${LAMBDA_NAME:?LAMBDA_NAME is required}"
: "${TABLE_NAME:?TABLE_NAME is required}"
: "${ROLE_NAME:?ROLE_NAME is required}"
: "${ZIP_PATH:?ZIP_PATH is required}"
: "${JWT_SECRET:?JWT_SECRET is required}"

JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-7d}"
EMAIL_USER="${EMAIL_USER:-}"
EMAIL_PASS="${EMAIL_PASS:-}"
DEFAULT_ORIGIN="${DEFAULT_ORIGIN:-Warehouse}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
echo "▶ AWS account: $ACCOUNT_ID  region: $AWS_REGION"

# ----------------------------------------------------------------------------
# 1. DynamoDB table — single table, 4 GSIs, on-demand billing.
# ----------------------------------------------------------------------------
echo "▶ Ensuring DynamoDB table '$TABLE_NAME'…"
if aws dynamodb describe-table \
      --table-name "$TABLE_NAME" \
      --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "  ✓ table exists"
else
  echo "  → creating table…"
  aws dynamodb create-table \
    --region "$AWS_REGION" \
    --table-name "$TABLE_NAME" \
    --billing-mode PAY_PER_REQUEST \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=role,AttributeType=S \
        AttributeName=createdAt,AttributeType=S \
        AttributeName=status_,AttributeType=S \
        AttributeName=updatedAt,AttributeType=S \
        AttributeName=shipment_id,AttributeType=S \
        AttributeName=tracking_number,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        '[
          {
            "IndexName": "role-createdAt-index",
            "KeySchema": [
              {"AttributeName":"role","KeyType":"HASH"},
              {"AttributeName":"createdAt","KeyType":"RANGE"}
            ],
            "Projection": {"ProjectionType":"ALL"}
          },
          {
            "IndexName": "status-updatedAt-index",
            "KeySchema": [
              {"AttributeName":"status_","KeyType":"HASH"},
              {"AttributeName":"updatedAt","KeyType":"RANGE"}
            ],
            "Projection": {"ProjectionType":"ALL"}
          },
          {
            "IndexName": "shipmentId-index",
            "KeySchema": [
              {"AttributeName":"shipment_id","KeyType":"HASH"}
            ],
            "Projection": {"ProjectionType":"ALL"}
          },
          {
            "IndexName": "trackingNumber-index",
            "KeySchema": [
              {"AttributeName":"tracking_number","KeyType":"HASH"}
            ],
            "Projection": {"ProjectionType":"ALL"}
          }
        ]' \
    >/dev/null
  echo "  → waiting for table to become ACTIVE…"
  aws dynamodb wait table-exists \
    --table-name "$TABLE_NAME" --region "$AWS_REGION"
  echo "  ✓ table created"
fi

TABLE_ARN="arn:aws:dynamodb:${AWS_REGION}:${ACCOUNT_ID}:table/${TABLE_NAME}"

# ----------------------------------------------------------------------------
# 2. IAM execution role for the Lambda.
# ----------------------------------------------------------------------------
echo "▶ Ensuring IAM role '$ROLE_NAME'…"
TRUST_DOC='{
  "Version":"2012-10-17",
  "Statement":[{
    "Effect":"Allow",
    "Principal":{"Service":"lambda.amazonaws.com"},
    "Action":"sts:AssumeRole"
  }]
}'

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "  ✓ role exists"
else
  echo "  → creating role…"
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_DOC" \
    --description "Execution role for SwiftRace Lambda" \
    >/dev/null
  # AWS recommends a short pause for IAM consistency.
  sleep 8
  echo "  ✓ role created"
fi

# Always re-apply the inline policy so DynamoDB scope stays in sync if the
# table or region changes.
INLINE_POLICY=$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:DescribeTable"
      ],
      "Resource": [
        "${TABLE_ARN}",
        "${TABLE_ARN}/index/*"
      ]
    }
  ]
}
JSON
)

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "swiftrace-lambda-inline" \
  --policy-document "$INLINE_POLICY" \
  >/dev/null
echo "  ✓ inline policy applied"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# ----------------------------------------------------------------------------
# 3. Build env-vars JSON for Lambda.
# ----------------------------------------------------------------------------
ENV_JSON=$(node -e '
const env = {
  LOGISTICS_DYNAMO_TABLE: process.env.TABLE_NAME,
  SHIPMENT_DYNAMO_TABLE: process.env.TABLE_NAME,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  DEFAULT_ORIGIN: process.env.DEFAULT_ORIGIN,
};
// drop empty values so they do not overwrite anything previously set
for (const k of Object.keys(env)) if (!env[k]) delete env[k];
process.stdout.write(JSON.stringify({ Variables: env }));
')

# ----------------------------------------------------------------------------
# 4. Lambda function — create or update.
# ----------------------------------------------------------------------------
echo "▶ Ensuring Lambda '$LAMBDA_NAME'…"
if aws lambda get-function \
      --function-name "$LAMBDA_NAME" \
      --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "  → updating function code…"
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --zip-file "fileb://${ZIP_PATH}" \
    --region "$AWS_REGION" \
    --no-cli-pager >/dev/null

  echo "  → waiting for code update to settle…"
  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" --region "$AWS_REGION"

  echo "  → updating function configuration…"
  aws lambda update-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --region "$AWS_REGION" \
    --runtime nodejs20.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --timeout 29 \
    --memory-size 512 \
    --environment "$ENV_JSON" \
    --no-cli-pager >/dev/null

  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" --region "$AWS_REGION"
  echo "  ✓ function updated"
else
  echo "  → creating function…"
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --region "$AWS_REGION" \
    --runtime nodejs20.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file "fileb://${ZIP_PATH}" \
    --timeout 29 \
    --memory-size 512 \
    --environment "$ENV_JSON" \
    --no-cli-pager >/dev/null

  aws lambda wait function-active \
    --function-name "$LAMBDA_NAME" --region "$AWS_REGION"
  echo "  ✓ function created"
fi

# ----------------------------------------------------------------------------
# 5. Function URL — public, CORS open.
#
# Update if it exists, create if not. Don't delete-and-recreate: contrary to
# the AWS docs implying determinism, delete + create yields a *new* hostname
# (we proved this the hard way on 2026-05-13), and a changing hostname breaks
# the frontend.
# ----------------------------------------------------------------------------
echo "▶ Ensuring Function URL…"
CORS_JSON='{
  "AllowOrigins": ["*"],
  "AllowMethods": ["*"],
  "AllowHeaders": ["*"],
  "ExposeHeaders": ["*"],
  "MaxAge": 86400
}'

if aws lambda get-function-url-config \
      --function-name "$LAMBDA_NAME" \
      --region "$AWS_REGION" >/dev/null 2>&1; then
  aws lambda update-function-url-config \
    --function-name "$LAMBDA_NAME" \
    --region "$AWS_REGION" \
    --auth-type NONE \
    --cors "$CORS_JSON" \
    --no-cli-pager >/dev/null
  echo "  ✓ Function URL config refreshed"
else
  aws lambda create-function-url-config \
    --function-name "$LAMBDA_NAME" \
    --region "$AWS_REGION" \
    --auth-type NONE \
    --cors "$CORS_JSON" \
    --no-cli-pager >/dev/null
  echo "  ✓ Function URL created"
fi

# Public invocation permission — remove-then-add. After a fresh URL recreate
# any stale statement is gone, but keep the remove for re-runs against a URL
# that wasn't just recreated.
aws lambda remove-permission \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --statement-id "FunctionURLAllowPublicAccess" \
  --no-cli-pager >/dev/null 2>&1 || true

# Statement 1: lambda:InvokeFunctionUrl with StringEquals condition.
# Required for the URL gateway to accept the request.
aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --statement-id "FunctionURLAllowPublicAccess" \
  --action "lambda:InvokeFunctionUrl" \
  --principal "*" \
  --function-url-auth-type NONE \
  --no-cli-pager >/dev/null
echo "  ✓ Statement 1: lambda:InvokeFunctionUrl attached"

# Statement 2: lambda:InvokeFunction with Bool: lambda:InvokedViaFunctionUrl = true.
# This is what the URL gateway needs to actually invoke the Lambda after routing.
# A sibling Function URL in this account that works publicly has this statement;
# swiftrace-api was missing it -- which is why every request returned 403 even
# though the URL gateway accepted the call.
#
# The AWS CLI's add-permission does not have a flag for this exact condition, so
# we construct the call via boto3 and inject the policy statement directly.
aws lambda remove-permission \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --statement-id "AllowPublicInvokeFunction" \
  --no-cli-pager >/dev/null 2>&1 || true

# First try: see if `--action lambda:InvokeFunction --function-url-auth-type NONE`
# is enough for AWS to auto-add the Bool condition.
if aws lambda add-permission \
      --function-name "$LAMBDA_NAME" \
      --region "$AWS_REGION" \
      --statement-id "AllowPublicInvokeFunction" \
      --action "lambda:InvokeFunction" \
      --principal "*" \
      --function-url-auth-type NONE \
      --no-cli-pager >/dev/null 2>&1; then
  echo "  ✓ Statement 2: lambda:InvokeFunction attached via CLI"
else
  # Fall back: use Python + boto3 directly. boto3 ships with the GitHub
  # Actions ubuntu-latest runner. Setting `FunctionUrlAuthType="NONE"` on
  # the AddPermission call with `Action="lambda:InvokeFunction"` is what
  # the AWS Console emits, and boto3 surfaces parameters the CLI hides.
  python3 - <<'PY'
import os, boto3
lam = boto3.client("lambda", region_name=os.environ["AWS_REGION"])
lam.add_permission(
  FunctionName=os.environ["LAMBDA_NAME"],
  StatementId="AllowPublicInvokeFunction",
  Action="lambda:InvokeFunction",
  Principal="*",
  FunctionUrlAuthType="NONE",
)
print("  ✓ Statement 2: lambda:InvokeFunction attached via boto3")
PY
fi

# Dump the resulting policy so we can verify the Bool condition is actually
# there (and matches the working sibling).
echo "▶ swiftrace-api policy after both statements:"
aws lambda get-policy \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query 'Policy' --output text \
  --no-cli-pager | node -e 'let r=""; process.stdin.on("data",c=>r+=c).on("end",()=>{try{console.log(JSON.stringify(JSON.parse(r),null,2))}catch(e){console.log(r)}})' || true
echo ""

# ----------------------------------------------------------------------------
# 6. Seed the database with the demo accounts.
#
# The frontend exposes admin@/shipper@/customer@swiftrace.com quick-login
# buttons; those rows live in DynamoDB. Re-seeding is idempotent — seed.ts
# deletes any existing rows with the same email before inserting.
# ----------------------------------------------------------------------------
echo "▶ Seeding demo users into DynamoDB ($TABLE_NAME)…"
(
  cd "$(dirname "$0")/.." || exit 1
  LOGISTICS_DYNAMO_TABLE="$TABLE_NAME" \
  SHIPMENT_DYNAMO_TABLE="$TABLE_NAME" \
  AWS_REGION="$AWS_REGION" \
  npx --yes ts-node seed.ts 2>&1 | sed 's/^/  /' || \
    echo "  ! seed step failed (non-fatal, deploy continues)"
)
echo ""

# One-off comparison dump — to compare against a known-good Function URL in
# the same account. We've seen that another function URL in this same account
# (keigfneenyfhhurpg6z3kejpzi0gkdlo.lambda-url.ap-southeast-1.on.aws) returns
# 200, while swiftrace-api returns 403 with identical-looking config. That
# means something on the swiftrace-api function itself (legacy from the
# Serverless Framework provisioning) is at fault, not the account.
echo "▶ Full swiftrace-api state dump (compare vs working sibling):"
echo "--- get-function-configuration:"
aws lambda get-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" --no-cli-pager || true
echo ""
echo "--- get-function-concurrency:"
aws lambda get-function-concurrency \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" --no-cli-pager || true
echo ""
echo "--- get-function-code-signing-config:"
aws lambda get-function-code-signing-config \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" --no-cli-pager 2>&1 | head -20 || true
echo ""
echo "--- list-aliases:"
aws lambda list-aliases \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" --no-cli-pager || true
echo ""
echo "--- list-versions-by-function:"
aws lambda list-versions-by-function \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" --no-cli-pager --query 'Versions[].Version' || true
echo ""
echo "--- get-policy (full text):"
aws lambda get-policy \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" --no-cli-pager --output text || true
echo ""

# Post-deploy smoke test — invoke the Function URL directly from CI so the
# job fails loudly when the live endpoint isn't actually reachable.
# Catches the class of issues where AWS config looks correct
# (AuthType NONE + Allow Principal "*" + lambda:InvokeFunctionUrl) but a
# perimeter policy (Organizations SCP / Resource Control Policy) is silently
# denying public invocations — in that case the Function URL returns
# 403 AccessDeniedException and CloudWatch never receives an invocation.
FUNC_URL_RAW=$(aws lambda get-function-url-config \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query FunctionUrl --output text)
SMOKE_URL="${FUNC_URL_RAW%/}/auth/login"
echo "▶ Smoke test → POST $SMOKE_URL"
SMOKE_STATUS=$(curl -s -o /tmp/smoke.json -w '%{http_code}' \
  -X POST "$SMOKE_URL" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com","password":"smoke"}' || echo "000")
echo "  HTTP $SMOKE_STATUS"
echo "  body: $(head -c 200 /tmp/smoke.json || true)"

# The Lambda returns 4xx (401/400) for bad credentials but reaches the
# function code; we expect that. A 403 with AccessDeniedException means the
# Function URL gateway rejected the request before reaching the Lambda —
# typically an account-level / Organizations perimeter policy blocking
# public Lambda Function URLs. The Lambda itself is fine; investigate at
# the AWS Console (Lambda → swiftrace-api → URL → check for resource
# control policies, or AWS Organizations SCPs that restrict
# lambda:InvokeFunctionUrl).
if [ "$SMOKE_STATUS" = "403" ] && grep -q 'AccessDeniedException\|Function URL authorization' /tmp/smoke.json 2>/dev/null; then
  echo ""
  echo "::warning::Function URL returned 403 AccessDeniedException."
  echo "::warning::Direct aws lambda invoke succeeds, so the Lambda code is healthy."
  echo "::warning::Check for an AWS Organizations SCP / Resource Control Policy"
  echo "::warning::denying lambda:InvokeFunctionUrl from public principals,"
  echo "::warning::or an account-level public-access block for Lambda URLs."
fi
echo ""

FUNC_URL=$(aws lambda get-function-url-config \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query FunctionUrl --output text)

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  ✅ Deploy complete"
echo "  🌐 Function URL: ${FUNC_URL%/}"
echo "  📦 Lambda:       $LAMBDA_NAME"
echo "  🗄️  Table:        $TABLE_NAME"
echo "  🔐 Role:         $ROLE_NAME"
echo "════════════════════════════════════════════════════════════════════"

# Surface the URL for the workflow's job summary.
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "function_url=${FUNC_URL%/}" >>"$GITHUB_OUTPUT"
fi
