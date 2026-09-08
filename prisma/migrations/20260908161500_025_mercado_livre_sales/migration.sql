/*
  Warnings:

  - You are about to drop the column `billingMonth` on the `marketplace_sales` table. All the data in the column will be lost.
  - You are about to drop the column `deliveredAt` on the `marketplace_sales` table. All the data in the column will be lost.
  - You are about to drop the column `releaseDate` on the `marketplace_sales` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "marketplace_sales_releaseDate_idx";

-- AlterTable
ALTER TABLE "marketplace_sales" DROP COLUMN "billingMonth",
DROP COLUMN "deliveredAt",
DROP COLUMN "releaseDate";

-- CreateTable
CREATE TABLE "mercado_livre_sales" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "shippingModality" TEXT,
    "customerName" TEXT,
    "quantity" INTEGER NOT NULL,
    "grossRevenue" DECIMAL(14,2) NOT NULL,
    "netTotal" DECIMAL(14,2) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "releaseDate" TIMESTAMP(3),
    "billingMonth" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercado_livre_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mercado_livre_sales_orderId_key" ON "mercado_livre_sales"("orderId");

-- CreateIndex
CREATE INDEX "mercado_livre_sales_releaseDate_idx" ON "mercado_livre_sales"("releaseDate");

-- CreateIndex
CREATE INDEX "mercado_livre_sales_saleDate_idx" ON "mercado_livre_sales"("saleDate");
