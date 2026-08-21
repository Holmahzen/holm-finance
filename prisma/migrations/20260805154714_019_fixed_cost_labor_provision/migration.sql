-- AlterTable
ALTER TABLE "fixed_costs" ADD COLUMN     "laborProvisionEligible" BOOLEAN NOT NULL DEFAULT false;

-- DataMigration: marca como elegível pra provisão de 13º/férias os custos
-- fixos já classificados como Salarios ou Pró-labore, exceto prestadores
-- externos (ex.: "Léo Assessoria", que não é CLT).
UPDATE "fixed_costs" fc
SET "laborProvisionEligible" = true
FROM "categories" c
WHERE fc."categoryId" = c."id"
  AND c."name" IN ('Salarios', 'Pró-labore')
  AND fc."description" NOT ILIKE '%assessoria%';
