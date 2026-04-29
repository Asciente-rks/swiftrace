import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireRole } from "../../utils/auth";
import { getTableName } from "../../utils/env";
import { toPublicUser } from "../../utils/user";
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
    const tableName = getTableName();

    const role = event.queryStringParameters?.role as UserRole | undefined;

    const sortOrder =
      event.queryStringParameters?.sortOrder === "asc" ? "asc" : "desc";

    const service = new DynamoDBService(docClient, tableName, tableName);
    const users = await service.getUsers({ role, sortOrder });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Users found.",
        data: users.map((user) => toPublicUser(user)),
      }),
    };
  } catch (error) {
    console.error("Error fetching users by role:", error);
    return handleError(error);
  }
};