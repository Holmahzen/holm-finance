-- Rename paidEntryId -> entryId (now used for both pending and paid state;
-- status lives on the linked Entry, not on this column)
ALTER TABLE "costureira_servicos" RENAME COLUMN "paidEntryId" TO "entryId";

-- Rename the index to match
ALTER INDEX "costureira_servicos_counterpartyId_paidEntryId_idx" RENAME TO "costureira_servicos_counterpartyId_entryId_idx";

-- New: this column is now a real foreign key to Entry
ALTER TABLE "costureira_servicos" ADD CONSTRAINT "costureira_servicos_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
