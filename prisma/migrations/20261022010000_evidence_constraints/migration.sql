CREATE UNIQUE INDEX "PhotoAsset_id_assignmentId_parcelId_key" ON "PhotoAsset"("id", "assignmentId", "parcelId");
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_photo_relationship" FOREIGN KEY ("photoAssetId", "assignmentId", "parcelId") REFERENCES "PhotoAsset"("id", "assignmentId", "parcelId") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "Assignment_id_parcelId_riderId_key" ON "Assignment"("id", "parcelId", "riderId");
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_rider_relationship" FOREIGN KEY ("assignmentId", "parcelId", "riderId") REFERENCES "Assignment"("id", "parcelId", "riderId") ON DELETE RESTRICT;
CREATE FUNCTION prevent_attempt_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Delivery attempts are immutable'; END;
$$;
CREATE TRIGGER "DeliveryAttempt_append_only" BEFORE UPDATE OR DELETE ON "DeliveryAttempt" FOR EACH ROW EXECUTE FUNCTION prevent_attempt_mutation();
