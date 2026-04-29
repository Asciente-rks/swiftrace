import { verifyJwt, JwtPayload } from "./jwt";
import { APIGatewayProxyEvent } from "aws-lambda";
import type { UserRole } from "../types/user";

export function requireAuth(event: APIGatewayProxyEvent): JwtPayload {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err: any = new Error("Missing or invalid Authorization header");
    err.statusCode = 401;
    throw err;
  }
  const token = authHeader.replace("Bearer ", "");
  try {
    return verifyJwt(token);
  } catch {
    const err: any = new Error("Invalid or expired token");
    err.statusCode = 401;
    throw err;
  }
}

export function requireRole(user: JwtPayload, role: UserRole) {
  if (user.role !== role) {
    const err: any = new Error("Forbidden: Insufficient role");
    err.statusCode = 403;
    throw err;
  }
}

export function requireSelfOrRole(user: JwtPayload, user_id: string, role: UserRole) {
  if (user.user_id !== user_id && user.role !== role) {
    const err: any = new Error("Forbidden: You can only access your own resource or be an admin.");
    err.statusCode = 403;
    throw err;
  }
}
