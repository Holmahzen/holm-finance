-- AlterEnum
ALTER TYPE "FixedCostFrequency" ADD VALUE 'BIWEEKLY_ROLLING';

-- AlterTable
ALTER TABLE "fixed_costs" ADD COLUMN     "anchorDate" TIMESTAMP(3);
