import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { createUserSchema } from "../../validation/user-validation";
import { docClient } from "../../../config/db";
import { createDynamoDBService } from "../../service/dynamodb";
import type { CreateUserInput } from "../../types/user";

type RegisterUserPayload = Omit<CreateUserInput, "verification_status"> & {
  verification_status?: "pending";
};

export const registerUser = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const tableName = process.env.LOGISTICS_DYNAMO_TABLE;

    if (!tableName) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          status: 500,
          message: "LOGISTICS_DYNAMO_TABLE environment variable is not set.",
        }),
      };
    }

    const body = parse(event.body) as Record<string, unknown>;
    const validated = (await createUserSchema.validate(body, {
      stripUnknown: true,
    })) as RegisterUserPayload;

    const input: CreateUserInput = {
      name: validated.name,
      email: validated.email,
      phone: validated.phone,
      role: validated.role,
      verification_status: validated.verification_status ?? "pending",
    };

    const service = createDynamoDBService(docClient, tableName);
    const user = await service.createUser(input);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        status: 201,
        message: "User registered successfully",
        data: user,
      }),
    };
  } catch (error) {
    console.error("Error registering user:", error);
    return handleError(error);
  }
};