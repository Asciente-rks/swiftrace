import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { getTableName } from "../../utils/env";

export const getShipmentHistoryForUser = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const tableName = getTableName();

    const tracking_number = event.queryStringParameters?.tracking_number || event.pathParameters?.tracking_number;
    if (!tracking_number) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ status: 400, message: "tracking_number is required." }),
      };
    }

    const service = new DynamoDBService(docClient, tableName, tableName);
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