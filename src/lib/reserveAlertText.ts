import { formatBRL } from "@/lib/format";
import type { ReserveAlert } from "@/domain/cashReserve";

const PROVISION_LABEL: Record<"thirteenth" | "vacation", string> = {
  thirteenth: "13º salário",
  vacation: "férias",
};

export function reserveAlertText(alert: ReserveAlert): string {
  switch (alert.type) {
    case "tax_due_soon_underfunded": {
      const missing = alert.target - alert.saved;
      const dueText = alert.daysUntilDue <= 0 ? "hoje" : `em ${alert.daysUntilDue} dia(s)`;
      return `O DAS vence ${dueText} e você tem ${formatBRL(alert.saved)} guardado de ${formatBRL(alert.target)} — faltam ${formatBRL(missing)}.`;
    }
    case "contingency_low":
      return `Reserva de imprevistos está em ${formatBRL(alert.saved)}, bem abaixo da meta de ${formatBRL(alert.target)} (menos de 10%).`;
    case "provision_behind_pace":
      return `Reserva de ${PROVISION_LABEL[alert.category]} está atrasada: já deveria ter acumulado ${formatBRL(alert.accruedSoFar)} este ano, mas só tem ${formatBRL(alert.saved)} guardado.`;
  }
}
