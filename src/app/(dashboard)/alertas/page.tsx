"use client";

import { useEffect, useState } from "react";
import { PrintButton } from "@/components/PrintButton";

type AlertItem = {
  id: string;
  severity: "critical" | "warning";
  message: string;
  source: string;
  href: string;
};

const SEVERITY_CARD_STYLE: Record<AlertItem["severity"], string> = {
  critical: "border-red-400/30 bg-red-400/[0.06] hover:border-red-400/60",
  warning: "border-amber-400/30 bg-amber-400/[0.06] hover:border-amber-400/60",
};

const SEVERITY_ACCENT: Record<AlertItem["severity"], string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
};

const SEVERITY_ICON_STYLE: Record<AlertItem["severity"], string> = {
  critical: "bg-red-400/15 text-red-400",
  warning: "bg-amber-400/15 text-amber-400",
};

const SEVERITY_LABEL: Record<AlertItem["severity"], string> = {
  critical: "Alerta",
  warning: "Atenção",
};

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3.5 21.5 20h-19L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9.5v4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  );
}

function AttentionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5v5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.3" r="1" fill="currentColor" />
    </svg>
  );
}

const SEVERITY_ICON: Record<AlertItem["severity"], typeof WarningIcon> = {
  critical: WarningIcon,
  warning: AttentionIcon,
};

function SummaryTile({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: "critical" | "warning";
}) {
  const Icon = SEVERITY_ICON[tone];
  const toneText = tone === "critical" ? "text-red-400" : "text-amber-400";
  return (
    <div
      className={`flex items-center gap-4 rounded-lg border p-4 ${
        tone === "critical" ? "border-red-400/30 bg-red-400/[0.06]" : "border-amber-400/30 bg-amber-400/[0.06]"
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${SEVERITY_ICON_STYLE[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <span className={`block font-serif text-3xl ${toneText}`}>{count}</span>
        <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/alerts")
      .then((res) => res.json())
      .then((data) => {
        setAlerts(data);
        setLoading(false);
      });
  }, []);

  const criticalCount = alerts?.filter((a) => a.severity === "critical").length ?? 0;
  const warningCount = alerts?.filter((a) => a.severity === "warning").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Central de Alertas</h1>
          <p className="no-print text-sm text-muted">
            Tudo que precisa da sua atenção, juntado num só lugar — margem, caixa, imposto e reservas.
            Análises positivas (o que já está indo bem) não aparecem aqui; pra ver essas, veja cada
            tela de origem.
          </p>
        </div>
        <PrintButton />
      </div>

      {loading || alerts === null ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-4 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-400">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path
                d="m5 12.5 4.5 4.5L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p className="text-sm text-emerald-400">Nenhum alerta no momento — tudo em dia.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SummaryTile count={criticalCount} label="Alertas" tone="critical" />
            <SummaryTile count={warningCount} label="Atenções" tone="warning" />
          </div>

          <div className="flex flex-col gap-3">
            {alerts.map((a) => {
              const Icon = SEVERITY_ICON[a.severity];
              return (
                <a
                  key={a.id}
                  href={a.href}
                  className={`group relative flex items-start gap-4 overflow-hidden rounded-lg border p-4 pl-5 text-sm transition ${SEVERITY_CARD_STYLE[a.severity]}`}
                >
                  <span className={`absolute inset-y-0 left-0 w-1 ${SEVERITY_ACCENT[a.severity]}`} />
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${SEVERITY_ICON_STYLE[a.severity]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tracking-wide uppercase">
                        {SEVERITY_LABEL[a.severity]}
                      </span>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                        {a.source}
                      </span>
                    </div>
                    <p className="text-foreground">{a.message}</p>
                  </div>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-foreground"
                  >
                    <path
                      d="m9 6 6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
