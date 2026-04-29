import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { getTableName } from "../../utils/env";
import { verifyPassword } from "../../utils/password";
import { signJwt } from "../../utils/jwt";
import { toPublicUser } from "../../utils/user";

export const loginUser = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const body = parse(event.body) as Record<string, unknown>;
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!email || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "email and password are required.",
        }),
      };
    }

    const tableName = getTableName();
    const service = new DynamoDBService(docClient, tableName, tableName);
    const user = await service.getUserByEmail(email);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ status: 401, message: "Invalid credentials." }),
      };
    }

    const token = signJwt({ user_id: user.user_id, role: user.role, email: user.email });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Login successful",
        data: {
          token,
          user: toPublicUser(user),
        },
      }),
    };
  } catch (error) {
    console.error("Error logging in:", error);
    return handleError(error);
  }
};
