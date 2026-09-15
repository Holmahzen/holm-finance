"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { decodeXml, isZip, readZip } from "@/lib/zipReader";

type Invoice = {
  id: string;
  providerName: string;
  providerDocument: string;
  serviceDescription: string;
  amount: string;
  issuedOn: string;
  referenceMonth: string;
  sourceFileName: string;
  entry: { category: { name: string } | null };
};

type XmlFile = { name: string; content: string };
type PdfFile = { name: string; base64: string };

type ImportResult = {
  files: number;
  newInvoices: number;
  existingInvoices: number;
  uncategorized: number;
  ignored: { reason: string; count: number; example: string }[];
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

async function collectFiles(files: File[]): Promise<{ xml: XmlFile[]; pdf: PdfFile[] }> {
  const xml: XmlFile[] = [];
  const pdf: PdfFile[] = [];
  const add = (name: string, data: Uint8Array) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".xml")) xml.push({ name, content: decodeXml(data) });
    else if (lower.endsWith(".pdf")) pdf.push({ name, base64: toBase64(data) });
  };
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isZip(bytes)) {
      for (const entry of await readZip(bytes)) add(entry.name, entry.data);
    } else {
      add(file.name, bytes);
    }
  }
  return { xml, pdf };
}

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const { xml, pdf } = await collectFiles(files);
      if (xml.length === 0 && pdf.length === 0) {
        setError("Nenhum XML nem PDF de nota de serviço nos arquivos escolhidos.");
        return;
      }
      const res = await fetch("/api/imports/service-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlFiles: xml, pdfFiles: pdf }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "A importação falhou.");
        return;
      }
      setResult(body as ImportResult);
      setFiles([]);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="no-print flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="font-serif text-xl text-gold">Importar notas de produção terceirizada</h2>
        <p className="max-w-prose text-sm text-muted">
          NFS-e (XML ou PDF/DANFSe) de prestador terceiro — cortador, costureira, facção — emitida contra a
          Holm (CNPJ da Regimar Souza Silva Ltda, o mesmo do Mercado Pago). Cada nota vira um lançamento
          pago de verdade, categorizado automaticamente quando a descrição do serviço bate com uma categoria
          conhecida (corte, costura, bordado...). Pode ser .zip, XML ou PDF soltos. Importar a mesma nota de
          novo não duplica.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".zip,.xml,.pdf"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm text-muted file:mr-3 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
        <button
          type="submit"
          disabled={files.length === 0 || busy}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {busy ? "Importando..." : "Importar"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <div className="rounded-lg border border-border bg-background p-4 text-sm">
          <ul className="flex flex-col gap-1">
            <li>Arquivos lidos: {result.files}</li>
            <li>Notas novas (viraram lançamento): {result.newInvoices}</li>
            <li>Já importadas antes: {result.existingInvoices}</li>
            {result.uncategorized > 0 && (
              <li className="text-amber-300">
                {result.uncategorized} nota(s) nova(s) sem categoria reconhecida — categorize manualmente em
                Lançamentos.
              </li>
            )}
            {result.ignored.map((i) => (
              <li key={i.reason} className="text-muted">
                {i.count}x ignorada(s): {i.reason} (ex.: {i.example})
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export default function NotasProducaoPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  async function load() {
    const res = await fetch("/api/imports/service-invoices");
    setInvoices(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const total = invoices?.reduce((s, i) => s + Number(i.amount), 0) ?? 0;

  const byMonth = new Map<string, number>();
  for (const i of invoices ?? []) {
    byMonth.set(i.referenceMonth, (byMonth.get(i.referenceMonth) ?? 0) + Number(i.amount));
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Notas de Produção Terceirizada</h1>
        <p className="max-w-prose text-sm text-muted">
          Mão de obra de produção (corte, costura, facção...) contratada de terceiros e paga direto pela
          conta usada pra receber do Mercado Livre — dinheiro que nunca passava pelo Holm Finance. Cada nota
          importada aqui vira despesa de verdade, categorizada por peça vendida junto com o resto do custo
          de mercadoria vendida.
        </p>
      </div>

      <ImportPanel onImported={load} />

      {invoices && invoices.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-6 rounded-lg border border-border bg-surface p-4">
            <div>
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Total importado</span>
              <p className="font-serif text-2xl text-gold">{formatBRL(total)}</p>
            </div>
            {[...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, value]) => (
              <div key={month}>
                <span className="text-xs font-medium tracking-wide text-muted uppercase">{month}</span>
                <p className="font-serif text-lg text-foreground">{formatBRL(value)}</p>
              </div>
            ))}
          </div>

          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 font-medium">Emitida em</th>
                <th className="py-2 font-medium">Prestador</th>
                <th className="py-2 font-medium">Serviço</th>
                <th className="py-2 font-medium">Categoria</th>
                <th className="py-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="border-b border-border/50">
                  <td className="py-2">
                    {new Date(i.issuedOn).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                  </td>
                  <td className="py-2">{i.providerName}</td>
                  <td className="py-2">{i.serviceDescription || "—"}</td>
                  <td className="py-2">
                    {i.entry.category?.name ?? <span className="text-amber-300">sem categoria</span>}
                  </td>
                  <td className="py-2 tabular-nums">{formatBRL(i.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
