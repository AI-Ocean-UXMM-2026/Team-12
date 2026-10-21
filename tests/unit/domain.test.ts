import { describe, expect, it } from "vitest";
import { expectedDeliveryDate } from "@/lib/dates";
import { canChangePreferences, photoRequired, statusForResult } from "@/domain/delivery";
import { riderSchema } from "@/lib/validation/rider";
describe("calendar expected date", () => {
  it.each([["2026-01-30","2026-02-02"],["2026-12-30","2027-01-02"],["2028-02-27","2028-03-01"]])("adds three days across boundaries: %s", (a,b)=>expect(expectedDeliveryDate(a)).toBe(b));
  it.each(["2026-02-30","2026-2-01","not-a-date"])("rejects invalid date %s", d=>expect(()=>expectedDeliveryDate(d)).toThrow());
});
describe("delivery business defaults",()=>{
  it("keeps failed attempts delayed and retryable",()=>{expect(statusForResult("CUSTOMER_UNREACHABLE")).toBe("DELAY");expect(photoRequired("CUSTOMER_UNREACHABLE")).toBe(false);expect(canChangePreferences("DELAY")).toBe(true);});
  it.each(["DELIVERED_HOME","DELIVERED_TO_NEIGHBOUR","LEFT_AT_DOOR"] as const)("requires proof and maps %s to Delivered", result=>{expect(statusForResult(result)).toBe("DELIVERED");expect(photoRequired(result)).toBe(true);});
  it("locks customer preferences after delivery",()=>expect(canChangePreferences("DELIVERED")).toBe(false));
});
describe("Rider validation",()=>{
  it("allows a Bicycle without a vehicle number and preserves a leading zero",()=>expect(riderSchema.parse({name:" Test Rider ",contactNumber:"09970000001",vehicleType:"BICYCLE"})).toEqual({name:"Test Rider",contactNumber:"09970000001",vehicleType:"BICYCLE"}));
  it("rejects incomplete and unapproved vehicle data",()=>expect(riderSchema.safeParse({name:"",contactNumber:"123",vehicleType:"MOTORBIKE"}).success).toBe(false));
});
