import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { parse } from "../../utils/parse";
import { handleError, headers } from "../../utils/error-handler";
import { sendTrackingEmail } from "../../utils/email";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth } from "../../utils/auth";
import { getTableName } from "../../utils/env";

export const sendTrackingEmailHandler = async (
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
    const tableName = getTableName();

    // Parse and validate input
    const body = parse(event.body) as Record<string, unknown>;
    const email = body?.email as string;
    const tracking_number = body?.tracking_number as string;

    if (!email || !tracking_number) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "Both email and tracking_number are required.",
        }),
      };
    }

    // Optionally, verify the shipment exists
    const service = new DynamoDBService(docClient, tableName, tableName);
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

    // Send the email
    await sendTrackingEmail(email, tracking_number);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Tracking number sent via email.",
      }),
    };
  } catch (error) {
    console.error("Error sending tracking email:", error);
    return handleError(error);
  }
};