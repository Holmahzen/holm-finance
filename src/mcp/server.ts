import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { dashboardService } from "@/services/dashboardService";
import { dreService } from "@/services/dreService";
import { dreCompetenciaService } from "@/services/dreCompetenciaService";
import { cashFlowService } from "@/services/cashFlowService";
import { companyProjectionService } from "@/services/companyProjectionService";
import { productProfitabilityService } from "@/services/productProfitabilityService";
import { mercadoLivreReleaseService } from "@/services/mercadoLivreReleaseService";
import { alertsHubService } from "@/services/alertsHubService";
import { healthService } from "@/services/healthService";
import { monthChecklistService } from "@/services/monthChecklistService";
import { todayUTCInBrazil } from "@/lib/today";

/**
 * Servidor MCP do Holm Finance: deixa uma IA (Claude) consultar os números
 * reais do sistema. SÓ LEITURA de propósito — cada ferramenta chama o mesmo
 * método `get*` que a tela correspondente usa, e nenhuma grava nada. Ações
 * que gravam (ex.: "Aplicar na projeção" dos recebíveis) ficam de fora.
 */

const ano = z.number().int().min(2020).max(2100).optional().describe("Ano (ex.: 2026). Padrão: ano atual.");
const mes = z.number().int().min(1).max(12).optional().describe("Mês de 1 a 12. Padrão: mês atual.");

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/** Sem ano/mês, usa o mês corrente no fuso do Brasil — igual às telas. */
function periodo(a?: number, m?: number) {
  const hoje = todayUTCInBrazil();
  return { year: a ?? hoje.getUTCFullYear(), month: m ?? hoje.getUTCMonth() + 1 };
}

const readOnly = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: "holm-finance", version: "0.1.0" },
    {
      instructions:
        "Financeiro da Holm Confecções (confecção que vende no Mercado Livre e Shopee). " +
        "Valores em reais (BRL). Todas as ferramentas são somente leitura. " +
        "DRE de caixa = pelo pagamento; DRE de competência = pelo mês do fato gerador.",
    },
  );

  server.registerTool(
    "resumo_do_mes",
    {
      title: "Resumo do mês",
      description: "Painel inicial: saldos, entradas/saídas, a pagar/receber e indicadores do mês.",
      inputSchema: { ano, mes },
      annotations: readOnly,
    },
    async ({ ano, mes }) => {
      const p = periodo(ano, mes);
      return json(await dashboardService.getSummary(p.year, p.month));
    },
  );

  server.registerTool(
    "dre",
    {
      title: "DRE (regime de caixa)",
      description:
        "Demonstração de resultado do mês pelo regime de caixa: receita líquida, CMV, margem de contribuição, despesas fixas, resultado operacional e lucro líquido, com linhas por categoria.",
      inputSchema: { ano, mes },
      annotations: readOnly,
    },
    async ({ ano, mes }) => {
      const p = periodo(ano, mes);
      return json(await dreService.getDRE(p.year, p.month));
    },
  );

  server.registerTool(
    "dre_competencia",
    {
      title: "DRE (regime de competência)",
      description: "DRE do mês pelo regime de competência (mês do fato gerador, não do pagamento).",
      inputSchema: {
        mes: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe("Mês no formato AAAA-MM (ex.: 2026-09). Padrão: mês atual."),
      },
      annotations: readOnly,
    },
    async ({ mes }) => json(await dreCompetenciaService.getReport(mes)),
  );

  server.registerTool(
    "fluxo_de_caixa",
    {
      title: "Fluxo de caixa projetado",
      description:
        "Projeção dia a dia do saldo: lançamentos a pagar/receber, repasses do Mercado Livre, costura prevista, fatura Flex e compras planejadas. Mostra se e quando o caixa fica negativo.",
      inputSchema: {
        dias: z.number().int().min(1).max(180).optional().describe("Horizonte em dias a partir de hoje. Padrão: 30."),
        ate_fim_do_mes: z.boolean().optional().describe("Se true, projeta só até o fim do mês corrente (ignora `dias`)."),
      },
      annotations: readOnly,
    },
    async ({ dias, ate_fim_do_mes }) => json(await cashFlowService.getProjection(ate_fim_do_mes ? "month" : (dias ?? 30))),
  );

  server.registerTool(
    "projecao_empresa",
    {
      title: "Projeção da empresa",
      description: "Projeção consolidada de resultado e caixa da empresa para os próximos dias (tela Projeção 90 dias).",
      inputSchema: {
        dias: z.number().int().min(1).max(365).optional().describe("Horizonte em dias. Padrão: 90."),
      },
      annotations: readOnly,
    },
    async ({ dias }) => json(await companyProjectionService.getReport(dias ?? 90)),
  );

  server.registerTool(
    "lucratividade_produtos",
    {
      title: "Lucratividade por produto (SKU)",
      description:
        "Vendas por SKU com curva ABC, margem unitária, contribuição total, gasto de Ads e custo Full rateados por SKU, mais o resultado oficial do período. Linhas ordenadas por receita (maior primeiro). SKUs sem custo cadastrado aparecem sem margem.",
      inputSchema: {
        ano,
        mes: z.number().int().min(1).max(12).optional().describe("Mês de 1 a 12. Sem mês, considera o ano inteiro."),
        limite: z.number().int().min(1).max(500).optional().describe("Máximo de SKUs retornados. Padrão: 50."),
      },
      annotations: readOnly,
    },
    async ({ ano, mes, limite }) => {
      const year = ano ?? todayUTCInBrazil().getUTCFullYear();
      const report = await productProfitabilityService.getReport(year, mes);
      const max = limite ?? 50;
      return json({
        ...report,
        totalSkus: report.rows.length,
        rows: report.rows.slice(0, max),
        ...(report.rows.length > max ? { aviso: `Mostrando ${max} de ${report.rows.length} SKUs; aumente \`limite\` para ver mais.` } : {}),
      });
    },
  );

  server.registerTool(
    "recebiveis_mercado_livre",
    {
      title: "Recebíveis do Mercado Livre",
      description:
        "Quanto o Mercado Livre vai repassar e quando (data real do Mercado Pago via hub, ou estimativa se o hub estiver fora). Inclui valores em mediação e sem data de liberação.",
      inputSchema: {},
      annotations: { ...readOnly, openWorldHint: true },
    },
    async () => json(await mercadoLivreReleaseService.getReport()),
  );

  server.registerTool(
    "alertas",
    {
      title: "Alertas financeiros",
      description: "Alertas consolidados: ponto de equilíbrio, sinais de saúde financeira, primeiro dia de caixa negativo e reserva de caixa.",
      inputSchema: {},
      annotations: readOnly,
    },
    async () => json(await alertsHubService.getAlerts()),
  );

  server.registerTool(
    "fechamento_do_mes",
    {
      title: "Checklist de fechamento do mês",
      description:
        "O que já foi importado e conferido no mês (extratos, vendas, Ads, Full, notas, PGDAS, conciliação, categorias, SKUs sem custo, avisos da DRE) e o que falta. Sem mês, o mês passado.",
      inputSchema: {
        mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Mês no formato AAAA-MM (ex.: 2026-09). Padrão: mês passado."),
      },
      annotations: readOnly,
    },
    async ({ mes }) => json(await monthChecklistService.getChecklist(mes)),
  );

  server.registerTool(
    "saude_financeira",
    {
      title: "Saúde financeira",
      description: "Evolução mensal dos indicadores de saúde financeira (tendência de receita, margem, resultado) nos últimos meses.",
      inputSchema: {
        meses: z.number().int().min(1).max(36).optional().describe("Quantos meses para trás. Padrão: 12."),
        ano,
        mes,
      },
      annotations: readOnly,
    },
    async ({ meses, ano, mes }) => json(await healthService.getReport(meses ?? 12, ano, mes)),
  );

  return server;
}
