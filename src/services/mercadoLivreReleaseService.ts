import { mercadoLivreSaleRepository } from "@/repositories/mercadoLivreSaleRepository";
import { mercadoLivreReceivableService } from "@/services/mercadoLivreReceivableService";
import { buscarRecebiveisDoHub, type HubRecebiveis } from "@/services/hubRecebiveisClient";
import {
  computeReleaseSchedule,
  computeScheduleFromDays,
  RELEASE_DELAY_DAYS,
  startOfUTCDay,
  type ReleaseBuckets,
  type ReleaseSchedule,
} from "@/domain/mercadoLivreReleases";

/**
 * De onde veio o calendário.
 *
 * `mercado-pago` é a data REAL do repasse, lida pelo hub. `planilha` é a
 * estimativa por data de entrega, que erra por semanas — serve só enquanto o
 * hub não estiver disponível.
 */
export type FonteRecebiveis = "mercado-pago" | "planilha";

export type ReleaseReport = {
  fonte: FonteRecebiveis;
  /** Por que caiu na planilha, quando caiu. Null quando veio do hub. */
  motivoFallback: string | null;
  /** Só faz sentido na estimativa: dias somados à entrega. Null com dado real. */
  releaseDelayDays: number | null;
  /** Quando o hub concluiu a última sincronização de pagamentos. */
  ultimaSincronizacao: string | null;
  /** Vendas (planilha) ou pagamentos (hub) que entraram na conta. */
  salesCount: number;
  withDeliveryDate: number;
  lastImportedAt: string | null;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  /** Dias entre o dado mais recente da fonte e hoje — a tela avisa se envelheceu. */
  daysSinceLastSale: number | null;
  /** A partir de que dia a tela lista o calendário. Os totais somam tudo, mas
   * mostrar cada repasse desde sempre não ajuda a planejar caixa: com o dado
   * real são meses de repasses já liberados. Calculado aqui porque depende do
   * "hoje", que a tela não pode ler durante o render. */
  janelaInicio: string;
  diasDeHistorico: number;
  days: {
    date: string;
    count: number;
    amount: number;
    cumulative: number;
    released: boolean;
  }[];
  releasedTotal: number;
  scheduledTotal: number;
  awaitingDelivery: { count: number; amount: number };
  atRisk: { count: number; amount: number };
  noCashCount: number;
  total: number;
  buckets: ReleaseBuckets;
  /** Os quatro valores gravados hoje em MercadoLivreReceivable, pra tela
   * poder mostrar a diferença antes de sobrescrever. */
  saved: ReleaseBuckets;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Quantos dias de repasse ja liberado a tela mostra antes de hoje. */
const DIAS_DE_HISTORICO = 14;

function janelaInicio(today: Date): string {
  return new Date(startOfUTCDay(today).getTime() - DIAS_DE_HISTORICO * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function diasAte(referencia: Date | null, today: Date): number | null {
  if (!referencia) return null;
  return Math.floor(
    (startOfUTCDay(today).getTime() - startOfUTCDay(referencia).getTime()) / MS_PER_DAY,
  );
}

function serializar(schedule: ReleaseSchedule) {
  return schedule.days.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    count: d.count,
    amount: d.amount,
    cumulative: d.cumulative,
    released: d.released,
  }));
}

async function buckesSalvos(): Promise<ReleaseBuckets> {
  const saved = await mercadoLivreReceivableService.get();
  return {
    today: toNumber(saved.today),
    tomorrow: toNumber(saved.tomorrow),
    within7d: toNumber(saved.within7d),
    after7d: toNumber(saved.after7d),
  };
}

/** Calendário com a data real do repasse, vinda do Mercado Pago via hub. */
function montarDoHub(dados: HubRecebiveis, today: Date, saved: ReleaseBuckets): ReleaseReport {
  const schedule = computeScheduleFromDays(
    dados.dias.map((d) => ({
      date: new Date(`${d.data}T00:00:00.000Z`),
      count: d.qtd,
      amount: d.liquido,
    })),
    today,
    {
      awaitingDelivery: {
        count: dados.semDataDeLiberacao.qtd,
        amount: dados.semDataDeLiberacao.valor,
      },
      atRisk: { count: dados.emMediacao.qtd, amount: dados.emMediacao.valor },
    },
  );

  const sincronizado = dados.ultimaSincronizacao ? new Date(dados.ultimaSincronizacao) : null;

  return {
    fonte: "mercado-pago",
    motivoFallback: null,
    releaseDelayDays: null,
    ultimaSincronizacao: dados.ultimaSincronizacao,
    salesCount: dados.pagamentosNaBase,
    withDeliveryDate: dados.dias.reduce((s, d) => s + d.qtd, 0),
    lastImportedAt: dados.ultimaSincronizacao,
    firstSaleDate: dados.dias[0]?.data ?? null,
    lastSaleDate: dados.dias.at(-1)?.data ?? null,
    // aqui "envelheceu" é sobre a SINCRONIZAÇÃO, não sobre a última venda: o
    // calendário do hub olha para frente, então o que importa é há quanto tempo
    // ele foi atualizado.
    daysSinceLastSale: diasAte(sincronizado, today),
    janelaInicio: janelaInicio(today),
    diasDeHistorico: DIAS_DE_HISTORICO,
    days: serializar(schedule),
    releasedTotal: schedule.releasedTotal,
    scheduledTotal: schedule.scheduledTotal,
    awaitingDelivery: schedule.awaitingDelivery,
    atRisk: schedule.atRisk,
    noCashCount: schedule.noCashCount,
    total: schedule.total,
    buckets: schedule.buckets,
    saved,
  };
}

/** Plano B: estimativa por data de entrega, a partir da planilha importada. */
async function montarDaPlanilha(
  today: Date,
  saved: ReleaseBuckets,
  motivoFallback: string | null,
): Promise<ReleaseReport> {
  const [sales, importSummary] = await Promise.all([
    mercadoLivreSaleRepository.findAllForSchedule(),
    mercadoLivreSaleRepository.getImportSummary(),
  ]);

  const schedule = computeReleaseSchedule(
    sales.map((s) => ({
      status: s.status,
      netRevenue: toNumber(s.netTotal),
      deliveredAt: s.deliveredAt,
    })),
    today,
  );

  return {
    fonte: "planilha",
    motivoFallback,
    releaseDelayDays: RELEASE_DELAY_DAYS,
    ultimaSincronizacao: null,
    salesCount: sales.length,
    withDeliveryDate: sales.filter((s) => s.deliveredAt !== null).length,
    lastImportedAt: importSummary.lastImportedAt?.toISOString() ?? null,
    firstSaleDate: importSummary.firstSaleDate?.toISOString().slice(0, 10) ?? null,
    lastSaleDate: importSummary.lastSaleDate?.toISOString().slice(0, 10) ?? null,
    daysSinceLastSale: diasAte(importSummary.lastSaleDate, today),
    janelaInicio: janelaInicio(today),
    diasDeHistorico: DIAS_DE_HISTORICO,
    days: serializar(schedule),
    releasedTotal: schedule.releasedTotal,
    scheduledTotal: schedule.scheduledTotal,
    awaitingDelivery: schedule.awaitingDelivery,
    atRisk: schedule.atRisk,
    noCashCount: schedule.noCashCount,
    total: schedule.total,
    buckets: schedule.buckets,
    saved,
  };
}

export const mercadoLivreReleaseService = {
  /**
   * Prefere a data real do Mercado Pago; cai na estimativa por entrega só se o
   * hub não estiver configurado ou não responder. O relatório sempre diz qual
   * das duas foi usada — a diferença entre elas é de semanas.
   */
  async getReport(today: Date = new Date()): Promise<ReleaseReport> {
    const [hub, saved] = await Promise.all([buscarRecebiveisDoHub(), buckesSalvos()]);

    if (hub.ok) return montarDoHub(hub.dados, today, saved);

    const motivo =
      hub.motivo === "nao-configurado"
        ? "hub não configurado (falta HUB_URL/HUB_TOKEN)"
        : `hub indisponível — ${hub.detalhe ?? "sem detalhe"}`;

    return montarDaPlanilha(today, saved, motivo);
  },

  /**
   * Grava os quatro baldes calculados em MercadoLivreReceivable, que é de
   * onde a projeção de fluxo de caixa e o balanço patrimonial leem. Substitui
   * a digitação manual em Início — por isso é uma ação explícita da tela, e
   * não um efeito colateral da importação: quem confere os números decide
   * quando eles passam a valer.
   */
  async syncToReceivable(today: Date = new Date()) {
    const report = await this.getReport(today);
    await mercadoLivreReceivableService.update({
      today: report.buckets.today,
      tomorrow: report.buckets.tomorrow,
      within7d: report.buckets.within7d,
      after7d: report.buckets.after7d,
    });
    return report.buckets;
  },
};
