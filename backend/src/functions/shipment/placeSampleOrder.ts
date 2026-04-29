import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireRole } from "../../utils/auth";
import { getTableName } from "../../utils/env";
import { sendTrackingEmail } from "../../utils/email";
import type { CreateShipmentInput } from "../../types/shipment";

function generateTrackingNumber(): string {
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `SW${Date.now()}${rand}`;
}

export const placeSampleOrder = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    let jwtUser;
    try {
      jwtUser = requireAuth(event);
      requireRole(jwtUser, "customer");
    } catch (err: any) {
      return {
        statusCode: err.statusCode || 401,
        headers,
        body: JSON.stringify({ status: err.statusCode || 401, message: err.message }),
      };
    }

    const tableName = getTableName();
    const service = new DynamoDBService(docClient, tableName, tableName);

    const user = await service.getUserById(jwtUser.user_id);
    if (!user) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ status: 404, message: "User not found." }),
      };
    }

    const existing = await service.getShipmentsByCustomerId(jwtUser.user_id);
    if (existing.length > 0) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          status: 409,
          message: "Only one sample order is allowed per user.",
        }),
      };
    }

    const body = parse(event.body) as Record<string, unknown>;
    const destination = String(body?.destination || "").trim();
    const origin = String(body?.origin || process.env.DEFAULT_ORIGIN || "Warehouse").trim();

    if (!destination) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 400, message: "destination is required." }),
      };
    }

    const baseInput: Omit<CreateShipmentInput, "tracking_number"> = {
      customer_id: user.user_id,
      customer_name: user.name,
      product_name: "sample",
      origin,
      destination,
      current_location: origin,
      status_: "preparing",
    };

    let shipment;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        shipment = await service.createShipment({
          ...baseInput,
          tracking_number: generateTrackingNumber(),
        });
        break;
      } catch (err: any) {
        if (err?.code !== "ConditionalCheckFailedException") {
          throw err;
        }
      }
    }

    if (!shipment) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ status: 500, message: "Failed to create shipment." }),
      };
    }

    await service.createShipmentHistory({
      tracking_number: shipment.tracking_number,
      historyType: "created",
      status: shipment.status_,
      current_location: shipment.current_location,
      details: "Sample order created.",
    });

    await sendTrackingEmail(user.email, shipment.tracking_number);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        status: 201,
        message: "Sample order created.",
        data: shipment,
      }),
    };
  } catch (error) {
    console.error("Error creating sample order:", error);
    return handleError(error);
  }
};
