/**
 * Cliente do Holm Marketplace Hub — de onde vem a data REAL do repasse.
 *
 * O hub lê `money_release_date` da API do Mercado Pago, que é o único lugar em
 * que essa data existe: o relatório de vendas do Mercado Livre traz a data de
 * entrega, e o repasse acontece bem depois dela (medido nesta conta: mediana de
 * 10 dias, máximo 60). Sem o hub, este sistema estima a data — e a estimativa
 * erra por semanas.
 *
 * A integração é opcional de propósito. Sem `HUB_URL`/`HUB_TOKEN`, ou com o hub
 * fora do ar, o cálculo cai de volta na estimativa por data de entrega em vez
 * de quebrar a tela.
 */

export type HubRecebiveis = {
  fonte: string;
  geradoEm: string;
  ultimaSincronizacao: string | null;
  pagamentosNaBase: number;
  dias: { data: string; qtd: number; liquido: number }[];
  emMediacao: { qtd: number; valor: number };
  semDataDeLiberacao: { qtd: number; valor: number };
};

/** Curto de propósito: a tela não pode ficar pendurada esperando o hub. */
const TIMEOUT_MS = 8_000;

export type HubResultado =
  | { ok: true; dados: HubRecebiveis }
  | { ok: false; motivo: "nao-configurado" | "indisponivel"; detalhe?: string };

export async function buscarRecebiveisDoHub(): Promise<HubResultado> {
  const base = process.env.HUB_URL;
  const token = process.env.HUB_TOKEN;

  if (!base || !token) return { ok: false, motivo: "nao-configurado" };

  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/integracao/recebiveis`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return {
        ok: false,
        motivo: "indisponivel",
        detalhe: `hub respondeu ${res.status}${texto ? `: ${texto.slice(0, 120)}` : ""}`,
      };
    }

    return { ok: true, dados: (await res.json()) as HubRecebiveis };
  } catch (e) {
    return {
      ok: false,
      motivo: "indisponivel",
      detalhe: e instanceof Error ? e.message : "falha ao falar com o hub",
    };
  }
}

export type PagamentoDoPedido = {
  mpPaymentId: string;
  mlOrderId: string | null;
  status: string;
  statusDetail: string | null;
  dateApproved: string | null;
  moneyReleaseDate: string | null;
  moneyReleaseStatus: string | null;
  netReceivedAmount: number;
  transactionAmount: number;
};

export type HubPedidoResultado =
  | { ok: true; encontrado: true; pagamentos: PagamentoDoPedido[] }
  | { ok: true; encontrado: false }
  | { ok: false; motivo: "nao-configurado" | "indisponivel"; detalhe?: string };

/** Busca o repasse de UM pedido específico — usado pela busca manual da tela. */
export async function buscarPedidoNoHub(numeroPedido: string): Promise<HubPedidoResultado> {
  const base = process.env.HUB_URL;
  const token = process.env.HUB_TOKEN;

  if (!base || !token) return { ok: false, motivo: "nao-configurado" };

  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/api/integracao/recebiveis/pedido/${encodeURIComponent(numeroPedido)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return {
        ok: false,
        motivo: "indisponivel",
        detalhe: `hub respondeu ${res.status}${texto ? `: ${texto.slice(0, 120)}` : ""}`,
      };
    }

    const dados = (await res.json()) as { encontrado: boolean; pagamentos: PagamentoDoPedido[] };
    if (!dados.encontrado) return { ok: true, encontrado: false };
    return { ok: true, encontrado: true, pagamentos: dados.pagamentos };
  } catch (e) {
    return {
      ok: false,
      motivo: "indisponivel",
      detalhe: e instanceof Error ? e.message : "falha ao falar com o hub",
    };
  }
}
