import * as yup from "yup";
import { USER_ROLES, USER_VERIFICATION_STATUSES } from "../types/user";

export const createUserSchema = yup
  .object()
  .shape({
    name: yup.string().required("name is required"),
    email: yup.string().email("email must be valid").required("email is required"),
    phone: yup.string().optional(),
    role: yup
      .string()
      .oneOf([...USER_ROLES], `role must be one of: ${USER_ROLES.join(", ")}`)
      .required("role is required"),
    verification_status: yup
      .string()
      .oneOf(
        [...USER_VERIFICATION_STATUSES],
        `verification_status must be one of: ${USER_VERIFICATION_STATUSES.join(", ")}`
      )
      .default("pending"),
    verifiedAt: yup.string().optional(),
    verifiedBy: yup.string().optional(),
  })
  .unknown(false)
  .strict(true);

export const updateUserSchema = yup
  .object()
  .shape({
    name: yup.string().optional(),
    email: yup.string().email("email must be valid").optional(),
    phone: yup.string().optional(),
    role: yup.string().oneOf([...USER_ROLES]).optional(),
    verification_status: yup.string().oneOf([...USER_VERIFICATION_STATUSES]).optional(),
    verifiedAt: yup.string().optional(),
    verifiedBy: yup.string().optional(),
  })
  .unknown(false)
  .strict(true);

export const retrieveUserQuerySchema = yup
  .object()
  .shape({
    role: yup.string().oneOf([...USER_ROLES]).optional(),
    sortOrder: yup.string().oneOf(["asc", "desc"]).optional(),
  })
  .unknown(false)
  .strict(true);