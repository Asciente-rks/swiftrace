import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth } from "../../utils/auth";

export const getShipmentHistoryForUser = async (
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
        body: JSON.stringify({ status: 500, message: "SHIPMENT_DYNAMO_TABLE environment variable is not set." }),
      };
    }

    const tracking_number = event.queryStringParameters?.tracking_number || event.pathParameters?.tracking_number;
    if (!tracking_number) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 400, message: "tracking_number is required." }),
      };
    }

    const service = new DynamoDBService(docClient, "", tableName);
    const history = await service.getShipmentHistoryForUser(tracking_number);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Shipment history found.",
        data: history,
      }),
    };
  } catch (error) {
    console.error("Error fetching shipment history:", error);
    return handleError(error);
  }
};