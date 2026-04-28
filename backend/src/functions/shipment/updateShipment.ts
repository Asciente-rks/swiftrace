import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth } from "../../utils/auth";
import type { UpdateShipmentInput } from "../../types/shipment";

export const updateShipment = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // JWT authentication
    try {
      requireAuth(event);
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
    // Optionally: validate with a schema here

    const service = new DynamoDBService(docClient, "", tableName);
    const updated = await service.updateShipment(shipment_id, body as UpdateShipmentInput);

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