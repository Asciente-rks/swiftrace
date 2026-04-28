import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export interface JwtPayload {
  user_id: string;
  role: "admin" | "shipper" | "customer";
  // add more fields as needed
}

export function verifyJwt(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    throw new Error("Invalid or expired token");
  }
}