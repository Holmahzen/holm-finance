import { formatBRL } from "@/lib/format";

type BarDatum = { name: string; total: string | number };

export function HorizontalBarChart({
  title,
  data,
  tone = "gold",
  emptyLabel = "Sem dados no período.",
}: {
  title: string;
  data: BarDatum[];
  tone?: "gold" | "positive" | "negative";
  emptyLabel?: string;
}) {
  const barColor =
    tone === "positive" ? "bg-emerald-500" : tone === "negative" ? "bg-red-400" : "bg-gold";

  const max = Math.max(1, ...data.map((d) => Math.abs(Number(d.total))));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {data.map((d) => {
            const pct = Math.max(2, (Math.abs(Number(d.total)) / max) * 100);
            return (
              <div key={d.name} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-xs text-muted" title={d.name}>
                  {d.name}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-4 flex-1 rounded-sm bg-background">
                    <div
                      className={`h-4 rounded-r ${barColor} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${d.name}: ${formatBRL(d.total)}`}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs text-foreground">
                    {formatBRL(d.total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
