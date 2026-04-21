import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { createShipmentSchema } from "../../validation/shipment-validation";
import { docClient } from "../../../config/db";
import { createDynamoDBService } from "../../service/dynamodb";
import type { CreateShipmentInput } from "../../types/shipment";

export const createShipment = async (
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
    const validated = (await createShipmentSchema.validate(body, {
      stripUnknown: true,
    })) as CreateShipmentInput;

    const input: CreateShipmentInput = {
      customer_id: validated.customer_id,
      customer_name: validated.customer_name,
      product_name: validated.product_name,
      tracking_number: validated.tracking_number,
      origin: validated.origin,
      destination: validated.destination,
      current_location: validated.current_location,
      status_: validated.status_,
    };

    const service = createDynamoDBService(docClient, tableName);
    const shipment = await service.createShipment(input);

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