-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SUGGESTED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "reconciliation_matches" (
    "id" TEXT NOT NULL,
    "importedTransactionId" TEXT NOT NULL,
    "entryId" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "matchScore" DOUBLE PRECISION NOT NULL,
    "matchReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_matches_importedTransactionId_key" ON "reconciliation_matches"("importedTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_matches_entryId_key" ON "reconciliation_matches"("entryId");

-- AddForeignKey
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_importedTransactionId_fkey" FOREIGN KEY ("importedTransactionId") REFERENCES "imported_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_matches" ADD CONSTRAINT "reconciliation_matches_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
