const MONTHS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
          : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}

export function PeriodFilter({
  year,
  month,
  onChange,
  years,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
  years: number[];
}) {
  return (
    <>
      <div className="no-print flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface px-4 py-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted">Ano</span>
          {years.map((y) => (
            <Pill key={y} label={String(y)} active={y === year} onClick={() => onChange(y, month)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted">Mês</span>
          {MONTHS.map((label, idx) => (
            <Pill
              key={label}
              label={label}
              active={idx + 1 === month}
              onClick={() => onChange(year, idx + 1)}
            />
          ))}
        </div>
      </div>
      <p className="hidden text-sm text-muted print:block">
        Período: {MONTHS[month - 1]}/{year}
      </p>
    </>
  );
}
