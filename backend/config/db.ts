import AWS from "aws-sdk";
import config from "../config/config";

const isLambda = typeof process.env.AWS_LAMBDA_FUNCTION_NAME === "string";

const { accessKeyId, secretAccessKey, region } = config.aws_production;
const dynamoConfig: AWS.DynamoDB.DocumentClient.DocumentClientOptions & {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
} = {
  region:
    region ??
    process.env.AWS_REGION ??
    process.env.aws_region ??
    "ap-southeast-1",
};

if (
  !isLambda &&
  accessKeyId != null &&
  secretAccessKey != null
) {
  dynamoConfig.accessKeyId = accessKeyId;
  dynamoConfig.secretAccessKey = secretAccessKey;
}

export const docClient = new AWS.DynamoDB.DocumentClient(dynamoConfig);
