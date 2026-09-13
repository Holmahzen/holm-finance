import { extractPdfText } from "@/parsers/nfse/pdfText";

/**
 * "Extrato do Simples Nacional" gerado pelo PGDAS-D. É o documento oficial da
 * apuração do mês: receita bruta do mês, receita dos últimos 12 meses (RBT12),
 * o faturamento de cada mês anterior, a divisão da receita por atividade e o
 * DAS separado por tributo — inclusive quanto foi de ICMS e de IPI.
 */

export type PgdasTaxes = {
  irpj: number;
  csll: number;
  cofins: number;
  pis: number;
  cpp: number;
  icms: number;
  ipi: number;
  iss: number;
  total: number;
};

export type PgdasActivityKind = "revenda" | "industrializacao" | "servico" | "outra";

export type PgdasActivity = {
  description: string;
  kind: PgdasActivityKind;
  revenue: number;
  taxes: PgdasTaxes;
};

export type ParsedPgdasExtract = {
  cnpjBase: string;
  companyName: string;
  /** "YYYY-MM" do período de apuração. */
  period: string;
  apuracaoNumber: string;
  rectifying: boolean;
  /** Receita bruta do mês (RPA). */
  revenue: number;
  rbt12: number;
  /** Receita acumulada no ano corrente. */
  rba: number;
  /** Receita do ano anterior. */
  rbaa: number;
  ceiling: number | null;
  sublimit: number | null;
  /** "Impedido de recolher ICMS/ISS no DAS": null quando o extrato não diz. */
  icmsBlocked: boolean | null;
  /** Faturamento dos meses anteriores declarados (mercado interno), "YYYY-MM". */
  previousRevenues: { month: string; revenue: number }[];
  activities: PgdasActivity[];
  /** Total do débito exigível da empresa, por tributo. */
  taxes: PgdasTaxes;
  das: {
    number: string | null;
    dueDate: Date | null;
    principal: number;
    fine: number;
    interest: number;
    total: number;
    /** false quando o extrato diz que não reconheceu pagamento; null quando não informa. */
    paid: boolean | null;
  };
};

const TAX_HEADER = /IRPJ\s+CSLL\s+COFINS\s+PIS\/Pasep\s+INSS\/CPP\s+ICMS\s+IPI\s+ISS\s+Total/i;
const MONEY = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

function money(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw: string | undefined): Date | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(raw ?? "");
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

/** A linha de valores que vem logo depois do cabeçalho "IRPJ CSLL ... Total". */
function taxesAfter(lines: string[], headerIndex: number): PgdasTaxes | null {
  for (let i = headerIndex + 1; i < Math.min(lines.length, headerIndex + 4); i++) {
    const values = lines[i].match(MONEY);
    if (values && values.length >= 9) {
      const [irpj, csll, cofins, pis, cpp, icms, ipi, iss, total] = values.slice(0, 9).map(money);
      return { irpj, csll, cofins, pis, cpp, icms, ipi, iss, total };
    }
  }
  return null;
}

/** "(RBT12) 3.610.558,66 0,00 3.610.558,66" → o último valor (total). */
function totalOfLine(text: string, label: RegExp): number {
  const line = text.split(/\r?\n/).find((l) => label.test(l));
  const values = line?.match(MONEY);
  return values ? money(values.at(-1)) : 0;
}

function kindOf(description: string): PgdasActivityKind {
  if (/revenda de mercadorias/i.test(description)) return "revenda";
  if (/industrializad/i.test(description)) return "industrializacao";
  if (/presta[çc][ãa]o de servi/i.test(description)) return "servico";
  return "outra";
}

const EMPTY_TAXES: PgdasTaxes = { irpj: 0, csll: 0, cofins: 0, pis: 0, cpp: 0, icms: 0, ipi: 0, iss: 0, total: 0 };

export function parsePgdasExtractText(text: string): ParsedPgdasExtract {
  if (!/Extrato do Simples Nacional/i.test(text) || !/Per[íi]odo de Apura[çc][ãa]o/i.test(text)) {
    throw new Error("não é um extrato do Simples Nacional (PGDAS-D)");
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  const periodMatch = /Per[íi]odo de Apura[çc][ãa]o \(PA\):\s*(\d{2})\/(\d{4})/i.exec(text);
  if (!periodMatch) throw new Error("extrato sem período de apuração");
  const period = `${periodMatch[2]}-${periodMatch[1]}`;

  // Meses anteriores: entre "2.2.1) Mercado Interno" e "2.2.2) Mercado Externo".
  const internalStart = text.search(/2\.2\.1\)\s*Mercado Interno/i);
  const internalEnd = text.search(/2\.2\.2\)\s*Mercado Externo/i);
  const internal = internalStart >= 0 ? text.slice(internalStart, internalEnd > internalStart ? internalEnd : undefined) : "";
  const previousRevenues = [...internal.matchAll(/(\d{2})\/(\d{4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})/g)].map((m) => ({
    month: `${m[2]}-${m[1]}`,
    revenue: money(m[3]),
  }));

  // Atividades: cada bloco começa em "Valor do Débito por Tributo para a Atividade".
  const activities: PgdasActivity[] = [];
  lines.forEach((line, index) => {
    if (!/^Valor do D[ée]bito por Tributo para a Atividade/i.test(line)) return;
    const revenueIndex = lines.findIndex((l, i) => i > index && /^Receita Bruta Informada/i.test(l));
    if (revenueIndex < 0) return;
    const description = lines.slice(index + 1, revenueIndex).join(" ").replace(/\s+/g, " ").trim();
    const headerIndex = lines.findIndex((l, i) => i > revenueIndex && TAX_HEADER.test(l));
    activities.push({
      description,
      kind: kindOf(description),
      revenue: money(lines[revenueIndex].match(MONEY)?.[0]),
      taxes: (headerIndex >= 0 && taxesAfter(lines, headerIndex)) || EMPTY_TAXES,
    });
  });

  // Total da empresa: o "Total do Débito Exigível" que vem depois de "4) Total Geral da Empresa".
  const totalSection = lines.findIndex((l) => /^4\)\s*Total Geral da Empresa/i.test(l));
  const exigibleIndex = lines.findIndex((l, i) => i > totalSection && /^Total do D[ée]bito Exig[íi]vel/i.test(l));
  const totalHeader = lines.findIndex((l, i) => i > exigibleIndex && TAX_HEADER.test(l));
  const taxes = (totalSection >= 0 && exigibleIndex >= 0 && taxesAfter(lines, totalHeader)) || EMPTY_TAXES;

  const dasSection = text.slice(Math.max(0, text.search(/6\)\s*Informa[çc][õo]es sobre DAS/i)));
  const dasValues = /Principal\s+([\d.,]+)\s+Multa\s+([\d.,]+)\s+Juros\s+([\d.,]+)\s+Total\s+([\d.,]+)/i.exec(dasSection);
  const paymentSection = /6\.2\)[^\n]*\n([^\n]*)/i.exec(dasSection)?.[1] ?? null;

  const blocked = /Impedido de recolher ICMS\/ISS no DAS:\s*(Sim|N[ãa]o)/i.exec(text)?.[1];

  return {
    cnpjBase: (/CNPJ B[áa]sico:\s*([\d.]+)/i.exec(text)?.[1] ?? "").replace(/\D/g, ""),
    companyName: /Nome Empresarial:\s*(.+?)(?:\s+Data de Abertura|$)/im.exec(text)?.[1]?.trim() ?? "",
    period,
    apuracaoNumber: /Informa[çc][õo]es da Apura[çc][ãa]o\s+(\d+)/i.exec(text)?.[1] ?? "",
    rectifying: /Apura[çc][ãa]o Retificadora/i.test(text),
    revenue: totalOfLine(text, /Receita Bruta do PA \(RPA\)/i),
    rbt12: totalOfLine(text, /^\s*\(RBT12\)/i),
    rba: totalOfLine(text, /\(RBA\)/i),
    rbaa: totalOfLine(text, /\(RBAA\)/i),
    ceiling: money(/Limite de receita bruta proporcionalizado\s+([\d.,]+)/i.exec(text)?.[1]) || null,
    sublimit: money(/Sublimite de Receita Anual \(R\$\):\s*([\d.,]+)/i.exec(text)?.[1]) || null,
    icmsBlocked: blocked ? /^sim$/i.test(blocked) : null,
    previousRevenues,
    activities,
    taxes,
    das: {
      number: /N[úu]mero:\s*(\d{10,})/i.exec(dasSection)?.[1] ?? null,
      dueDate: parseDate(/Data de Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(dasSection)?.[1]),
      principal: money(dasValues?.[1]),
      fine: money(dasValues?.[2]),
      interest: money(dasValues?.[3]),
      total: money(dasValues?.[4]),
      paid: paymentSection == null ? null : !/N[ãa]o foi reconhecido pagamento/i.test(paymentSection),
    },
  };
}

export async function parsePgdasExtractPdf(buffer: Buffer): Promise<ParsedPgdasExtract> {
  return parsePgdasExtractText(await extractPdfText(buffer));
}
