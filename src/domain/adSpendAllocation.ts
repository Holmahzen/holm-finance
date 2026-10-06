/**
 * Um anúncio (MLB) do Mercado Livre costuma vender vários SKUs diferentes no
 * mesmo período — variações de tamanho/cor sob o mesmo código de anúncio.
 * O relatório de Ads só dá o investimento por anúncio, não por SKU, então
 * precisa ser dividido entre os SKUs que venderam sob aquele anúncio no
 * período — proporcional à receita bruta de cada um, já que é a métrica que
 * o resto da Lucratividade (curva ABC) também usa.
 */

export type SaleForAdAllocation = {
  sku: string;
  listingCode: string | null;
  grossRevenue: number;
};

export type AdSpendRowForAllocation = {
  listingCode: string;
  investimento: number;
};

export function allocateAdSpendBySku(
  sales: SaleForAdAllocation[],
  adSpendRows: AdSpendRowForAllocation[],
): Map<string, number> {
  const revenueByListingAndSku = new Map<string, Map<string, number>>();
  for (const s of sales) {
    if (!s.listingCode) continue;
    if (!revenueByListingAndSku.has(s.listingCode)) revenueByListingAndSku.set(s.listingCode, new Map());
    const bySku = revenueByListingAndSku.get(s.listingCode)!;
    bySku.set(s.sku, (bySku.get(s.sku) ?? 0) + s.grossRevenue);
  }

  const adSpendBySku = new Map<string, number>();
  for (const row of adSpendRows) {
    const bySku = revenueByListingAndSku.get(row.listingCode);
    if (!bySku || bySku.size === 0) continue;

    const totalRevenue = [...bySku.values()].reduce((sum, v) => sum + v, 0);
    // Se nenhum dos SKUs desse anúncio teve receita no período (ex.: só
    // cancelamento), divide igual entre eles em vez de descartar o gasto.
    for (const [sku, revenue] of bySku) {
      const share = totalRevenue > 0 ? revenue / totalRevenue : 1 / bySku.size;
      adSpendBySku.set(sku, (adSpendBySku.get(sku) ?? 0) + row.investimento * share);
    }
  }

  return adSpendBySku;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fração de uma linha do relatório de Ads que cai dentro de [start, end).
 * O relatório vale pro período que o usuário escolheu ao exportar ("Desde" e
 * "Até", ambos inclusivos): um relatório de agosto+setembro consultado em
 * setembro só pode contar a metade dele, não o investimento inteiro.
 * Considera o gasto distribuído igualmente pelos dias do relatório.
 */
export function overlapShare(periodStart: Date, periodEnd: Date, start: Date, end: Date): number {
  const rowStart = periodStart.getTime();
  const rowEnd = periodEnd.getTime() + DAY_MS; // "Até" é inclusivo
  const totalDays = Math.max(1, Math.round((rowEnd - rowStart) / DAY_MS));
  const overlap = Math.min(rowEnd, end.getTime()) - Math.max(rowStart, start.getTime());
  if (overlap <= 0) return 0;
  return Math.min(1, Math.round(overlap / DAY_MS) / totalDays);
}

export type AdReportPeriod = {
  listingCode: string;
  campaignName: string;
  periodStart: Date;
  periodEnd: Date;
};

/**
 * Fração de cada relatório de Ads que NÃO repete dias já cobertos por outro
 * relatório do mesmo anúncio e campanha, na mesma ordem da entrada.
 *
 * O Mercado Ads deixa exportar qualquer período, então é comum ter, por
 * exemplo, 01–17, 01–20 e 17–29 do mesmo mês. Somar os três contaria os dias
 * repetidos várias vezes — foi o que inflou o Ads de setembro/2026 em cerca de
 * R$ 8 mil. Aqui o relatório que termina mais tarde fica com os seus dias
 * inteiros, e os mais antigos ficam só com o que sobra; um relatório contido
 * inteiro em outro vale zero. Como o gasto é tratado como uniforme ao longo
 * dos dias (mesma premissa de `overlapShare`), multiplicar o investimento por
 * essa fração remove a repetição sem precisar de dado diário.
 */
export function ownedShareByReport(rows: AdReportPeriod[]): number[] {
  const shares: number[] = new Array(rows.length).fill(1);
  const dayOf = (d: Date) => Math.floor(d.getTime() / DAY_MS);

  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const key = `${r.listingCode}|${r.campaignName}`;
    const list = groups.get(key);
    if (list) list.push(i);
    else groups.set(key, [i]);
  });

  for (const indexes of groups.values()) {
    if (indexes.length < 2) continue;
    // Termina mais tarde primeiro; em empate, o mais longo (começa antes).
    const ordered = [...indexes].sort(
      (a, b) =>
        rows[b].periodEnd.getTime() - rows[a].periodEnd.getTime() ||
        rows[a].periodStart.getTime() - rows[b].periodStart.getTime(),
    );
    const claimed = new Set<number>();
    for (const i of ordered) {
      const first = dayOf(rows[i].periodStart);
      const last = Math.max(first, dayOf(rows[i].periodEnd));
      let owned = 0;
      for (let day = first; day <= last; day++) {
        if (!claimed.has(day)) {
          claimed.add(day);
          owned++;
        }
      }
      shares[i] = owned / (last - first + 1);
    }
  }

  return shares;
}
