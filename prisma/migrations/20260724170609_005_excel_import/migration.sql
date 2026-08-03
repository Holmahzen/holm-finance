-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('OFX', 'XLSX');

-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "source" "ImportSource" NOT NULL DEFAULT 'OFX',
ALTER COLUMN "ledgerBalance" DROP NOT NULL,
ALTER COLUMN "ledgerBalanceDate" DROP NOT NULL;
