import { breakEvenService } from "@/services/breakEvenService";
import { healthService } from "@/services/healthService";
import { companyProjectionService } from "@/services/companyProjectionService";
import { cashReserveService } from "@/services/cashReserveService";
import { computeReserveAlerts } from "@/domain/cashReserve";
import { breakEvenInsightText } from "@/lib/breakEvenInsightText";
import { healthSignalText } from "@/lib/healthSignalText";
import { reserveAlertText } from "@/lib/reserveAlertText";
import { formatBRL } from "@/lib/format";

export type AlertItem = {
  id: string;
  severity: "critical" | "warning";
  message: string;
  source: string;
  href: string;
};

const SEVERITY_RANK: Record<AlertItem["severity"], number> = { critical: 0, warning: 1 };

function formatDateLong(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "long" });
}

/**
 * Junta num só lugar os alertas que hoje ficam espalhados em telas
 * diferentes (Ponto de Equilíbrio, Saúde Financeira, Projeção, Reserva de
 * Caixa) — reaproveita o texto/severidade que cada uma já calcula, só
 * filtrando "info" (que são análises positivas, não alertas de verdade) e
 * ordenando por severidade.
 */
export const alertsHubService = {
  async getAlerts(): Promise<AlertItem[]> {
    const [breakEven, health, projection, reserve] = await Promise.all([
      breakEvenService.getReport(),
      healthService.getReport(12),
      companyProjectionService.getReport(90),
      cashReserveService.getReport(),
    ]);

    const alerts: AlertItem[] = [];

    for (const insight of breakEven.insights) {
      if (insight.severity === "info") continue;
      alerts.push({
        id: `break-even-${insight.type}`,
        severity: insight.severity,
        message: breakEvenInsightText(insight),
        source: "Ponto de Equilíbrio",
        href: "/ponto-de-equilibrio",
      });
    }

    for (const signal of health.signals) {
      if (signal.severity === "info") continue;
      alerts.push({
        id: `health-${signal.type}`,
        severity: signal.severity,
        message: healthSignalText(signal),
        source: "Saúde Financeira",
        href: "/saude-financeira",
      });
    }

    if (projection.firstNegativeDay) {
      alerts.push({
        id: "cash-projection-negative",
        severity: "critical",
        message: `Saldo de caixa comprometido fica negativo em ${formatDateLong(new Date(projection.firstNegativeDay.date))}, chegando a ${formatBRL(projection.firstNegativeDay.runningBalance)}.`,
        source: "Projeção",
        href: "/projecao-90-dias",
      });
    }

    const reserveAlerts = computeReserveAlerts({
      tax: reserve.tax,
      contingency: reserve.contingency,
      thirteenth: reserve.thirteenth,
      vacation: reserve.vacation,
    });
    for (const ra of reserveAlerts) {
      const suffix = ra.type === "provision_behind_pace" ? `-${ra.category}` : "";
      alerts.push({
        id: `reserve-${ra.type}${suffix}`,
        severity: ra.severity,
        message: reserveAlertText(ra),
        source: "Reserva de Caixa",
        href: "/reserva-de-caixa",
      });
    }

    return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  },
};
