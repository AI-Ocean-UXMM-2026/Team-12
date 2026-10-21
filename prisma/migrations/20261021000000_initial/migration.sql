-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RIDER');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('DELIVERY_VAN', 'CAR', 'BICYCLE');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PREPAID', 'COD');

-- CreateEnum
CREATE TYPE "ReceivingOption" AS ENUM ('HOME', 'NEIGHBOUR', 'DOOR');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('PROCESSING_DELIVERY', 'ON_THE_WAY', 'DELIVERED', 'DELAY');

-- CreateEnum
CREATE TYPE "DeliveryResult" AS ENUM ('CUSTOMER_UNREACHABLE', 'DELIVERED_HOME', 'DELIVERED_TO_NEIGHBOUR', 'LEFT_AT_DOOR');

-- CreateEnum
CREATE TYPE "AssignmentLifecycle" AS ENUM ('ACTIVE', 'REASSIGNED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PhotoLifecycle" AS ENUM ('STAGED', 'ATTACHED', 'DELETE_PENDING');

-- CreateEnum
CREATE TYPE "OutboxState" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rider" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "contactNumber" VARCHAR(32) NOT NULL,
    "vehicleType" "VehicleType" NOT NULL,
    "vehicleNumber" VARCHAR(80),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcel" (
    "id" UUID NOT NULL,
    "parcelCode" VARCHAR(64) NOT NULL,
    "trackingCodeHash" VARCHAR(128) NOT NULL,
    "trackingCodeCiphertext" TEXT NOT NULL,
    "trackingCodeNonce" TEXT NOT NULL,
    "trackingKeyVersion" INTEGER NOT NULL DEFAULT 1,
    "senderName" VARCHAR(120) NOT NULL,
    "receivedDate" DATE NOT NULL,
    "receivedPerson" VARCHAR(120) NOT NULL,
    "createdByAdminId" UUID NOT NULL,
    "customerName" VARCHAR(120) NOT NULL,
    "customerContactNumber" VARCHAR(32) NOT NULL,
    "township" VARCHAR(120) NOT NULL,
    "address" VARCHAR(1000) NOT NULL,
    "deliveryNote" VARCHAR(2000),
    "paymentType" "PaymentType" NOT NULL,
    "orderAmount" DECIMAL(18,2),
    "deliveryFee" DECIMAL(18,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'MMK',
    "receivingOption" "ReceivingOption" NOT NULL DEFAULT 'HOME',
    "deliveryInstruction" VARCHAR(2000),
    "customerStatus" "CustomerStatus" NOT NULL DEFAULT 'PROCESSING_DELIVERY',
    "currentAssignmentId" UUID,
    "deliveredAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parcel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" UUID NOT NULL,
    "parcelId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "assignedByAdminId" UUID NOT NULL,
    "assignDate" DATE NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "expectedDeliveryDate" DATE NOT NULL,
    "lifecycle" "AssignmentLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "latestResult" "DeliveryResult",
    "endedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAttempt" (
    "id" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "parcelId" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "result" "DeliveryResult" NOT NULL,
    "photoAssetId" UUID,
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAsset" (
    "id" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "detectedMime" VARCHAR(64) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "uploaderId" UUID NOT NULL,
    "parcelId" UUID NOT NULL,
    "assignmentId" UUID NOT NULL,
    "lifecycle" "PhotoLifecycle" NOT NULL DEFAULT 'STAGED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiderNotification" (
    "id" UUID NOT NULL,
    "riderId" UUID NOT NULL,
    "parcelId" UUID,
    "assignmentId" UUID,
    "type" VARCHAR(64) NOT NULL,
    "deliveryDate" DATE,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "RiderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "actorType" VARCHAR(32) NOT NULL,
    "actorId" TEXT,
    "parcelId" UUID,
    "assignmentId" UUID,
    "eventType" VARCHAR(80) NOT NULL,
    "metadata" JSONB NOT NULL,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "eventType" VARCHAR(64) NOT NULL,
    "entityId" TEXT NOT NULL,
    "protectedPayload" TEXT NOT NULL,
    "deduplicationKey" TEXT NOT NULL,
    "state" "OutboxState" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_userId_key" ON "Rider"("userId");

-- CreateIndex
CREATE INDEX "Rider_active_name_idx" ON "Rider"("active", "name");

-- CreateIndex
CREATE INDEX "Rider_contactNumber_idx" ON "Rider"("contactNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_parcelCode_key" ON "Parcel"("parcelCode");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_trackingCodeHash_key" ON "Parcel"("trackingCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_currentAssignmentId_key" ON "Parcel"("currentAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Parcel_currentAssignmentId_id_key" ON "Parcel"("currentAssignmentId", "id");

-- CreateIndex
CREATE INDEX "Assignment_riderId_deliveryDate_lifecycle_idx" ON "Assignment"("riderId", "deliveryDate", "lifecycle");

-- CreateIndex
CREATE INDEX "Assignment_parcelId_idx" ON "Assignment"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_id_parcelId_key" ON "Assignment"("id", "parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAttempt_photoAssetId_key" ON "DeliveryAttempt"("photoAssetId");

-- CreateIndex
CREATE INDEX "DeliveryAttempt_assignmentId_submittedAt_idx" ON "DeliveryAttempt"("assignmentId", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryAttempt_riderId_idempotencyKey_key" ON "DeliveryAttempt"("riderId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAsset_storageKey_key" ON "PhotoAsset"("storageKey");

-- CreateIndex
CREATE INDEX "PhotoAsset_lifecycle_createdAt_idx" ON "PhotoAsset"("lifecycle", "createdAt");

-- CreateIndex
CREATE INDEX "RiderNotification_riderId_createdAt_idx" ON "RiderNotification"("riderId", "createdAt");

-- CreateIndex
CREATE INDEX "RiderNotification_riderId_readAt_idx" ON "RiderNotification"("riderId", "readAt");

-- CreateIndex
CREATE INDEX "RiderNotification_riderId_deliveryDate_idx" ON "RiderNotification"("riderId", "deliveryDate");

-- CreateIndex
CREATE INDEX "AuditEvent_parcelId_createdAt_idx" ON "AuditEvent"("parcelId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_deduplicationKey_key" ON "OutboxEvent"("deduplicationKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_state_nextAttemptAt_idx" ON "OutboxEvent"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_actorId_action_key_key" ON "IdempotencyRecord"("actorId", "action", "key");

-- AddForeignKey
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_currentAssignmentId_id_fkey" FOREIGN KEY ("currentAssignmentId", "id") REFERENCES "Assignment"("id", "parcelId") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assignedByAdminId_fkey" FOREIGN KEY ("assignedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_photoAssetId_fkey" FOREIGN KEY ("photoAssetId") REFERENCES "PhotoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderNotification" ADD CONSTRAINT "RiderNotification_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderNotification" ADD CONSTRAINT "RiderNotification_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiderNotification" ADD CONSTRAINT "RiderNotification_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Domain invariants Prisma cannot express declaratively.
CREATE UNIQUE INDEX "Assignment_one_active_per_parcel" ON "Assignment" ("parcelId") WHERE "lifecycle" = 'ACTIVE';
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_nonnegative_delivery_fee" CHECK ("deliveryFee" >= 0);
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_valid_order_amount" CHECK (("paymentType" = 'COD' AND "orderAmount" IS NOT NULL AND "orderAmount" > 0) OR ("paymentType" = 'PREPAID' AND ("orderAmount" IS NULL OR "orderAmount" >= 0)));
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_valid_schedule" CHECK ("deliveryDate" >= "assignDate" AND "expectedDeliveryDate" = "deliveryDate" + 3);
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_valid_image" CHECK ("byteSize" > 0 AND "byteSize" <= 10485760 AND "detectedMime" IN ('image/jpeg', 'image/png'));
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_success_requires_photo" CHECK ("result" = 'CUSTOMER_UNREACHABLE' OR "photoAssetId" IS NOT NULL);
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_assignment_parcel_match" FOREIGN KEY ("assignmentId", "parcelId") REFERENCES "Assignment" ("id", "parcelId") ON DELETE RESTRICT;
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_assignment_parcel_match" FOREIGN KEY ("assignmentId", "parcelId") REFERENCES "Assignment" ("id", "parcelId") ON DELETE RESTRICT;
