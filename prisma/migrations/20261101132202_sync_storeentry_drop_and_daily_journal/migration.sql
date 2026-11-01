-- DropTable
DROP TABLE IF EXISTS "StoreEntry";

-- CreateTable
CREATE TABLE "DailyJournal" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyJournal_pkey" PRIMARY KEY ("id")
);
