-- CreateEnum
CREATE TYPE "MlFullCostType" AS ENUM ('ARMAZENAMENTO', 'COLETA', 'ARMAZENAMENTO_PROLONGADO', 'RETIRADA');

-- CreateTable
CREATE TABLE "ml_full_costs" (
    "id" TEXT NOT NULL,
    "type" "MlFullCostType" NOT NULL,
    "costNumber" TEXT NOT NULL,
    "costDate" TIMESTAMP(3) NOT NULL,
    "sku" TEXT,
    "listingCode" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ml_full_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ml_full_costs_costNumber_key" ON "ml_full_costs"("costNumber");

-- CreateIndex
CREATE INDEX "ml_full_costs_sku_idx" ON "ml_full_costs"("sku");

-- CreateIndex
CREATE INDEX "ml_full_costs_costDate_idx" ON "ml_full_costs"("costDate");
