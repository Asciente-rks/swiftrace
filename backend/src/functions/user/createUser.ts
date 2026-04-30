import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { createUserSchema } from "../../validation/user-validation";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireRole } from "../../utils/auth";
import { getTableName } from "../../utils/env";
import { toPublicUser } from "../../utils/user";
import type { CreateUserInput } from "../../types/user";

export const registerUser = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    let jwtUser;
    try {
      jwtUser = requireAuth(event);
      requireRole(jwtUser, "admin");
    } catch (err: any) {
      return {
        statusCode: err.statusCode || 401,
        headers,
        body: JSON.stringify({
          status: err.statusCode || 401,
          message: err.message,
        }),
      };
    }
    const tableName = getTableName();

    const body = parse(event.body) as Record<string, unknown>;
    const validated = (await createUserSchema.validate(body, {
      stripUnknown: true,
    })) as CreateUserInput;
    validated.email = validated.email.toLowerCase();

    // Create user (admin only)
    const service = new DynamoDBService(docClient, tableName, tableName);
    const createdUser = await service.createUser(validated);
    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        status: 201,
        message: "User created successfully",
        data: toPublicUser(createdUser),
      }),
    };
  } catch (error) {
    console.error("Error creating user:", error);
    return handleError(error);
  }
};
