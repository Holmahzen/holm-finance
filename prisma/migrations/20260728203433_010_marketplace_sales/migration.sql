-- CreateTable
CREATE TABLE "sales_import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "duplicateCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_sales" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'Mercado Livre',
    "shippingModality" TEXT,
    "quantity" INTEGER NOT NULL,
    "grossRevenue" DECIMAL(14,2) NOT NULL,
    "netRevenue" DECIMAL(14,2) NOT NULL,
    "customerName" TEXT,
    "status" TEXT NOT NULL,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_import_batches_fileHash_key" ON "sales_import_batches"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_sales_orderId_key" ON "marketplace_sales"("orderId");

-- CreateIndex
CREATE INDEX "marketplace_sales_saleDate_idx" ON "marketplace_sales"("saleDate");

-- AddForeignKey
ALTER TABLE "marketplace_sales" ADD CONSTRAINT "marketplace_sales_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "sales_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
