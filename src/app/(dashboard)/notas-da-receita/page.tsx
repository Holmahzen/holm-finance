"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";

type Pending = {
  nsu: string;
  accessKey: string | null;
  issuerName: string | null;
  issuerDocument: string | null;
  issuedAt: string | null;
  total: number | null;
  situation: string | null;
};

type Report = {
  configured: boolean;
  counts: Record<string, number>;
  state: {
    lastNsu: string;
    maxNsu: string | null;
    lastRunAt: string | null;
    lastStatus: string | null;
    lastMessage: string | null;
  };
  pending: Pending[];
};

type SyncResult = {
  status: string;
  message: string;
  lastNsu: string;
  maxNsu: string;
  batches: number;
  newDocuments: number;
  importedNotes: number;
};

const SITUATION_LABEL: Record<string, string> = {
  "1": "autorizada",
  "2": "cancelada",
  "3": "denegada",
};

function formatCnpj(document: string | null): string {
  if (!document || document.length !== 14) return document ?? "—";
  const d = document;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function int(n: number): string {
  return n.toLocaleString("pt-BR");
}

export default function NotasDaReceitaPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/sefaz")
      .then((res) => res.json())
      .then((data: Report) => {
        if (!cancelled) setReport(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const res = await fetch("/api/sefaz");
    setReport(await res.json());
  }

  async function sync() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/sefaz", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Não foi possível consultar a Receita.");
      return;
    }
    setResult(body as SyncResult);
    await reload();
  }

  if (!report) return <p className="text-sm text-muted">Carregando...</p>;

  const { state, counts } = report;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Notas da Receita</h1>
        <p className="max-w-prose text-sm text-muted">
          Busca na Receita Federal os documentos emitidos <strong className="text-foreground">contra</strong> o
          CNPJ da Holm: notas de fornecedores, devoluções de clientes e eventos. Não precisa bipar nem pedir
          arquivo a ninguém.
        </p>
      </div>

      {!report.configured ? (
        <section className="flex flex-col gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
          <h2 className="font-medium text-amber-300">Falta configurar o certificado digital</h2>
          <p className="max-w-prose">
            A Receita só responde com o certificado A1 da empresa (arquivo .pfx ou .p12 com senha). Coloque
            estas duas linhas no arquivo <code>.env</code> do projeto e reinicie o servidor. A senha fica só aí
            — ela não aparece em nenhuma tela.
          </p>
          <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs text-foreground">
{`NFE_CERT_PATH="C:\\\\caminho\\\\do\\\\certificado.pfx"
NFE_CERT_PASSWORD="a senha do certificado"`}
          </pre>
          <p className="max-w-prose text-xs">
            Guarde o arquivo fora da pasta Downloads e sem a senha no nome: quem tem o arquivo e a senha
            consegue assinar documentos como a empresa.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl text-gold">Buscar documentos novos</h2>
              <p className="max-w-prose text-sm text-muted">
                A Receita entrega os documentos em ordem, por um número sequencial. O sistema guarda onde
                parou e continua daí. Ela limita as consultas por hora, então use com calma.
              </p>
            </div>
            <button
              type="button"
              onClick={sync}
              disabled={busy}
              className="shrink-0 rounded-md border border-gold px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-background disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted"
            >
              {busy ? "Consultando..." : "Buscar na Receita"}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {result && (
            <p className="text-sm text-emerald-400">
              {int(result.newDocuments)} documentos novos em {int(result.batches)}{" "}
              {result.batches === 1 ? "consulta" : "consultas"}
              {result.importedNotes > 0 && `, ${int(result.importedNotes)} notas importadas`}. Resposta da
              Receita: {result.status} — {result.message}
            </p>
          )}

          <dl className="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs tracking-wide text-muted uppercase">Último lido</dt>
              <dd className="text-foreground tabular-nums">{state.lastNsu}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-muted uppercase">Existe na Receita</dt>
              <dd className="text-foreground tabular-nums">{state.maxNsu ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-muted uppercase">Última consulta</dt>
              <dd className="text-foreground">
                {state.lastRunAt ? new Date(state.lastRunAt).toLocaleString("pt-BR") : "nunca"}
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-muted uppercase">Documentos guardados</dt>
              <dd className="text-foreground">
                {int(counts.resumo ?? 0)} resumos · {int(counts.nota ?? 0)} notas · {int(counts.evento ?? 0)} eventos
              </dd>
            </div>
          </dl>
          {state.lastMessage && (
            <p className="text-xs text-muted">
              Resposta da última consulta: {state.lastStatus} — {state.lastMessage}
            </p>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-xl text-foreground">
          Notas de fornecedor sem o XML completo ({report.pending.length})
        </h2>
        <p className="max-w-prose text-sm text-muted">
          A Receita entrega primeiro um <strong className="text-foreground">resumo</strong> de cada nota
          emitida contra a Holm: dá para saber quem emitiu, quando e quanto, mas não os itens. O XML inteiro
          só vem depois da manifestação (&quot;Ciência da Operação&quot;), que é assinada com o certificado —
          peça ao contador ou ao fornecedor enquanto isso. Quando o XML entrar em{" "}
          <Link href="/notas-fiscais" className="text-gold-soft underline underline-offset-2">
            Notas Fiscais
          </Link>
          , a nota sai desta lista sozinha.
        </p>

        {report.pending.length === 0 ? (
          <p className="text-sm text-muted">Nada pendente por aqui.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-3xl text-sm">
              <thead className="bg-surface">
                <tr className="text-xs tracking-wide text-muted uppercase">
                  <th className="px-4 py-3 text-left font-medium">Emitente</th>
                  <th className="px-4 py-3 text-left font-medium">CNPJ</th>
                  <th className="px-4 py-3 text-left font-medium">Emitida em</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-left font-medium">Situação</th>
                  <th className="px-4 py-3 text-left font-medium">Chave</th>
                </tr>
              </thead>
              <tbody>
                {report.pending.map((p) => (
                  <tr key={p.nsu} className="border-t border-border">
                    <td className="px-4 py-2 text-foreground">{p.issuerName ?? "—"}</td>
                    <td className="px-4 py-2 text-muted">{formatCnpj(p.issuerDocument)}</td>
                    <td className="px-4 py-2 text-muted">
                      {p.issuedAt ? new Date(p.issuedAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-2 text-right text-foreground tabular-nums">
                      {p.total == null ? "—" : formatBRL(p.total)}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {p.situation ? (SITUATION_LABEL[p.situation] ?? p.situation) : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted">{p.accessKey ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
