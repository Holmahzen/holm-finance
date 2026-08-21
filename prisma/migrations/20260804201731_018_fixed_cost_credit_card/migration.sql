-- AlterTable
ALTER TABLE "fixed_costs" ADD COLUMN     "creditCardId" TEXT;

-- AddForeignKey
ALTER TABLE "fixed_costs" ADD CONSTRAINT "fixed_costs_creditCardId_fkey" FOREIGN KEY ("creditCardId") REFERENCES "credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
