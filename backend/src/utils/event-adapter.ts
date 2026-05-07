import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
} from "aws-lambda";

/**
 * Adapt a Lambda Function URL event (payload format v2.0) into the
 * APIGatewayProxyEvent (payload format v1.0) shape that the existing
 * SwiftRace handlers were written against.
 *
 * Why: Function URLs only emit v2 events, but every handler under
 * src/functions/** uses event.pathParameters / event.body / event.headers
 * the v1 way. Rewriting all 14 handlers would be lossy churn; adapting the
 * event in one place keeps each handler untouched and readable.
 */
export function adaptEvent(
  v2: APIGatewayProxyEventV2,
  pathParameters: Record<string, string> = {}
): APIGatewayProxyEvent {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(v2.headers || {})) {
    if (typeof value === "string") headers[key] = value;
  }

  let body: string | null = v2.body ?? null;
  if (body && v2.isBase64Encoded) {
    body = Buffer.from(body, "base64").toString("utf8");
  }

  // Cast through `unknown` because the v1 type has many optional fields we
  // intentionally leave undefined; handlers only read the ones below.
  const v1: unknown = {
    body,
    headers,
    multiValueHeaders: {},
    httpMethod: v2.requestContext?.http?.method ?? "GET",
    isBase64Encoded: false,
    path: v2.rawPath || "/",
    pathParameters: Object.keys(pathParameters).length ? pathParameters : null,
    queryStringParameters: v2.queryStringParameters ?? null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: v2.routeKey ?? "",
    requestContext: {
      identity: {
        sourceIp: v2.requestContext?.http?.sourceIp ?? "",
        userAgent: v2.requestContext?.http?.userAgent ?? "",
      },
      httpMethod: v2.requestContext?.http?.method ?? "GET",
      path: v2.rawPath || "/",
      requestId: v2.requestContext?.requestId ?? "",
      accountId: v2.requestContext?.accountId ?? "",
      apiId: v2.requestContext?.apiId ?? "",
      stage: v2.requestContext?.stage ?? "$default",
    },
  };

  return v1 as APIGatewayProxyEvent;
}
