-- Rename Submission.whatsapp -> phone and make it optional, preserving data.
ALTER TABLE "Submission" RENAME COLUMN "whatsapp" TO "phone";
ALTER TABLE "Submission" ALTER COLUMN "phone" DROP NOT NULL;
