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
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput extends Omit<User, "user_id" | "createdAt" | "updatedAt"> {}

export interface UpdateUserInput extends Partial<Omit<User, "user_id" | "createdAt" | "updatedAt">> {}

export interface RetrieveUserFilters {
  role?: UserRole;
  sortOrder?: "asc" | "desc";
}