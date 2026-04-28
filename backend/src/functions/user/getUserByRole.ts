import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireRole } from "../../utils/auth";
import type { UserRole } from "../../types/user";

export const getUsersByRole = async (
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

    const role =
      event.queryStringParameters?.role ||
      event.pathParameters?.role;

    if (!role) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "role is required.",
        }),
      };
    }

    const sortOrder =
      event.queryStringParameters?.sortOrder === "asc" ? "asc" : "desc";

    const service = new DynamoDBService(docClient, tableName, "");
    const users = await service.getUsers({ role: role as UserRole, sortOrder });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Users found.",
        data: users,
      }),
    };
  } catch (error) {
    console.error("Error fetching users by role:", error);
    return handleError(error);
  }
};