-- CreateTable
CREATE TABLE "rejected_match_pairs" (
    "id" TEXT NOT NULL,
    "importedTransactionId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rejected_match_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rejected_match_pairs_importedTransactionId_entryId_key" ON "rejected_match_pairs"("importedTransactionId", "entryId");

-- AddForeignKey
ALTER TABLE "rejected_match_pairs" ADD CONSTRAINT "rejected_match_pairs_importedTransactionId_fkey" FOREIGN KEY ("importedTransactionId") REFERENCES "imported_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rejected_match_pairs" ADD CONSTRAINT "rejected_match_pairs_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
