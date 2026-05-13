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

# Public invocation permission — remove-then-add so we always end on a known-good
# resource policy. The previous "ignore conflict" pattern silently masked the case
# where the policy was missing entirely (e.g. statement-id removed manually), which
# manifested at runtime as a 403 AccessDeniedException from the Function URL.
aws lambda remove-permission \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --statement-id "FunctionURLAllowPublicAccess" \
  --no-cli-pager >/dev/null 2>&1 || true

aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --statement-id "FunctionURLAllowPublicAccess" \
  --action "lambda:InvokeFunctionUrl" \
  --principal "*" \
  --function-url-auth-type NONE \
  --no-cli-pager >/dev/null
echo "  ✓ Function URL public-invoke permission attached"

# Diagnostics — surface the actual on-the-wire state so future deploys don't
# have to guess. If `AuthType` isn't NONE or the policy doesn't list the
# expected statement, the runtime 403 we just hunted down will be obvious in
# the next job log.
LAMBDA_ARN="arn:aws:lambda:${AWS_REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}"

echo "▶ Function URL diagnostics:"
aws lambda get-function-url-config \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --no-cli-pager || true
echo ""
echo "▶ Resource policy (add-permission statements):"
aws lambda get-policy \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --no-cli-pager || true
echo ""

echo "▶ Available AWS CLI version:"
aws --version || true
echo ""

# Direct Lambda invoke (bypasses the Function URL gateway entirely). If this
# succeeds we know the Lambda code itself is healthy, and the 403 we keep
# seeing is being injected by the URL-fronting infrastructure (likely an
# Organizations SCP / Resource Control Policy blocking public invocation).
echo "▶ Direct Lambda invoke (no Function URL):"
DIRECT_PAYLOAD='{
  "version":"2.0",
  "routeKey":"POST /auth/login",
  "rawPath":"/auth/login",
  "rawQueryString":"",
  "headers":{"content-type":"application/json"},
  "requestContext":{
    "http":{"method":"POST","path":"/auth/login","protocol":"HTTP/1.1","sourceIp":"127.0.0.1","userAgent":"deploy-smoke"}
  },
  "body":"{\"email\":\"smoke@example.com\",\"password\":\"smoke\"}",
  "isBase64Encoded":false
}'
DIRECT_STATUS=$(aws lambda invoke \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --cli-binary-format raw-in-base64-out \
  --payload "$DIRECT_PAYLOAD" \
  --no-cli-pager \
  /tmp/direct.json 2>&1 | tr -d '\n' || echo "INVOKE_FAILED")
echo "  invoke result: $DIRECT_STATUS"
echo "  body: $(head -c 500 /tmp/direct.json || true)"
echo ""

# Quick end-to-end smoke test directly against the Function URL — invoke once
# from inside the deploy job so we know the deploy actually produces something
# the browser can reach. The Function URL is captured below; reuse it here.
FUNC_URL_RAW=$(aws lambda get-function-url-config \
  --function-name "$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --query FunctionUrl --output text)
SMOKE_URL="${FUNC_URL_RAW%/}/auth/login"
echo "▶ Public smoke test → POST $SMOKE_URL"
SMOKE_STATUS=$(curl -s -o /tmp/smoke.json -w '%{http_code}' \
  -X POST "$SMOKE_URL" \
  -H 'Content-Type: application/json' \
  -d '{"email":"smoke@example.com","password":"smoke"}' || echo "000")
echo "  HTTP $SMOKE_STATUS"
echo "  body: $(head -c 500 /tmp/smoke.json || true)"
echo ""

# CloudWatch log group existence check — if no log group, the Lambda has
# never actually been invoked successfully (errors at the URL gateway never
# reach the function).
echo "▶ CloudWatch log group:"
aws logs describe-log-groups \
  --log-group-name-prefix "/aws/lambda/$LAMBDA_NAME" \
  --region "$AWS_REGION" \
  --no-cli-pager 2>&1 | head -30 || true
echo ""

echo "▶ Most recent Lambda log events (if any):"
LOG_STREAM=$(aws logs describe-log-streams \
  --log-group-name "/aws/lambda/$LAMBDA_NAME" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --region "$AWS_REGION" \
  --query 'logStreams[0].logStreamName' \
  --output text 2>/dev/null || echo "")
if [ -n "$LOG_STREAM" ] && [ "$LOG_STREAM" != "None" ]; then
  echo "  stream: $LOG_STREAM"
  aws logs get-log-events \
    --log-group-name "/aws/lambda/$LAMBDA_NAME" \
    --log-stream-name "$LOG_STREAM" \
    --limit 20 \
    --region "$AWS_REGION" \
    --query 'events[*].message' \
    --output text 2>&1 | head -40 || true
else
  echo "  (no log streams — Lambda has never been invoked via URL)"
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
