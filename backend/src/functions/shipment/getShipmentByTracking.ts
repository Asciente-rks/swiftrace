import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";

export const getShipmentByTracking = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
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

    // Get tracking number from query string or path parameters
    const tracking_number =
      event.queryStringParameters?.tracking_number ||
      event.pathParameters?.tracking_number;

    if (!tracking_number) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "tracking_number is required.",
        }),
      };
    }

    const service = new DynamoDBService(docClient, "", tableName);

    // Fetch shipment metadata
    const shipment = await service.getShipmentByTrackingNumber(tracking_number);

    if (!shipment) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          status: 404,
          message: "Shipment not found.",
        }),
      };
    }

    // Fetch shipment history (user-safe)
    const history = await service.getShipmentHistoryForUser(tracking_number);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Shipment found.",
        data: {
          shipment,
          history,
        },
      }),
    };
  } catch (error) {
    console.error("Error fetching shipment by tracking number:", error);
    return handleError(error);
  }
};