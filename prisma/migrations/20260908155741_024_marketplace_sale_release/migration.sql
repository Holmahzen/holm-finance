-- AlterTable
ALTER TABLE "marketplace_sales" ADD COLUMN     "billingMonth" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "releaseDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "marketplace_sales_releaseDate_idx" ON "marketplace_sales"("releaseDate");
