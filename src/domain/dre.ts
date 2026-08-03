export type DreGroup =
  | "RECEITA_BRUTA"
  | "DEDUCOES_RECEITA"
  | "CUSTO_VARIAVEL"
  | "DESPESA_PESSOAL"
  | "DESPESA_ADMINISTRATIVA"
  | "DESPESA_COMERCIAL"
  | "DESPESA_PRODUTIVA"
  | "RESULTADO_FINANCEIRO_RECEITA"
  | "RESULTADO_FINANCEIRO_DESPESA"
  | "NAO_OPERACIONAL_RECEITA"
  | "NAO_OPERACIONAL_DESPESA";

export type DreLine = { categoryId: string; name: string; total: number };

/**
 * Direção de caixa esperada por grupo. Um empréstimo entrando no banco é
 * "a receber" mas não é receita (é dívida); a categoria "Empréstimo" fica
 * classificada como despesa financeira, então essa entrada não deve ser
 * somada ali — só a saída (parcela paga) conta. Isso vale de forma geral:
 * cada grupo só soma lançamentos do tipo que ele realmente representa,
 * pra um lançamento do tipo "errado" numa categoria não inflar o grupo
 * oposto (ex.: entrada de empréstimo virando "despesa").
 */
export const DRE_GROUP_ENTRY_TYPE: Record<DreGroup, "PAYABLE" | "RECEIVABLE"> = {
  RECEITA_BRUTA: "RECEIVABLE",
  DEDUCOES_RECEITA: "PAYABLE",
  CUSTO_VARIAVEL: "PAYABLE",
  DESPESA_PESSOAL: "PAYABLE",
  DESPESA_ADMINISTRATIVA: "PAYABLE",
  DESPESA_COMERCIAL: "PAYABLE",
  DESPESA_PRODUTIVA: "PAYABLE",
  RESULTADO_FINANCEIRO_RECEITA: "RECEIVABLE",
  RESULTADO_FINANCEIRO_DESPESA: "PAYABLE",
  NAO_OPERACIONAL_RECEITA: "RECEIVABLE",
  NAO_OPERACIONAL_DESPESA: "PAYABLE",
};

export type DreGroupTotals = Partial<Record<DreGroup, DreLine[]>>;

export type DreSection = { lines: DreLine[]; total: number };

export type DreReport = {
  receitaBruta: DreSection;
  deducoes: DreSection;
  receitaLiquida: number;
  custoVariavel: DreSection;
  margemContribuicao: number;
  pessoal: DreSection;
  administrativa: DreSection;
  comercial: DreSection;
  produtiva: DreSection;
  despesasFixasTotal: number;
  resultadoOperacional: number;
  financeiroReceita: DreSection;
  financeiroDespesa: DreSection;
  resultadoFinanceiro: number;
  resultadoAntesImposto: number;
  naoOperacionalReceita: DreSection;
  naoOperacionalDespesa: DreSection;
  resultadoNaoOperacional: number;
  lucroLiquido: number;
};

function sumLines(lines: DreLine[] | undefined): number {
  return (lines ?? []).reduce((sum, l) => sum + l.total, 0);
}

/**
 * Monta a DRE completa (11 seções) a partir dos lançamentos já agrupados por
 * categoria/grupo. Segue exatamente a estrutura pedida:
 * Receita Líquida = Receita Bruta - Deduções
 * Margem de Contribuição = Receita Líquida - Custos Variáveis
 * Resultado Operacional = Margem de Contribuição - Despesas Fixas (pessoal+admin+comercial+produtiva)
 * Resultado Financeiro = Receitas financeiras - Despesas financeiras
 * Resultado antes do imposto = Resultado Operacional + Resultado Financeiro
 * Resultado não operacional = Receitas não operacionais - Despesas não operacionais
 * Lucro/Prejuízo líquido = Resultado antes do imposto + Resultado não operacional
 */
export function computeDre(byGroup: DreGroupTotals): DreReport {
  const section = (g: DreGroup): DreSection => {
    const lines = byGroup[g] ?? [];
    return { lines, total: sumLines(lines) };
  };

  const receitaBruta = section("RECEITA_BRUTA");
  const deducoes = section("DEDUCOES_RECEITA");
  const receitaLiquida = receitaBruta.total - deducoes.total;

  const custoVariavel = section("CUSTO_VARIAVEL");
  const margemContribuicao = receitaLiquida - custoVariavel.total;

  const pessoal = section("DESPESA_PESSOAL");
  const administrativa = section("DESPESA_ADMINISTRATIVA");
  const comercial = section("DESPESA_COMERCIAL");
  const produtiva = section("DESPESA_PRODUTIVA");
  const despesasFixasTotal = pessoal.total + administrativa.total + comercial.total + produtiva.total;
  const resultadoOperacional = margemContribuicao - despesasFixasTotal;

  const financeiroReceita = section("RESULTADO_FINANCEIRO_RECEITA");
  const financeiroDespesa = section("RESULTADO_FINANCEIRO_DESPESA");
  const resultadoFinanceiro = financeiroReceita.total - financeiroDespesa.total;

  const resultadoAntesImposto = resultadoOperacional + resultadoFinanceiro;

  const naoOperacionalReceita = section("NAO_OPERACIONAL_RECEITA");
  const naoOperacionalDespesa = section("NAO_OPERACIONAL_DESPESA");
  const resultadoNaoOperacional = naoOperacionalReceita.total - naoOperacionalDespesa.total;

  const lucroLiquido = resultadoAntesImposto + resultadoNaoOperacional;

  return {
    receitaBruta,
    deducoes,
    receitaLiquida,
    custoVariavel,
    margemContribuicao,
    pessoal,
    administrativa,
    comercial,
    produtiva,
    despesasFixasTotal,
    resultadoOperacional,
    financeiroReceita,
    financeiroDespesa,
    resultadoFinanceiro,
    resultadoAntesImposto,
    naoOperacionalReceita,
    naoOperacionalDespesa,
    resultadoNaoOperacional,
    lucroLiquido,
  };
}
