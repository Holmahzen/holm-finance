-- AlterTable
ALTER TABLE "entries" ADD COLUMN     "creditCardPurchaseId" TEXT,
ADD COLUMN     "installmentNumber" INTEGER;

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_purchases" (
    "id" TEXT NOT NULL,
    "creditCardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "installments" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "counterpartyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_card_purchases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "entries" ADD CONSTRAINT "entries_creditCardPurchaseId_fkey" FOREIGN KEY ("creditCardPurchaseId") REFERENCES "credit_card_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "counterparties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
