import * as yup from "yup";
import { SHIPMENT_STATUS } from "../types/shipment";

export const createShipmentSchema = yup
  .object()
  .shape({
    customer_id: yup.string().required("customer_id is required"),
    customer_name: yup.string().required("customer_name is required"),
    product_name: yup
      .string()
      .oneOf(["sample"], "product_name must be sample")
      .required("product_name is required"),
    tracking_number: yup.string().required("tracking_number is required"),
    origin: yup.string().required("origin is required"),
    destination: yup.string().required("destination is required"),
    current_location: yup.string().required("current_location is required"),
    status_: yup
      .string()
      .oneOf([...SHIPMENT_STATUS], `status_ must be one of: ${SHIPMENT_STATUS.join(", ")}`)
      .required("status_ is required"),
  })
  .unknown(false)
  .strict(true);

export const updateShipmentSchema = yup
  .object()
  .shape({
    customer_id: yup.string().optional(),
    customer_name: yup.string().optional(),
    product_name: yup.string().oneOf(["sample"]).optional(),
    origin: yup.string().optional(),
    destination: yup.string().optional(),
    current_location: yup.string().optional(),
    status_: yup.string().oneOf([...SHIPMENT_STATUS]).optional(),
  })
  .unknown(false)
  .strict(true);

export const retrieveShipmentQuerySchema = yup
  .object()
  .shape({
    status_: yup.string().oneOf([...SHIPMENT_STATUS]).optional(),
    sortOrder: yup.string().oneOf(["asc", "desc"]).optional(),
  })
  .unknown(false)
  .strict(true);