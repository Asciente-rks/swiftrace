export const  USER_ROLES = ["customer", "shipper", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_VERIFICATION_STATUSES = ["pending", "verified", "rejected"] as const;
export type UserVerificationStatus = (typeof USER_VERIFICATION_STATUSES)[number];

export interface User {
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  verification_status: UserVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  password_hash: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUser extends Omit<User, "password_hash"> {}

export interface CreateUserInput
  extends Omit<User, "user_id" | "createdAt" | "updatedAt" | "password_hash"> {
  password: string;
}

export interface UpdateUserInput
  extends Partial<Omit<User, "user_id" | "createdAt" | "updatedAt" | "password_hash">> {
  password?: string;
}

export interface RetrieveUserFilters {
  role?: UserRole;
  sortOrder?: "asc" | "desc";
}