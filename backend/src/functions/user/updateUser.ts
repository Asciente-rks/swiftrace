import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireSelfOrRole } from "../../utils/auth";
import { getTableName } from "../../utils/env";
import { toPublicUser } from "../../utils/user";
import { updateUserSchema } from "../../validation/user-validation";
import type { UpdateUserInput } from "../../types/user";

export const updateUser = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    let jwtUser;
    try {
      jwtUser = requireAuth(event);
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

    const user_id =
      event.pathParameters?.user_id || event.queryStringParameters?.user_id;

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
    try {
      requireSelfOrRole(jwtUser, user_id, "admin");
    } catch (err: any) {
      return {
        statusCode: err.statusCode || 403,
        headers,
        body: JSON.stringify({
          status: err.statusCode || 403,
          message: err.message,
        }),
      };
    }

    const body = parse(event.body) as Record<string, unknown>;
    const validated = (await updateUserSchema.validate(body, {
      stripUnknown: true,
    })) as UpdateUserInput;
    if (validated.email) {
      validated.email = validated.email.toLowerCase();
    }

    if (jwtUser.role !== "admin") {
      delete validated.role;
      delete validated.verification_status;
      delete validated.verifiedAt;
      delete validated.verifiedBy;
    }

    const service = new DynamoDBService(docClient, tableName, tableName);
    const existingUser = await service.getUserById(user_id);
    const updated = await service.updateUser(user_id, validated);

    if (!updated) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          status: 404,
          message: "User not found.",
        }),
      };
    }

    if (existingUser?.name !== updated.name) {
      const shipments = await service.getShipmentsByCustomerId(user_id);
      await Promise.all(
        shipments.map((shipment) =>
          service.updateShipment(shipment.shipment_id, {
            customer_name: updated.name,
          }),
        ),
      );
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "User updated successfully",
        data: toPublicUser(updated),
      }),
    };
  } catch (error) {
    console.error("Error updating user:", error);
    return handleError(error);
  }
};
