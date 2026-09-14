import type { DreGroup, DreLine, DreReport, DreSection } from "@/domain/dre";

/**
 * DRE por competência: o resultado do mês pela data das vendas, e não pela data
 * em que o dinheiro entrou no banco.
 *
 * - Receita: o faturamento das notas de venda do mês; sem notas, a receita
 *   declarada no PGDAS-D — que já vem líquida de devoluções, então elas não
 *   são descontadas de novo.
 * - DAS: o do extrato do próprio mês; sem extrato, estimado pela alíquota
 *   efetiva do extrato mais recente.
 * - Tarifas e fretes do marketplace: as notas de serviço do mês. Quando elas
 *   existem, substituem os lançamentos "Faturamento ML" e "Flex", que cobrem os
 *   mesmos custos — somar os dois contaria o custo duas vezes.
 * - Custo das peças e despesas: os lançamentos, como na DRE de caixa.
 */

export type CompetenceSource = "notas" | "pgdas" | "notas-servico" | "lancamentos" | "estimado";

export type CompetenceInput = {
  month: string;
  sales: { grossSales: number; returns: number; saleNotes: number } | null;
  pgdas: { revenue: number; das: number } | null;
  /** Alíquota efetiva do DAS no extrato mais recente, para estimar mês sem extrato. */
  latestDasRate: { rate: number; period: string } | null;
  services: { total: number; count: number; byCategory: { key: string; label: string; value: number }[] } | null;
  cash: DreReport;
  /** A DRE de caixa já troca tecido/costura/aviamentos pelo custo das peças vendidas? */
  cmvFromSoldPieces: boolean;
  /** Faturamento bruto das vendas importadas (relatório de vendas) cujas peças deram o custo. */
  soldGrossRevenue: number | null;
  /** Lançamentos pagos no mês que vêm da fatura do Mercado Livre (ver dreRepository). */
  marketplaceInvoiceEntries?: { group: DreGroup; category: string; description: string; amount: number }[];
};

/** Tipos de nota de serviço que trazem a fatura do Mercado Livre (tarifas, Ads, Full). */
export const ML_INVOICE_NOTE_KINDS = ["EBAZAR", "MERCADO_PAGO"];

/** Receita acima disso em relação às vendas importadas indica relatório de vendas incompleto. */
export const SALES_REPORT_TOLERANCE = 1.05;
/** Abaixo desta cobertura das vendas importadas o custo não é proporcionalizado, só sinalizado. */
export const MIN_SALES_COVERAGE_TO_SCALE = 0.5;
/** Custos + despesas abaixo desta fração da receita indicam lançamentos do mês incompletos. */
export const MIN_COST_SHARE = 0.05;
/** Linhas que a DRE de caixa calcula pelas peças vendidas (ver dreService). */
const PER_PIECE_SUFFIX = /\(peças vendidas\)\s*$/;

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type CompetenceLineKind = "receita" | "deducao" | "subtotal" | "custo" | "resultado";

export type CompetenceLine = {
  key: string;
  label: string;
  /** Com sinal: receitas e subtotais positivos quando favoráveis, custos negativos. */
  value: number;
  kind: CompetenceLineKind;
  source: CompetenceSource | null;
  note?: string;
  detail?: { label: string; value: number }[];
};

export type CompetenceDre = {
  month: string;
  available: boolean;
  revenueSource: "notas" | "pgdas" | null;
  receitaBruta: number;
  devolucoes: number;
  das: number;
  dasSource: CompetenceSource | null;
  receitaLiquida: number;
  cmv: number;
  tarifas: number;
  outrosVariaveis: number;
  margemContribuicao: number;
  despesasFixas: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  resultadoNaoOperacional: number;
  resultado: number;
  /** Lucro/prejuízo da DRE de caixa do mesmo mês, para comparar. */
  cashResult: number;
  /** Há custos ou despesas lançados no mês? Sem eles o "resultado" é só receita menos impostos. */
  hasCosts: boolean;
  lines: CompetenceLine[];
  /** O que existe nos lançamentos mas foi trocado por outra fonte nesta visão. */
  replaced: { name: string; value: number; replacedBy: string }[];
  /** Quando o mês tem notas e extrato: o faturamento das notas bate com o declarado? */
  conferencia: { notasLiquidas: number; pgdas: number; diferenca: number } | null;
  warnings: string[];
};

/**
 * Categorias de lançamento cujo custo as notas de serviço já trazem, e quais
 * tipos de nota cobrem cada uma: um mês só com a nota da transportadora não
 * pode apagar o lançamento das tarifas do Mercado Livre.
 */
export const REPLACED_BY_SERVICE_NOTES: Record<string, string[]> = {
  "faturamento ml": ["EBAZAR", "MERCADO_PAGO"],
  flex: ["FRETE"],
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function detailOf(lines: DreLine[]): { label: string; value: number }[] {
  return lines
    .filter((l) => Math.abs(l.total) >= 0.005)
    .map((l) => ({ label: l.name, value: l.total }))
    .sort((a, b) => b.value - a.value);
}

function monthLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${month}/${year}`;
}

export function buildCompetenceDre(input: CompetenceInput): CompetenceDre {
  const { cash, services } = input;
  const warnings: string[] = [];
  const replaced: CompetenceDre["replaced"] = [];

  // ---------- receita ----------
  let revenueSource: CompetenceDre["revenueSource"] = null;
  let receitaBruta = 0;
  let devolucoes = 0;
  let conferencia: CompetenceDre["conferencia"] = null;

  if (input.sales && input.sales.saleNotes > 0) {
    revenueSource = "notas";
    receitaBruta = input.sales.grossSales;
    devolucoes = input.sales.returns;
    if (input.pgdas) {
      const notasLiquidas = input.sales.grossSales - input.sales.returns;
      conferencia = { notasLiquidas, pgdas: input.pgdas.revenue, diferenca: notasLiquidas - input.pgdas.revenue };
    }
  } else if (input.pgdas) {
    revenueSource = "pgdas";
    receitaBruta = input.pgdas.revenue;
  }

  const available = revenueSource !== null;
  const cashResult = cash.lucroLiquido;
  if (!available) {
    return {
      month: input.month, available, revenueSource, receitaBruta: 0, devolucoes: 0, das: 0, dasSource: null,
      receitaLiquida: 0, cmv: 0, tarifas: 0, outrosVariaveis: 0, margemContribuicao: 0, despesasFixas: 0,
      resultadoOperacional: 0, resultadoFinanceiro: 0, resultadoNaoOperacional: 0, resultado: 0, cashResult,
      hasCosts: false, lines: [], replaced: [], conferencia: null,
      warnings: ["Este mês não tem notas de venda importadas nem extrato do PGDAS-D."],
    };
  }

  if (cash.receitaBruta.total > 0) {
    replaced.push({
      name: "Receitas recebidas no banco",
      value: cash.receitaBruta.total,
      replacedBy: revenueSource === "notas" ? "faturamento das notas de venda" : "receita declarada no PGDAS-D",
    });
  }

  // ---------- DAS ----------
  let das = 0;
  let dasSource: CompetenceSource | null = null;
  let dasNote: string | undefined;
  if (input.pgdas) {
    das = input.pgdas.das;
    dasSource = "pgdas";
    dasNote = "Apurado no extrato do próprio mês.";
  } else if (input.latestDasRate) {
    das = (receitaBruta - devolucoes) * input.latestDasRate.rate;
    dasSource = "estimado";
    dasNote = `Sem extrato deste mês: ${(input.latestDasRate.rate * 100).toFixed(2).replace(".", ",")}% da receita líquida, a alíquota do extrato de ${monthLabel(input.latestDasRate.period)}.`;
    warnings.push("O DAS deste mês é estimado. Importe o extrato do PGDAS-D na tela do Simples Nacional para usar o valor apurado.");
  } else {
    warnings.push("Sem extrato do PGDAS-D: o DAS não foi descontado. Importe os extratos na tela do Simples Nacional.");
  }
  if (cash.deducoes.total > 0) {
    replaced.push({ name: "DAS pago no mês (lançamentos)", value: cash.deducoes.total, replacedBy: "DAS da competência" });
  }
  const receitaLiquida = receitaBruta - devolucoes - das;

  // ---------- custos variáveis ----------
  // O custo das peças vem das vendas importadas; se elas não cobrem a receita do
  // mês, o custo fica proporcionalmente menor que a venda — ajusta na proporção.
  const comparableRevenue = receitaBruta - devolucoes;
  let cmv = cash.cmv.total;
  let cmvSource: CompetenceSource = "lancamentos";
  let cmvNote: string | undefined;
  const sold = input.soldGrossRevenue;
  // Só as linhas por peça vendida escalam; passadoria, embalagens etc. são o valor pago no mês.
  const perPiece = cash.cmv.lines
    .filter((l) => PER_PIECE_SUFFIX.test(l.name))
    .reduce((sum, l) => sum + l.total, 0);
  const salesCoverage = sold && comparableRevenue > 0 ? sold / comparableRevenue : null;
  const salesReportIncomplete =
    input.cmvFromSoldPieces && sold !== null && sold > 0 && perPiece > 0 && comparableRevenue > sold * SALES_REPORT_TOLERANCE;
  if (salesReportIncomplete && salesCoverage !== null && salesCoverage < MIN_SALES_COVERAGE_TO_SCALE) {
    // Com tão poucas vendas importadas, multiplicar o custo delas seria chute.
    warnings.push(
      `As vendas importadas cobrem só ${(salesCoverage * 100).toFixed(0)}% da receita: o custo das peças está muito abaixo do real e não foi ajustado. Importe o relatório de vendas do mês em Vendas.`,
    );
  } else if (salesReportIncomplete && sold) {
    const scaled = perPiece * (comparableRevenue / sold);
    cmv = cash.cmv.total - perPiece + scaled;
    cmvSource = "estimado";
    const share = ((sold / comparableRevenue) * 100).toFixed(0);
    cmvNote = `As vendas importadas somam ${brl(sold)} (${share}% da receita): o custo por peça delas, ${brl(perPiece)}, foi levado a ${brl(scaled)} na proporção da receita do mês.`;
    replaced.push({ name: "Custo das peças das vendas importadas", value: perPiece, replacedBy: "custo proporcional à receita do mês" });
    warnings.push(
      `As vendas importadas cobrem só ${share}% da receita: o custo das peças foi estimado na proporção. Importe o relatório de vendas completo do mês em Vendas para usar o custo real.`,
    );
  }
  const hasServices = !!services && services.count > 0;
  const tarifas = hasServices ? services!.total : 0;
  const serviceKinds = new Set(hasServices ? services!.byCategory.filter((c) => c.value > 0).map((c) => c.key) : []);
  // Lançamentos da fatura do ML espalhados em outras categorias (Mercado Ads,
  // "Fatura ML – Tarifas de envios Full" etc.): as notas do Ebazar/Mercado Pago
  // já trazem esses valores, então saem daqui um a um.
  const invoiceCovered = ML_INVOICE_NOTE_KINDS.some((kind) => serviceKinds.has(kind));
  const removedByGroup = new Map<DreGroup, Map<string, number>>();
  if (invoiceCovered) {
    for (const entry of input.marketplaceInvoiceEntries ?? []) {
      if (REPLACED_BY_SERVICE_NOTES[normalize(entry.category)]) continue; // a categoria inteira já sai abaixo
      if (Math.abs(entry.amount) < 0.005) continue;
      replaced.push({ name: `${entry.category} — ${entry.description}`, value: entry.amount, replacedBy: "notas de serviço do mês" });
      const byCategory = removedByGroup.get(entry.group) ?? new Map<string, number>();
      byCategory.set(entry.category, (byCategory.get(entry.category) ?? 0) + entry.amount);
      removedByGroup.set(entry.group, byCategory);
    }
  }
  const withoutInvoice = (section: DreSection, group: DreGroup): DreSection => {
    const removed = removedByGroup.get(group);
    if (!removed) return section;
    const removedTotal = [...removed.values()].reduce((sum, v) => sum + v, 0);
    return {
      lines: section.lines.map((l) => ({ ...l, total: l.total - (removed.get(l.name) ?? 0) })),
      total: section.total - removedTotal,
    };
  };
  const custoVariavel = withoutInvoice(cash.custoVariavel, "CUSTO_VARIAVEL");
  const pessoal = withoutInvoice(cash.pessoal, "DESPESA_PESSOAL");
  const administrativa = withoutInvoice(cash.administrativa, "DESPESA_ADMINISTRATIVA");
  const comercial = withoutInvoice(cash.comercial, "DESPESA_COMERCIAL");
  const produtiva = withoutInvoice(cash.produtiva, "DESPESA_PRODUTIVA");

  const variableLines = custoVariavel.lines.filter((l) => {
    const coveredBy = REPLACED_BY_SERVICE_NOTES[normalize(l.name)] ?? [];
    const isReplaced = coveredBy.some((kind) => serviceKinds.has(kind));
    if (isReplaced && Math.abs(l.total) >= 0.005) {
      replaced.push({ name: l.name, value: l.total, replacedBy: "notas de serviço do mês" });
    }
    return !isReplaced;
  });
  const outrosVariaveis = variableLines.reduce((sum, l) => sum + l.total, 0);
  if (!serviceKinds.has("EBAZAR")) {
    warnings.push(
      hasServices
        ? "Faltam as notas de serviço do Ebazar (tarifas de venda do Mercado Livre) neste mês: só entraram as de outros tipos, então as tarifas estão subestimadas e o resultado, inflado."
        : "Sem notas de serviço do Mercado Livre neste mês: as tarifas vêm dos lançamentos e ficam subestimadas, porque quase tudo é descontado direto do repasse.",
    );
  }
  if (!input.cmvFromSoldPieces) {
    warnings.push(
      "O custo de tecido, costura e aviamentos está pelo valor pago no mês, e não pelas peças vendidas: faltam custos cadastrados em Produtos.",
    );
  }
  const margemContribuicao = receitaLiquida - cmv - tarifas - outrosVariaveis;

  // ---------- despesas e resultado ----------
  const despesasFixas = pessoal.total + administrativa.total + comercial.total + produtiva.total;
  const resultadoOperacional = margemContribuicao - despesasFixas;
  const resultadoFinanceiro = cash.resultadoFinanceiro;
  const resultadoNaoOperacional = cash.resultadoNaoOperacional;
  const resultado = resultadoOperacional + resultadoFinanceiro + resultadoNaoOperacional;
  const launchedCosts = cash.cmv.total + cash.custoVariavel.total + despesasFixas;
  const hasCosts = launchedCosts > 0 && launchedCosts >= receitaBruta * MIN_COST_SHARE;
  if (!hasCosts) {
    const share = receitaBruta > 0 ? ((launchedCosts / receitaBruta) * 100).toFixed(1).replace(".", ",") : "0";
    warnings.unshift(
      `Este mês tem poucos custos lançados (${share}% da receita): o resultado mostra quase só receita menos DAS e tarifas, e não é o lucro do mês.`,
    );
  }
  warnings.push("Custos e despesas vêm dos lançamentos: os que não têm data de competência entram pela data de pagamento.");

  const lines: CompetenceLine[] = [
    {
      key: "receitaBruta",
      label: revenueSource === "notas" ? "Receita bruta de vendas" : "Receita declarada no PGDAS-D",
      value: receitaBruta,
      kind: "receita",
      source: revenueSource,
      note: revenueSource === "pgdas" ? "Sem notas de venda importadas: já vem líquida de devoluções." : undefined,
    },
    {
      key: "devolucoes",
      label: "(−) Devoluções",
      value: -devolucoes,
      kind: "deducao",
      source: revenueSource === "notas" ? "notas" : null,
      note: revenueSource === "pgdas" ? "Já descontadas na receita declarada." : undefined,
    },
    { key: "das", label: "(−) DAS — Simples Nacional", value: -das, kind: "deducao", source: dasSource, note: dasNote },
    { key: "receitaLiquida", label: "Receita líquida", value: receitaLiquida, kind: "subtotal", source: null },
    {
      key: "cmv",
      label: "(−) Custo das peças vendidas",
      value: -cmv,
      kind: "custo",
      source: cmvSource,
      note: cmvNote,
      detail: detailOf(cash.cmv.lines),
    },
    {
      key: "tarifas",
      label: "(−) Tarifas e fretes do marketplace",
      value: -tarifas,
      kind: "custo",
      source: hasServices ? "notas-servico" : null,
      note: hasServices ? undefined : "Sem notas de serviço neste mês — ver outros custos variáveis.",
      detail: hasServices ? services!.byCategory.map((c) => ({ label: c.label, value: c.value })) : undefined,
    },
    {
      key: "outrosVariaveis",
      label: "(−) Outros custos variáveis",
      value: -outrosVariaveis,
      kind: "custo",
      source: "lancamentos",
      detail: detailOf(variableLines),
    },
    { key: "margem", label: "Margem de contribuição", value: margemContribuicao, kind: "subtotal", source: null },
    { key: "pessoal", label: "(−) Despesas com pessoal", value: -pessoal.total, kind: "custo", source: "lancamentos", detail: detailOf(pessoal.lines) },
    { key: "administrativa", label: "(−) Despesas administrativas", value: -administrativa.total, kind: "custo", source: "lancamentos", detail: detailOf(administrativa.lines) },
    { key: "comercial", label: "(−) Despesas comerciais", value: -comercial.total, kind: "custo", source: "lancamentos", detail: detailOf(comercial.lines) },
    { key: "produtiva", label: "(−) Despesas produtivas", value: -produtiva.total, kind: "custo", source: "lancamentos", detail: detailOf(produtiva.lines) },
    { key: "resultadoOperacional", label: "Resultado operacional", value: resultadoOperacional, kind: "subtotal", source: null },
    { key: "financeiro", label: "(±) Resultado financeiro", value: resultadoFinanceiro, kind: "custo", source: "lancamentos" },
    { key: "naoOperacional", label: "(±) Resultado não operacional", value: resultadoNaoOperacional, kind: "custo", source: "lancamentos" },
    { key: "resultado", label: "Resultado do mês", value: resultado, kind: "resultado", source: null },
  ];

  return {
    month: input.month, available, revenueSource, receitaBruta, devolucoes, das, dasSource, receitaLiquida, cmv, tarifas,
    outrosVariaveis, margemContribuicao, despesasFixas, resultadoOperacional, resultadoFinanceiro, resultadoNaoOperacional,
    resultado, cashResult, hasCosts, lines, replaced, conferencia, warnings,
  };
}
