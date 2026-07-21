-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'APP_INTEREST';

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "appInterest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appInterestAt" TIMESTAMP(3);
