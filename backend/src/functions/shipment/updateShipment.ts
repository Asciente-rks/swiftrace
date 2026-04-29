import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth } from "../../utils/auth";
import { getTableName } from "../../utils/env";
import { updateShipmentSchema } from "../../validation/shipment-validation";
import type { UpdateShipmentInput, ShipmentStatus } from "../../types/shipment";
import type { ShipmentHistoryType } from "../../types/history";

export const updateShipment = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // JWT authentication
    let jwtUser;
    try {
      jwtUser = requireAuth(event);
    } catch (err: any) {
      return {
        statusCode: err.statusCode || 401,
        headers,
        body: JSON.stringify({ status: err.statusCode || 401, message: err.message }),
      };
    }
    if (jwtUser.role !== "admin" && jwtUser.role !== "shipper") {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ status: 403, message: "Forbidden: Insufficient role" }),
      };
    }
    const tableName = getTableName();

    // Get shipment_id from path or query
    const shipment_id =
      event.pathParameters?.shipment_id ||
      event.queryStringParameters?.shipment_id;

    if (!shipment_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "shipment_id is required.",
        }),
      };
    }

    // Parse and validate input
    const body = parse(event.body) as Record<string, unknown>;
    const validated = (await updateShipmentSchema.validate(body, {
      stripUnknown: true,
    })) as UpdateShipmentInput;

    const historyDetails =
      typeof body?.details === "string" ? (body.details as string) : undefined;

    let updateInput: UpdateShipmentInput = validated;
    if (jwtUser.role === "shipper") {
      updateInput = {};
      if (validated.current_location) {
        updateInput.current_location = validated.current_location;
      }
      if (validated.status_) {
        updateInput.status_ = validated.status_ as ShipmentStatus;
      }
    }

    if (jwtUser.role === "shipper" && !updateInput.current_location && !updateInput.status_) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "No updatable fields provided.",
        }),
      };
    }

    const service = new DynamoDBService(docClient, tableName, tableName);
    const updated = await service.updateShipment(shipment_id, updateInput);

    if (!updated) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          status: 404,
          message: "Shipment not found.",
        }),
      };
    }

    if (updateInput.status_ || updateInput.current_location) {
      let historyType: ShipmentHistoryType = "in_transit";
      if (updateInput.status_) {
        if (updateInput.status_ === "preparing") {
          historyType = "picked_up";
        } else {
          historyType = updateInput.status_ as ShipmentHistoryType;
        }
      }

      await service.createShipmentHistory({
        tracking_number: updated.tracking_number,
        historyType,
        status: updated.status_,
        current_location: updated.current_location,
        details: historyDetails ?? `Shipment updated by ${jwtUser.role}.`,
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Shipment updated successfully",
        data: updated,
      }),
    };
  } catch (error) {
    console.error("Error updating shipment:", error);
    return handleError(error);
  }
};