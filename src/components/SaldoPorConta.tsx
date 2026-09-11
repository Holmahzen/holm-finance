import { formatBRL } from "@/lib/format";

export type ContaSaldo = {
  id: string;
  name: string;
  balance: string | number;
  origem: "extrato" | "abertura";
  desde: string | null;
};

/** A partir de quantos dias um saldo deixa de ser "de hoje". */
const DIAS_ATE_ENVELHECER = 7;

function formatarData(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  // As datas de extrato são gravadas em meia-noite UTC (mesma convenção do
  // resto do sistema) — formatar sem fixar o fuso usa o fuso do navegador
  // (America/Sao_Paulo, UTC-3) e mostra o dia anterior ao real.
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/**
 * O saldo total dividido por banco.
 *
 * Existe porque um número só esconde diferenças que importam: dinheiro parado
 * numa conta de marketplace não tem a mesma disponibilidade que o da conta
 * operacional, e — o mais traiçoeiro — saldos vindos de extratos de datas bem
 * diferentes somam como se fossem todos de hoje. Por isso cada linha diz DE
 * ONDE veio o número e de QUANDO ele é; sem isso, separar por banco troca um
 * total honesto por vários números que aparentam precisão que não têm.
 *
 * `hoje` chega pronto de quem renderiza: ler a data durante o render torna o
 * componente impuro.
 */
export function SaldoPorConta({
  contas,
  hoje,
  titulo = "Saldo por conta",
}: {
  contas: ContaSaldo[];
  hoje: number;
  titulo?: string;
}) {
  if (contas.length === 0) return null;

  const ordenadas = [...contas].sort((a, b) => Number(b.balance) - Number(a.balance));
  const total = contas.reduce((s, c) => s + Number(c.balance), 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{titulo}</h3>
        <span className="font-serif text-lg text-gold">{formatBRL(total)}</span>
      </div>

      <div className="flex flex-col">
        {ordenadas.map((c) => {
          const data = formatarData(c.desde);
          const dias = c.desde
            ? Math.floor((hoje - new Date(c.desde).getTime()) / 86_400_000)
            : null;
          const velho = c.origem === "abertura" || (dias !== null && dias > DIAS_ATE_ENVELHECER);

          return (
            <div
              key={c.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/50 py-2 last:border-0"
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm text-foreground">{c.name}</span>
                <span className={`text-xs ${velho ? "text-amber-300" : "text-muted"}`}>
                  {c.origem === "extrato"
                    ? data
                      ? `extrato de ${data}${dias !== null && dias > DIAS_ATE_ENVELHECER ? ` · ${dias} dias atrás` : ""}`
                      : "extrato importado"
                    : data
                      ? `saldo digitado em ${data} · sem extrato`
                      : "saldo digitado · sem extrato"}
                </span>
              </div>
              <span className="text-sm text-foreground tabular-nums">
                {formatBRL(c.balance)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
