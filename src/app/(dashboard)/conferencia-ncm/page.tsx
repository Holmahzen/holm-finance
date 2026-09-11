"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type Flag = { code: string; severity: "alta" | "conferir"; message: string };

type NcmUse = {
  ncm: string;
  positionLabel: string;
  items: number;
  quantity: number;
  value: number;
  skus: string[];
  issuers: string[];
  lastSeen: string;
};

type Product = { name: string; items: number; value: number; ncms: NcmUse[]; flags: Flag[] };

type NcmSummary = {
  ncm: string;
  positionLabel: string;
  items: number;
  value: number;
  products: number;
  flaggedProducts: number;
};

type Report = {
  products: Product[];
  byNcm: NcmSummary[];
  totals: {
    products: number;
    flaggedProducts: number;
    value: number;
    flaggedValue: number;
    ncms: number;
    firstSale: string | null;
    lastSale: string | null;
  };
};

function formatNcm(ncm: string): string {
  return /^\d{8}$/.test(ncm) ? `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}` : ncm;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function int(n: number): string {
  return n.toLocaleString("pt-BR");
}

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function StatCard({ label, value, note, tone = "gold" }: { label: string; value: string; note?: string; tone?: "gold" | "alert" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-serif text-2xl ${tone === "alert" ? "text-amber-300" : "text-gold"}`}>{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Flag["severity"] }) {
  return (
    <span
      className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        severity === "alta" ? "bg-red-400/15 text-red-400" : "bg-amber-400/15 text-amber-300"
      }`}
    >
      {severity === "alta" ? "revisar" : "conferir"}
    </span>
  );
}

export default function ConferenciaNcmPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [onlyFlagged, setOnlyFlagged] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ncm-audit")
      .then((res) => res.json())
      .then((data: Report) => {
        if (!cancelled) setReport(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!report) return <p className="text-sm text-muted">Carregando...</p>;

  const { totals } = report;
  const term = search
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
  const visible = report.products.filter(
    (p) =>
      (!onlyFlagged || p.flags.length > 0) &&
      (term === "" ||
        p.name.includes(term) ||
        p.ncms.some((n) => n.ncm.startsWith(term.replace(/\D/g, "") || "#") || n.skus.some((s) => s.toUpperCase().includes(term)))),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Conferência de NCM</h1>
          <p className="max-w-prose text-sm text-muted">
            Cada produto vendido, com os NCMs que ele já usou nas notas e o que merece revisão. Feita para
            levar ao contador e corrigir o cadastro no Tiny.
          </p>
          {totals.firstSale && totals.lastSale && (
            <p className="mt-1 text-xs text-muted">
              Notas de venda de {formatDate(totals.firstSale)} a {formatDate(totals.lastSale)} · para ampliar,
              importe mais meses em{" "}
              <Link href="/notas-fiscais" className="text-gold-soft underline underline-offset-2">
                Notas Fiscais
              </Link>
            </p>
          )}
        </div>
        <PrintButton />
      </div>

      {totals.products === 0 ? (
        <p className="max-w-prose text-sm text-muted">
          Nenhuma nota de venda importada ainda. Importe os XMLs em{" "}
          <Link href="/notas-fiscais" className="text-gold-soft underline underline-offset-2">
            Notas Fiscais
          </Link>{" "}
          e volte aqui.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Produtos vendidos" value={int(totals.products)} note={`${formatBRL(totals.value)} em vendas`} />
            <StatCard
              label="Produtos com alerta"
              value={int(totals.flaggedProducts)}
              note={`${formatBRL(totals.flaggedValue)} · ${pct(totals.value > 0 ? totals.flaggedValue / totals.value : 0)} das vendas`}
              tone={totals.flaggedProducts > 0 ? "alert" : "gold"}
            />
            <StatCard label="NCMs diferentes" value={int(totals.ncms)} note="usados nas notas de venda" />
            <StatCard
              label="Produtos com vários NCMs"
              value={int(report.products.filter((p) => p.ncms.length > 1).length)}
              note="o mesmo produto, códigos diferentes"
              tone="alert"
            />
          </div>

          <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm text-muted">
            <h2 className="font-medium text-foreground">Como ler</h2>
            <p>
              <SeverityBadge severity="alta" />
              Quase certamente errado: o mesmo produto com mais de um NCM, código 6309 (artigos usados), peça
              masculina em posição feminina (ou o contrário), tecido plano como oxford ou tricoline no capítulo
              61 (que é de malha) ou malha no 62, e touca/chapéu fora do capítulo 65.
            </p>
            <p>
              <SeverityBadge severity="conferir" />
              Costuma estar em outra posição: saia, calça, camiseta, jaleco ou avental fora de onde essas peças
              normalmente ficam, e kits que misturam peças.
            </p>
            <p className="text-xs">
              As regras olham só o nome do produto. A classificação certa depende da composição do tecido, de ser
              malha ou tecido plano e de ser peça masculina ou feminina (peça unissex vai como feminina) — por
              isso esta lista aponta o que conferir, não substitui o contador.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <div className="no-print flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={onlyFlagged}
                  onChange={(e) => setOnlyFlagged(e.target.checked)}
                  className="accent-[var(--gold)]"
                />
                Só produtos com alerta
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto, SKU ou NCM"
                className="w-72 max-w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground placeholder:text-muted"
              />
              <span className="text-xs text-muted">
                {int(visible.length)} de {int(report.products.length)} produtos
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-3xl text-sm">
                <thead className="bg-surface">
                  <tr className="text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-3 text-left font-medium">Produto</th>
                    <th className="px-4 py-3 text-left font-medium">NCMs usados</th>
                    <th className="px-4 py-3 text-left font-medium">Alertas</th>
                    <th className="px-4 py-3 text-right font-medium">Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => (
                    <tr key={p.name} className="border-t border-border align-top">
                      <td className="max-w-64 px-4 py-3 text-foreground">{p.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          {p.ncms.map((n) => (
                            <div key={n.ncm}>
                              <span className="font-medium text-foreground tabular-nums">{formatNcm(n.ncm)}</span>
                              <span className="text-muted">
                                {" "}
                                · {int(n.items)} {n.items === 1 ? "item" : "itens"} · {formatBRL(n.value)}
                              </span>
                              <div className="text-xs text-muted">{n.positionLabel}</div>
                              <div className="text-xs text-muted">
                                emitido por {n.issuers.join(" / ")}
                                {n.skus.length > 0 &&
                                  ` · SKU ${n.skus.slice(0, 3).join(", ")}${n.skus.length > 3 ? ` +${n.skus.length - 3}` : ""}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-md px-4 py-3">
                        {p.flags.length === 0 ? (
                          <span className="text-xs text-emerald-400">nada a apontar</span>
                        ) : (
                          <ul className="flex flex-col gap-1.5 text-xs text-muted">
                            {p.flags.map((f, i) => (
                              <li key={`${f.code}-${i}`}>
                                <SeverityBadge severity={f.severity} />
                                {f.message}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground tabular-nums">{formatBRL(p.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">Resumo por NCM</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-2xl text-sm">
                <thead className="bg-surface">
                  <tr className="text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-3 text-left font-medium">NCM</th>
                    <th className="px-4 py-3 text-left font-medium">Posição</th>
                    <th className="px-4 py-3 text-right font-medium">Produtos</th>
                    <th className="px-4 py-3 text-right font-medium">Com alerta</th>
                    <th className="px-4 py-3 text-right font-medium">Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byNcm.map((n) => (
                    <tr key={n.ncm} className="border-t border-border">
                      <td className="px-4 py-2 font-medium text-foreground tabular-nums">{formatNcm(n.ncm)}</td>
                      <td className="px-4 py-2 text-muted">{n.positionLabel}</td>
                      <td className="px-4 py-2 text-right text-muted tabular-nums">{int(n.products)}</td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums ${n.flaggedProducts > 0 ? "text-amber-300" : "text-muted"}`}
                      >
                        {int(n.flaggedProducts)}
                      </td>
                      <td className="px-4 py-2 text-right text-foreground tabular-nums">{formatBRL(n.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
