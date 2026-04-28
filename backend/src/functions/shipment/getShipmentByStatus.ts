import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handleError, headers } from "../../utils/error-handler";
import { docClient } from "../../../config/db";
import { DynamoDBService } from "../../service/dynamodb";
import { requireAuth, requireRole } from "../../utils/auth";
import type { ShipmentStatus } from "../../types/shipment";

export const getShipmentsByStatus = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // JWT authentication and admin check
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

    // Get status from query string or path parameters
    const status_ = event.queryStringParameters?.status_ || event.pathParameters?.status_;

    if (!status_) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          status: 400,
          message: "status_ is required.",
        }),
      };
    }

    const sortOrder =
      event.queryStringParameters?.sortOrder === "asc" ? "asc" : "desc";

    const service = new DynamoDBService(docClient, "", tableName);

    // Fetch shipments by status
    const shipments = await service.getShipments({ status_: status_ as ShipmentStatus, sortOrder });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 200,
        message: "Shipments found.",
        data: shipments,
      }),
    };
  } catch (error) {
    console.error("Error fetching shipments by status:", error);
    return handleError(error);
  }
};