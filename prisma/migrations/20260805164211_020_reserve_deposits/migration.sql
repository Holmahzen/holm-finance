-- CreateEnum
CREATE TYPE "ReserveCategory" AS ENUM ('THIRTEENTH', 'VACATION', 'CONTINGENCY');

-- CreateTable
CREATE TABLE "reserve_deposits" (
    "id" TEXT NOT NULL,
    "category" "ReserveCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reserve_deposits_pkey" PRIMARY KEY ("id")
);
