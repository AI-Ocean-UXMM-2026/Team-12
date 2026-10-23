CREATE TABLE "PhotoUploadTicket" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "assignmentId" UUID NOT NULL REFERENCES "Assignment"("id") ON DELETE RESTRICT,
  "storageKey" TEXT NOT NULL UNIQUE,
  "idempotencyKey" VARCHAR(128) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PhotoUploadTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PhotoUploadTicket_expiresAt_idx" ON "PhotoUploadTicket"("expiresAt");
