const BRAZIL_UTC_OFFSET_HOURS = 3;

/**
 * "Hoje" no fuso de Brasília (UTC-3, sem horário de verão desde 2019),
 * representado como meia-noite UTC — mesmo formato usado pelas datas do
 * Prisma/banco em todo o resto do sistema.
 *
 * O servidor (Vercel) roda em UTC puro, então `new Date()` sozinho vira o
 * dia ~3h antes da meia-noite real em Brasília — às 21h de um dia já
 * aparece como o dia seguinte no relógio do servidor. Isso empurrava
 * lançamentos pra "vencido"/"vence hoje" um dia adiantado (visto ao vivo:
 * 21h28 de 17/09 real virando "18/09" no Fluxo de Caixa). Sempre usar esta
 * função (não `new Date()` direto) sempre que o cálculo depender de "qual é
 * o dia de hoje", em vez de um timestamp exato.
 */
export function todayUTCInBrazil(): Date {
  const now = new Date();
  const brazilNow = new Date(now.getTime() - BRAZIL_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(Date.UTC(brazilNow.getUTCFullYear(), brazilNow.getUTCMonth(), brazilNow.getUTCDate()));
}
