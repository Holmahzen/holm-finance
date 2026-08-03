-- CreateEnum
CREATE TYPE "FixedCostFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY');

-- AlterTable
ALTER TABLE "fixed_costs" ADD COLUMN     "frequency" "FixedCostFrequency" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "secondDueDay" INTEGER,
ADD COLUMN     "weekday" INTEGER,
ALTER COLUMN "dueDay" DROP NOT NULL;
