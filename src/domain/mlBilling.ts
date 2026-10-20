import { DomainError } from "@/domain/errors";

/**
 * Relatório de Faturamento do Mercado Livre: uma linha por tarifa cobrada (dezenas de milhares por
 * ciclo). O que interessa é o resumo por tipo de tarifa e se ela já foi descontada do repasse
 * ("Descontado da operação": Sim) ou vai na fatura a pagar (Não). O arquivo passa de 4,5 MB, então a
 * leitura é feita no navegador e só este resumo é enviado ao servidor.
 */
export type BillingDeducted = "SIM" | "NAO" | "NA";

export type BillingLine = { detail: string; deducted: BillingDeducted; count: number; amount: number };

export type BillingSummary = {
  /** "YYYY-MM-DD". Datas das tarifas do relatório (ciclo de faturamento). */
  periodStart: string;
  periodEnd: string;
  lines: BillingLine[];
};

const normalize = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

function toDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
  return null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function deductedOf(v: unknown): BillingDeducted {
  const n = normalize(v);
  if (n === "sim") return "SIM";
  if (n === "nao") return "NAO";
  return "NA";
}

/** `rows`: a aba do relatório como matriz (primeira linha da planilha = índice 0). */
export function summarizeMlBillingRows(rows: unknown[][]): BillingSummary {
  const headerIndex = rows.findIndex((r) => {
    const cells = r.map(normalize);
    return cells.includes("detalhe") && cells.includes("valor da tarifa");
  });
  if (headerIndex < 0) {
    throw new DomainError('Não reconheci o Relatório de Faturamento do Mercado Livre — esperava as colunas "Detalhe" e "Valor da tarifa".');
  }
  const header = rows[headerIndex].map(normalize);
  const col = (name: string) => header.indexOf(name);
  const iDetail = col("detalhe");
  const iDeducted = col("descontado da operacao");
  const iAmount = col("valor da tarifa");
  const iDate = col("data da tarifa");
  if (iDeducted < 0 || iDate < 0) {
    throw new DomainError('Faltam as colunas "Descontado da operação" ou "Data da tarifa" no relatório.');
  }

  const byKey = new Map<string, BillingLine>();
  let first: Date | null = null;
  let last: Date | null = null;
  for (const row of rows.slice(headerIndex + 1)) {
    const amount = Number(row[iAmount]);
    const detail = String(row[iDetail] ?? "").trim();
    if (row[iAmount] === "" || row[iAmount] == null || Number.isNaN(amount) || !detail) continue;
    const deducted = deductedOf(row[iDeducted]);
    const key = `${deducted}|${detail}`;
    const line = byKey.get(key) ?? { detail, deducted, count: 0, amount: 0 };
    line.count += 1;
    line.amount += amount;
    byKey.set(key, line);
    const d = toDate(row[iDate]);
    if (d) {
      if (!first || d < first) first = d;
      if (!last || d > last) last = d;
    }
  }
  if (byKey.size === 0 || !first || !last) {
    throw new DomainError("O relatório não tem nenhuma tarifa com valor e data.");
  }
  return {
    periodStart: iso(first),
    periodEnd: iso(last),
    lines: [...byKey.values()].map((l) => ({ ...l, amount: Math.round(l.amount * 100) / 100 })),
  };
}

export type BillingTotals = { billed: number; deducted: number; notApplicable: number; total: number };

export function billingTotals(lines: BillingLine[]): BillingTotals {
  const sum = (d: BillingDeducted) => Math.round(lines.filter((l) => l.deducted === d).reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const billed = sum("NAO");
  const deducted = sum("SIM");
  const notApplicable = sum("NA");
  return { billed, deducted, notApplicable, total: Math.round((billed + deducted + notApplicable) * 100) / 100 };
}

/** Grupo de custo do ML a que a tarifa pertence, para o resumo mensal. */
export function billingGroup(detail: string): "ads" | "full" | "frete" | "venda" | "pagamento" | "outros" {
  const d = normalize(detail);
  if (d.includes("publicidade") || d.includes("product ads")) return "ads";
  if (d.includes("full")) return "full";
  if (d.includes("envio") || d.includes("frete") || d.includes("devolucao")) return "frete";
  if (d.includes("vender") || d.includes("tarifa de venda")) return "venda";
  if (d.includes("cobrar") || d.includes("parcelamento") || d.includes("recebimento")) return "pagamento";
  return "outros";
}
