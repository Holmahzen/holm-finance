-- CreateEnum
CREATE TYPE "BalanceSheetSection" AS ENUM ('ATIVO_CIRCULANTE', 'ATIVO_NAO_CIRCULANTE', 'PASSIVO_CIRCULANTE', 'PASSIVO_NAO_CIRCULANTE', 'PATRIMONIO_LIQUIDO');

-- CreateTable
CREATE TABLE "balance_sheet_items" (
    "id" TEXT NOT NULL,
    "section" "BalanceSheetSection" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "balance_sheet_items_pkey" PRIMARY KEY ("id")
);
