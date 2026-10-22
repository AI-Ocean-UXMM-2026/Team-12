import { z } from "zod";
import { expectedDeliveryDate } from "@/lib/dates";
export const text = (max = 120) => z.string().trim().min(1).max(max);
export const dateOnly = z.string().refine((v) => {
  try {
    expectedDeliveryDate(v);
    return true;
  } catch {
    return false;
  }
}, "Use a valid YYYY-MM-DD date.");
export const money = z
  .string()
  .regex(
    /^\d{1,16}(\.\d{1,2})?$/,
    "Use a nonnegative amount with up to two decimal places.",
  );
export const phone = text(32).regex(/^\+?[0-9 ()-]{5,32}$/);
export const parcelSchema = z
  .object({
    senderName: text(),
    receivedDate: dateOnly,
    receivedPerson: text(),
    customerName: text(),
    customerContactNumber: phone,
    township: text(),
    address: text(1000),
    deliveryNote: z.string().trim().max(2000).optional(),
    paymentType: z.enum(["COD", "PREPAID"]),
    orderAmount: money.nullable().optional(),
    deliveryFee: money,
  })
  .strict()
  .refine(
    (v) =>
      v.paymentType !== "COD" ||
      (!!v.orderAmount && /[1-9]/.test(v.orderAmount)),
    { message: "COD requires a positive order amount.", path: ["orderAmount"] },
  );
export const assignmentSchema = z
  .object({
    parcelId: z.uuid(),
    riderId: z.uuid(),
    assignDate: dateOnly,
    deliveryDate: dateOnly,
    version: z.number().int().nonnegative(),
    mode: z.enum(["assign", "reassign", "reschedule"]),
  })
  .strict()
  .refine((v) => v.deliveryDate >= v.assignDate, {
    message: "Delivery date must be on or after assignment date.",
  });
export const preferenceSchema = z
  .object({
    receivingOption: z.enum(["HOME", "NEIGHBOUR", "DOOR"]),
    deliveryInstruction: z.string().trim().max(2000),
    version: z.number().int().nonnegative(),
  })
  .strict();
export const resultSchema = z
  .object({
    result: z.enum([
      "CUSTOMER_UNREACHABLE",
      "DELIVERED_HOME",
      "DELIVERED_TO_NEIGHBOUR",
      "LEFT_AT_DOOR",
    ]),
    version: z.coerce.number().int().nonnegative(),
    idempotencyKey: z.string().min(16).max(128),
  })
  .strict();
