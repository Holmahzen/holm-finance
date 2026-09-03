export type BalanceSheetLine = { label: string; amount: number };
export type BalanceSheetSectionTotals = { lines: BalanceSheetLine[]; total: number };

export type BalanceSheetInput = {
  ativoCirculante: BalanceSheetLine[];
  ativoNaoCirculante: BalanceSheetLine[];
  passivoCirculante: BalanceSheetLine[];
  passivoNaoCirculante: BalanceSheetLine[];
  /** Itens cadastrados manualmente na seção Patrimônio Líquido (ex.: Capital Social). */
  patrimonioLiquidoManual: BalanceSheetLine[];
};

export type BalanceSheetReport = {
  ativoCirculante: BalanceSheetSectionTotals;
  ativoNaoCirculante: BalanceSheetSectionTotals;
  ativoTotal: number;
  passivoCirculante: BalanceSheetSectionTotals;
  passivoNaoCirculante: BalanceSheetSectionTotals;
  passivoTotal: number;
  /** Ativo Total − Passivo Total — não é a soma dos itens de PL cadastrados, é o "plug" honesto sem livro contábil de partida dobrada. */
  patrimonioLiquido: number;
  capitalSocial: number;
  /** Patrimônio Líquido − Capital Social: o que a empresa acumulou (ou perdeu) além do que foi investido. */
  lucrosAcumulados: number;
};

function sumLines(lines: BalanceSheetLine[]): number {
  return lines.reduce((sum, l) => sum + l.amount, 0);
}

function section(lines: BalanceSheetLine[]): BalanceSheetSectionTotals {
  return { lines, total: sumLines(lines) };
}

/**
 * Monta o balanço patrimonial a partir das linhas já resolvidas (mistura de
 * dado automático — caixa, a receber/pagar, empréstimos — com itens
 * cadastrados manualmente — estoque, imobilizado, capital social). O
 * Patrimônio Líquido é sempre Ativo Total − Passivo Total: como o sistema
 * não é um livro contábil de partida dobrada, é o jeito honesto de fechar a
 * conta em vez de fingir uma precisão que os dados não sustentam.
 */
export function computeBalanceSheet(input: BalanceSheetInput): BalanceSheetReport {
  const ativoCirculante = section(input.ativoCirculante);
  const ativoNaoCirculante = section(input.ativoNaoCirculante);
  const ativoTotal = ativoCirculante.total + ativoNaoCirculante.total;

  const passivoCirculante = section(input.passivoCirculante);
  const passivoNaoCirculante = section(input.passivoNaoCirculante);
  const passivoTotal = passivoCirculante.total + passivoNaoCirculante.total;

  const patrimonioLiquido = ativoTotal - passivoTotal;
  const capitalSocial = sumLines(input.patrimonioLiquidoManual);
  const lucrosAcumulados = patrimonioLiquido - capitalSocial;

  return {
    ativoCirculante,
    ativoNaoCirculante,
    ativoTotal,
    passivoCirculante,
    passivoNaoCirculante,
    passivoTotal,
    patrimonioLiquido,
    capitalSocial,
    lucrosAcumulados,
  };
}
