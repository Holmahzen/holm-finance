/*
  Warnings:

  - You are about to drop the column `costOfGoods` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "costOfGoods",
ADD COLUMN     "aviamentosCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "costuraCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tecidoCost" DECIMAL(14,2) NOT NULL DEFAULT 0;
