-- CreateTable
CREATE TABLE "planned_purchases" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "categoryId" TEXT,
    "counterpartyId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planned_purchases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "planned_purchases" ADD CONSTRAINT "planned_purchases_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "planned_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
