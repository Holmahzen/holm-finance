-- CreateTable
CREATE TABLE "service_invoices" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerDocument" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "recipientDocument" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "serviceDescription" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issuedOn" TIMESTAMP(3) NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "documentNumber" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_invoices_dedupeKey_key" ON "service_invoices"("dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "service_invoices_entryId_key" ON "service_invoices"("entryId");

-- CreateIndex
CREATE INDEX "service_invoices_referenceMonth_idx" ON "service_invoices"("referenceMonth");

-- AddForeignKey
ALTER TABLE "service_invoices" ADD CONSTRAINT "service_invoices_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
