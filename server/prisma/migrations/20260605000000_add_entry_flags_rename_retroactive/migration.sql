-- AlterTable: add tryAgain and neverAgain to Entry
ALTER TABLE "Entry" ADD COLUMN "tryAgain" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Entry" ADD COLUMN "neverAgain" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: rename retroactive → uncertainRating on Review
ALTER TABLE "Review" RENAME COLUMN "retroactive" TO "uncertainRating";
