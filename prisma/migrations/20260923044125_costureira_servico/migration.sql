-- CreateTable
CREATE TABLE "costureira_servicos" (
    "id" TEXT NOT NULL,
    "counterpartyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT,
    "paidEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "costureira_servicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "costureira_servicos_counterpartyId_paidEntryId_idx" ON "costureira_servicos"("counterpartyId", "paidEntryId");

-- AddForeignKey
ALTER TABLE "costureira_servicos" ADD CONSTRAINT "costureira_servicos_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "counterparties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
