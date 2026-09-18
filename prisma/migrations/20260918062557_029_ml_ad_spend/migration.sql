-- CreateEnum
CREATE TYPE "FiscalNoteDirection" AS ENUM ('SAIDA', 'ENTRADA_PROPRIA', 'ENTRADA_TERCEIRO');

-- AlterTable
ALTER TABLE "marketplace_sales" ADD COLUMN     "listingCode" TEXT;

-- CreateTable
CREATE TABLE "fiscal_notes" (
    "id" TEXT NOT NULL,
    "accessKey" TEXT NOT NULL,
    "direction" "FiscalNoteDirection" NOT NULL,
    "purpose" INTEGER NOT NULL,
    "operationType" INTEGER NOT NULL,
    "natureOfOperation" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "series" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "issueMonth" TEXT NOT NULL,
    "issuerDocument" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "issuerUf" TEXT NOT NULL,
    "issuerCrt" INTEGER,
    "recipientDocument" TEXT,
    "recipientName" TEXT,
    "recipientUf" TEXT,
    "finalConsumer" BOOLEAN NOT NULL,
    "intermediaryDocument" TEXT,
    "productsTotal" DECIMAL(14,2) NOT NULL,
    "discountTotal" DECIMAL(14,2) NOT NULL,
    "freightTotal" DECIMAL(14,2) NOT NULL,
    "otherTotal" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "icmsTotal" DECIMAL(14,2) NOT NULL,
    "icmsStTotal" DECIMAL(14,2) NOT NULL,
    "ipiTotal" DECIMAL(14,2) NOT NULL,
    "pisTotal" DECIMAL(14,2) NOT NULL,
    "cofinsTotal" DECIMAL(14,2) NOT NULL,
    "difalTotal" DECIMAL(14,2) NOT NULL,
    "simplesCreditTotal" DECIMAL(14,2) NOT NULL,
    "referencedKeys" TEXT[],
    "cancelledAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_note_items" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ncm" TEXT NOT NULL,
    "cfop" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "grossValue" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL,
    "netValue" DECIMAL(14,2) NOT NULL,
    "icmsCode" TEXT,
    "icmsBase" DECIMAL(14,2) NOT NULL,
    "icmsRate" DECIMAL(7,4) NOT NULL,
    "icmsValue" DECIMAL(14,2) NOT NULL,
    "simplesCreditValue" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "fiscal_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_note_cancellations" (
    "accessKey" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3) NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fiscal_note_cancellations_pkey" PRIMARY KEY ("accessKey")
);

-- CreateTable
CREATE TABLE "ml_service_invoices" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerDocument" TEXT NOT NULL,
    "providerCity" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "issuedOn" DATE NOT NULL,
    "link" TEXT,
    "sourceFileName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ML_DEMONSTRATIVO',
    "documentNumber" TEXT,
    "verificationCode" TEXT,
    "serviceCode" TEXT,
    "issAmount" DECIMAL(14,2),
    "issRate" DECIMAL(7,4),
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_service_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_ad_spend" (
    "id" TEXT NOT NULL,
    "listingCode" TEXT NOT NULL,
    "adTitle" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "investimento" DECIMAL(14,2) NOT NULL,
    "receita" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_ad_spend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scanned_note_keys" (
    "accessKey" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scanned_note_keys_pkey" PRIMARY KEY ("accessKey")
);

-- CreateTable
CREATE TABLE "sefaz_distribution_state" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "lastNsu" TEXT NOT NULL DEFAULT '0',
    "maxNsu" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastMessage" TEXT,

    CONSTRAINT "sefaz_distribution_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sefaz_documents" (
    "nsu" TEXT NOT NULL,
    "schema" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "accessKey" TEXT,
    "issuerDocument" TEXT,
    "issuerName" TEXT,
    "issuedAt" TIMESTAMP(3),
    "total" DECIMAL(14,2),
    "situation" TEXT,
    "xml" TEXT NOT NULL,
    "imported" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sefaz_documents_pkey" PRIMARY KEY ("nsu")
);

-- CreateTable
CREATE TABLE "tipi_rates" (
    "ncm" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rate" TEXT NOT NULL,
    "numericRate" DECIMAL(6,2),
    "version" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipi_rates_pkey" PRIMARY KEY ("ncm")
);

-- CreateTable
CREATE TABLE "pgdas_apuracoes" (
    "period" TEXT NOT NULL,
    "apuracaoNumber" TEXT NOT NULL,
    "rectifying" BOOLEAN NOT NULL,
    "revenue" DECIMAL(14,2) NOT NULL,
    "rbt12" DECIMAL(14,2) NOT NULL,
    "rba" DECIMAL(14,2) NOT NULL,
    "rbaa" DECIMAL(14,2) NOT NULL,
    "sublimit" DECIMAL(14,2),
    "ceiling" DECIMAL(14,2),
    "icmsBlocked" BOOLEAN,
    "irpj" DECIMAL(14,2) NOT NULL,
    "csll" DECIMAL(14,2) NOT NULL,
    "cofins" DECIMAL(14,2) NOT NULL,
    "pis" DECIMAL(14,2) NOT NULL,
    "cpp" DECIMAL(14,2) NOT NULL,
    "icms" DECIMAL(14,2) NOT NULL,
    "ipi" DECIMAL(14,2) NOT NULL,
    "iss" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "activities" JSONB NOT NULL,
    "dasNumber" TEXT,
    "dasDueDate" DATE,
    "dasPaid" BOOLEAN,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pgdas_apuracoes_pkey" PRIMARY KEY ("period")
);

-- CreateTable
CREATE TABLE "pgdas_monthly_revenues" (
    "month" TEXT NOT NULL,
    "revenue" DECIMAL(14,2) NOT NULL,
    "sourcePeriod" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pgdas_monthly_revenues_pkey" PRIMARY KEY ("month")
);

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_notes_accessKey_key" ON "fiscal_notes"("accessKey");

-- CreateIndex
CREATE INDEX "fiscal_notes_issueMonth_idx" ON "fiscal_notes"("issueMonth");

-- CreateIndex
CREATE INDEX "fiscal_notes_issuerDocument_idx" ON "fiscal_notes"("issuerDocument");

-- CreateIndex
CREATE INDEX "fiscal_note_items_noteId_idx" ON "fiscal_note_items"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "ml_service_invoices_dedupeKey_key" ON "ml_service_invoices"("dedupeKey");

-- CreateIndex
CREATE INDEX "ml_service_invoices_referenceMonth_idx" ON "ml_service_invoices"("referenceMonth");

-- CreateIndex
CREATE INDEX "ml_ad_spend_listingCode_idx" ON "ml_ad_spend"("listingCode");

-- CreateIndex
CREATE INDEX "ml_ad_spend_periodStart_periodEnd_idx" ON "ml_ad_spend"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ml_ad_spend_listingCode_campaignName_periodStart_periodEnd_key" ON "ml_ad_spend"("listingCode", "campaignName", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "sefaz_documents_accessKey_idx" ON "sefaz_documents"("accessKey");

-- CreateIndex
CREATE INDEX "sefaz_documents_kind_idx" ON "sefaz_documents"("kind");

-- CreateIndex
CREATE INDEX "marketplace_sales_listingCode_idx" ON "marketplace_sales"("listingCode");

-- AddForeignKey
ALTER TABLE "fiscal_note_items" ADD CONSTRAINT "fiscal_note_items_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "fiscal_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
