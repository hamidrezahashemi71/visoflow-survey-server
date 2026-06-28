-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('QUIZ_START', 'QUESTION_VIEW', 'ANSWER', 'NEXT', 'BACK', 'QUIZ_COMPLETE', 'ABANDON');

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "project" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "campaignAid" TEXT,
    "code" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrer" TEXT,
    "landingPath" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "country" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "lastQid" TEXT,
    "lastQuestionNumber" INTEGER,
    "maxQuestionNumber" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientEventId" TEXT,
    "type" "EventType" NOT NULL,
    "qid" TEXT,
    "questionKey" TEXT,
    "questionNumber" INTEGER,
    "category" TEXT,
    "aid" TEXT,
    "value" TEXT,
    "meta" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seq" INTEGER,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "pilotInterest" TEXT,
    "role" TEXT,
    "overallScore" DOUBLE PRECISION,
    "band" TEXT,
    "pillarScores" JSONB,
    "moneyMonthlyLoss" DOUBLE PRECISION,
    "moneyRecoverable" DOUBLE PRECISION,
    "moneyFreedHours" DOUBLE PRECISION,
    "region" TEXT,
    "staffCount" TEXT,
    "weeklyVolume" TEXT,
    "avgPrice" TEXT,
    "noShows" TEXT,
    "deposit" TEXT,
    "triedSoftware" TEXT,
    "services" TEXT[],
    "answers" JSONB NOT NULL,
    "controllers" JSONB NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_trackId_key" ON "Session"("trackId");

-- CreateIndex
CREATE INDEX "Session_status_idx" ON "Session"("status");

-- CreateIndex
CREATE INDEX "Session_campaignAid_idx" ON "Session"("campaignAid");

-- CreateIndex
CREATE INDEX "Session_utmCampaign_idx" ON "Session"("utmCampaign");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE INDEX "Event_sessionId_occurredAt_idx" ON "Event"("sessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_type_questionNumber_idx" ON "Event"("type", "questionNumber");

-- CreateIndex
CREATE INDEX "Event_qid_idx" ON "Event"("qid");

-- CreateIndex
CREATE UNIQUE INDEX "Event_sessionId_clientEventId_key" ON "Event"("sessionId", "clientEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_sessionId_key" ON "Submission"("sessionId");

-- CreateIndex
CREATE INDEX "Submission_band_idx" ON "Submission"("band");

-- CreateIndex
CREATE INDEX "Submission_pilotInterest_idx" ON "Submission"("pilotInterest");

-- CreateIndex
CREATE INDEX "Submission_region_idx" ON "Submission"("region");

-- CreateIndex
CREATE INDEX "Submission_createdAt_idx" ON "Submission"("createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
