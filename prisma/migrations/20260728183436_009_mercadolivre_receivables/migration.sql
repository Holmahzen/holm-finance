-- CreateTable
CREATE TABLE "mercado_livre_receivables" (
    "id" TEXT NOT NULL,
    "today" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tomorrow" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "within7d" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "after7d" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercado_livre_receivables_pkey" PRIMARY KEY ("id")
);
