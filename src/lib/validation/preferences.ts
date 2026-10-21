import { z } from "zod";
export const preferencesSchema = z.object({
  receivingOption: z.enum(["HOME", "NEIGHBOUR", "DOOR"]),
  deliveryInstruction: z.string().trim().max(2000),
  version: z.number().int().nonnegative(),
}).strict();
// Parcel identity must come from a validated server-side tracking session.
