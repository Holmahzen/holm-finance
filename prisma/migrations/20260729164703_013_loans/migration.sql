-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "principal" DECIMAL(14,2) NOT NULL,
    "monthlyRatePercent" DECIMAL(6,4) NOT NULL,
    "installments" INTEGER NOT NULL,
    "matchText" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
