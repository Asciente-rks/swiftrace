import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireRole } from "../../utils/auth";

export const deleteUser = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // JWT authentication and admin check
    let jwtUser;
    try {
      jwtUser = requireAuth(event);
      requireRole(jwtUser, "admin");
    } catch (err: any) {
      return {
        statusCode: err.statusCode || 401,
        headers,
        body: JSON.stringify({ status: err.statusCode || 401, message: err.message }),
      };
    }
    const tableName = process.env.SHIPMENT_DYNAMO_TABLE;

    if (!tableName) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          status: 500,
          message: "SHIPMENT_DYNAMO_TABLE environment variable is not set.",
        }),
      };
    }

    // Get user_id from path or query
    const user_id =
      event.pathParameters?.user_id ||
      event.queryStringParameters?.user_id;

    if (!user_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "user_id is required.",
        }),
      };
    }

    const service = new DynamoDBService(docClient, tableName, "");
    const deleted = await service.deleteUser(user_id);

    if (!deleted) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          status: 404,
          message: "User not found.",
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "User deleted successfully",
      }),
    };
  } catch (error) {
    console.error("Error deleting user:", error);
    return handleError(error);
  }
};