import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { createShipmentSchema } from "../../validation/shipment-validation";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireRole } from "../../utils/auth";
import { getTableName } from "../../utils/env";
import type { CreateShipmentInput } from "../../types/shipment";

export const createShipment = async (
  event: APIGatewayProxyEvent
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
        body: JSON.stringify({ status: err.statusCode || 401, message: err.message }),
      };
    }
    const tableName = getTableName();

    const body = parse(event.body) as Record<string, unknown>;
    const validated = (await createShipmentSchema.validate(body, {
      stripUnknown: true,
    })) as CreateShipmentInput;

    const service = new DynamoDBService(docClient, tableName, tableName);
    const shipment = await service.createShipment(validated);
    await service.createShipmentHistory({
      tracking_number: shipment.tracking_number,
      historyType: "created",
      status: shipment.status_,
      current_location: shipment.current_location,
      details: "Shipment created by admin.",
    });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        status: 201,
        message: "Shipment created successfully",
        data: shipment,
      }),
    };
  } catch (error) {
    console.error("Error creating shipment:", error);
    return handleError(error);
  }
};