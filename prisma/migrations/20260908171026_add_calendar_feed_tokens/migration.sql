-- AlterTable
ALTER TABLE "stands" ADD COLUMN     "calendar_feed_token" TEXT;

-- AlterTable
ALTER TABLE "stand_members" ADD COLUMN     "calendar_feed_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stands_calendar_feed_token_key" ON "stands"("calendar_feed_token");

-- CreateIndex
CREATE UNIQUE INDEX "stand_members_calendar_feed_token_key" ON "stand_members"("calendar_feed_token");
