import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyResult,
} from "aws-lambda";

// Existing handlers — same files, same exports as before. The conversion does
// NOT touch handler internals; the router below delegates to them after
// adapting the Function URL (v2) event to the v1 shape they were written for.
import { registerUser } from "./functions/user/createUser";
import { loginUser } from "./functions/user/loginUser";
import { updateUser } from "./functions/user/updateUser";
import { deleteUser } from "./functions/user/deleteUser";
import { getUsersByRole } from "./functions/user/getUserByRole";

import { placeSampleOrder } from "./functions/shipment/placeSampleOrder";
import { createShipment } from "./functions/shipment/createShipment";
import { updateShipment } from "./functions/shipment/updateShipment";
import { getShipmentByTracking } from "./functions/shipment/getShipmentByTracking";
import { getShipmentHistoryForUser } from "./functions/shipment/getShipmentHistory";
import { getShipmentsByStatus } from "./functions/shipment/getShipmentByStatus";
import { sendTrackingEmailHandler } from "./functions/shipment/sendTrackingEmail";

import { handler as seedDatabase } from "./functions/dev/seedDatabase";
import { handler as clearDatabase } from "./functions/dev/clearDatabase";

import { adaptEvent } from "./utils/event-adapter";
import { headers } from "./utils/error-handler";

type V1Handler = (event: any) => Promise<APIGatewayProxyResult>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: V1Handler;
}

function r(method: string, path: string, handler: V1Handler): Route {
  const paramNames: string[] = [];
  const regexSrc = path.replace(/\{(\w+)\}/g, (_, name) => {
    paramNames.push(name);
    return "([^/]+)";
  });
  return {
    method: method.toUpperCase(),
    pattern: new RegExp(`^${regexSrc}/?$`),
    paramNames,
    handler,
  };
}

// Order-sensitive: more specific routes must come before more general ones
// when their prefixes overlap.
const ROUTES: Route[] = [
  // auth
  r("POST", "/auth/login", loginUser),

  // users
  r("POST", "/users", registerUser),
  r("GET", "/users", getUsersByRole),
  r("PUT", "/users/{user_id}", updateUser),
  r("DELETE", "/users/{user_id}", deleteUser),

  // orders
  r("POST", "/orders/sample", placeSampleOrder),

  // shipments — specific paths first
  r("POST", "/shipments/tracking/email", sendTrackingEmailHandler),
  r("GET", "/shipments/tracking/{tracking_number}", getShipmentByTracking),
  r("GET", "/shipments/status/{status_}", getShipmentsByStatus),
  r("GET", "/shipments/{tracking_number}/history", getShipmentHistoryForUser),
  r("POST", "/shipments", createShipment),
  r("PUT", "/shipments/{shipment_id}", updateShipment),

  // dev helpers
  r("POST", "/dev/seed", seedDatabase),
  r("POST", "/dev/clear", clearDatabase),
];

function preflight(): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: { ...headers, "Content-Length": "0" },
    body: "",
  };
}

function notFound(method: string, path: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({
      status: 404,
      message: `Route not found: ${method} ${path}`,
    }),
  };
}

function healthCheck(): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 200,
      service: "swiftrace-api",
      message: "ok",
      time: new Date().toISOString(),
    }),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const method = (event.requestContext?.http?.method || "GET").toUpperCase();
  const rawPath = event.rawPath || "/";
  const path = rawPath.length > 1 ? rawPath.replace(/\/+$/, "") : rawPath;

  if (method === "OPTIONS") return preflight();
  if (path === "/" || path === "/health") return healthCheck();

  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(path);
    if (!match) continue;

    const pathParameters: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      pathParameters[name] = decodeURIComponent(match[i + 1]);
    });

    const v1Event = adaptEvent(event, pathParameters);
    return route.handler(v1Event);
  }

  return notFound(method, path);
};
