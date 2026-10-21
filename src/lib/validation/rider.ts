import { z } from "zod";
export const riderSchema = z.object({
  name: z.string().trim().min(1, "Rider name is required.").max(120),
  contactNumber: z.string().trim().min(5).max(32).regex(/^\+?[0-9 ()-]+$/, "Enter a valid contact number."),
  vehicleType: z.enum(["DELIVERY_VAN", "CAR", "BICYCLE"]),
  vehicleNumber: z.string().trim().max(80).optional(),
}).strict();
export type RiderInput = z.infer<typeof riderSchema>;
