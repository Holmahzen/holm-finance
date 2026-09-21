-- CreateTable
CREATE TABLE "ml_ad_spend_import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_ad_spend_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_full_cost_import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_full_cost_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_ad_spend_import_batches_fileHash_key" ON "ml_ad_spend_import_batches"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "ml_full_cost_import_batches_fileHash_key" ON "ml_full_cost_import_batches"("fileHash");
