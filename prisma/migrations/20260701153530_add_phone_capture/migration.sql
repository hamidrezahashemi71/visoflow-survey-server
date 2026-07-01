-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'PHONE_CAPTURED';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "phoneCapturedAt" TIMESTAMP(3),
ADD COLUMN     "phoneSource" TEXT;

-- CreateIndex
CREATE INDEX "Session_phone_idx" ON "Session"("phone");
