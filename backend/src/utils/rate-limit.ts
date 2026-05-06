import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { headers } from "./error-handler";

type Bucket = number[];
const BUCKETS: Map<string, Bucket> = new Map();

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  bucketKey: string;
};

export function getClientIp(event: APIGatewayProxyEvent): string {
  const fwd =
    event.headers?.["x-forwarded-for"] ||
    event.headers?.["X-Forwarded-For"];
  if (fwd) return String(fwd).split(",")[0].trim() || "unknown";
  const sourceIp = event.requestContext?.identity?.sourceIp;
  return sourceIp || "unknown";
}

export function rateLimit(
  event: APIGatewayProxyEvent,
  opts: RateLimitOptions
): APIGatewayProxyResult | null {
  const ip = getClientIp(event);
  const key = `${opts.bucketKey}:${ip}`;
  const now = Date.now();
  const bucket = BUCKETS.get(key) || [];

  while (bucket.length && bucket[0] < now - opts.windowMs) {
    bucket.shift();
  }

  if (bucket.length >= opts.limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((bucket[0] + opts.windowMs - now) / 1000)
    );
    return {
      statusCode: 429,
      headers: {
        ...headers,
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(opts.limit),
        "X-RateLimit-Remaining": "0",
      },
      body: JSON.stringify({
        status: 429,
        message: "Too many requests. Please slow down.",
      }),
    };
  }

  bucket.push(now);
  BUCKETS.set(key, bucket);
  return null;
}
