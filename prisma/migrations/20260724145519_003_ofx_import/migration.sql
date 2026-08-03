-- CreateEnum
CREATE TYPE "OfxTrnType" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "ParsedMemoKind" AS ENUM ('PIX_DEBIT', 'PIX_CREDIT', 'CARD_PURCHASE', 'OTHER');

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "ledgerBalance" DECIMAL(14,2) NOT NULL,
    "ledgerBalanceDate" TIMESTAMP(3) NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_transactions" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "fitId" TEXT NOT NULL,
    "trnType" "OfxTrnType" NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "memo" TEXT NOT NULL,
    "parsedKind" "ParsedMemoKind" NOT NULL DEFAULT 'OTHER',
    "parsedDocument" TEXT,
    "parsedCounterpartyName" TEXT,
    "parsedCity" TEXT,
    "isSelfTransfer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imported_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_bankAccountId_fileHash_key" ON "import_batches"("bankAccountId", "fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "imported_transactions_bankAccountId_fitId_key" ON "imported_transactions"("bankAccountId", "fitId");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_transactions" ADD CONSTRAINT "imported_transactions_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imported_transactions" ADD CONSTRAINT "imported_transactions_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
