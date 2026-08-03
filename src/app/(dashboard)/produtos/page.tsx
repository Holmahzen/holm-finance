"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { computeProductMargin } from "@/domain/breakEven";
import { PeriodFilter } from "@/components/PeriodFilter";

type UncostedSku = {
  sku: string;
  name: string;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
  revenueShare: number;
  cumulativeShare: number;
};

type ParsedProductRow = {
  sku: string;
  name: string;
  salePrice: number;
  tecidoCost: number;
  costuraCost: number;
  aviamentosCost: number;
};

type PreviewRow = ParsedProductRow & { action: "create" | "update" };
type ParseError = { line: number; message: string };

type Product = {
  id: string;
  name: string;
  sku: string | null;
  salePrice: string;
  tecidoCost: string;
  costuraCost: string;
  aviamentosCost: string;
  marketplaceFee: string;
  shippingCost: string;
  packagingCost: string;
  avgMonthlyQuantity: number;
  isActive: boolean;
};

const now = new Date();

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [priorityYear, setPriorityYear] = useState(now.getFullYear());
  const [priorityMonth, setPriorityMonth] = useState(now.getMonth() + 1);
  const [priorityList, setPriorityList] = useState<UncostedSku[]>([]);
  const [priorityLoading, setPriorityLoading] = useState(true);

  const [pasteText, setPasteText] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [previewErrors, setPreviewErrors] = useState<ParseError[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ created: number; updated: number } | null>(
    null,
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [tecidoCost, setTecidoCost] = useState("");
  const [costuraCost, setCosturaCost] = useState("");
  const [aviamentosCost, setAviamentosCost] = useState("");
  const [marketplaceFeePercent, setMarketplaceFeePercent] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [packagingCost, setPackagingCost] = useState("");
  const [avgMonthlyQuantity, setAvgMonthlyQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [calculatingAvg, setCalculatingAvg] = useState(false);
  const [avgResult, setAvgResult] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/products");
    setProducts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadPriority() {
    setPriorityLoading(true);
    const res = await fetch(`/api/products/priority?year=${priorityYear}&month=${priorityMonth}`);
    setPriorityList(await res.json());
    setPriorityLoading(false);
  }

  useEffect(() => {
    loadPriority();
  }, [priorityYear, priorityMonth]);

  function fillFromPriority(item: UncostedSku) {
    setName(item.name);
    setSku(item.sku);
    setSalePrice((item.grossRevenue / item.quantity).toFixed(2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePreviewPaste() {
    if (!pasteText.trim()) return;
    setPreviewing(true);
    setApplyResult(null);
    const res = await fetch("/api/products/bulk-paste/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: pasteText }),
    });
    const body = await res.json();
    setPreviewRows(body.rows);
    setPreviewErrors(body.errors);
    setPreviewing(false);
  }

  async function handleApplyPaste() {
    if (!previewRows || previewRows.length === 0) return;
    setApplying(true);
    const res = await fetch("/api/products/bulk-paste", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: previewRows }),
    });
    const body = await res.json();
    setApplying(false);
    if (!res.ok) return;
    setApplyResult({ created: body.created, updated: body.updated });
    setPasteText("");
    setPreviewRows(null);
    setPreviewErrors([]);
    await Promise.all([load(), loadPriority()]);
  }

  function cancelPreview() {
    setPreviewRows(null);
    setPreviewErrors([]);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setSku("");
    setSalePrice("");
    setTecidoCost("");
    setCosturaCost("");
    setAviamentosCost("");
    setMarketplaceFeePercent("");
    setShippingCost("");
    setPackagingCost("");
    setAvgMonthlyQuantity("");
    setError(null);
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setName(p.name);
    setSku(p.sku ?? "");
    setSalePrice(p.salePrice);
    setTecidoCost(p.tecidoCost);
    setCosturaCost(p.costuraCost);
    setAviamentosCost(p.aviamentosCost);
    const price = Number(p.salePrice);
    setMarketplaceFeePercent(
      price > 0 ? ((Number(p.marketplaceFee) / price) * 100).toFixed(2) : "",
    );
    setShippingCost(p.shippingCost);
    setPackagingCost(p.packagingCost);
    setAvgMonthlyQuantity(String(p.avgMonthlyQuantity));
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function autoFillAvgQuantity() {
    setCalculatingAvg(true);
    setAvgResult(null);

    const res = await fetch("/api/products/avg-quantity");
    const { monthsCount, bySku }: { monthsCount: number; bySku: Record<string, number> } =
      await res.json();

    if (monthsCount === 0) {
      setAvgResult("Nenhuma venda importada ainda — não há como calcular a média.");
      setCalculatingAvg(false);
      return;
    }

    const matched = products.filter((p) => p.sku && bySku[p.sku] !== undefined);
    const unmatched = products.length - matched.length;

    await Promise.all(
      matched.map((p) =>
        fetch(`/api/products/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avgMonthlyQuantity: bySku[p.sku as string] }),
        }),
      ),
    );

    await load();
    setAvgResult(
      `${matched.length} produto(s) atualizado(s) com base em ${monthsCount} mês(es) de vendas importadas.` +
        (unmatched > 0 ? ` ${unmatched} sem SKU correspondente nas vendas (não alterado).` : ""),
    );
    setCalculatingAvg(false);
  }

  const marketplaceFeeComputed =
    salePrice && marketplaceFeePercent
      ? (Number(salePrice) * (Number(marketplaceFeePercent) / 100)).toFixed(2)
      : "0.00";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sku: sku || undefined,
        salePrice,
        tecidoCost: tecidoCost || undefined,
        costuraCost: costuraCost || undefined,
        aviamentosCost: aviamentosCost || undefined,
        marketplaceFee: marketplaceFeeComputed,
        shippingCost: shippingCost || undefined,
        packagingCost: packagingCost || undefined,
        avgMonthlyQuantity: avgMonthlyQuantity || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Não foi possível salvar.");
    } else {
      resetForm();
      await Promise.all([load(), loadPriority()]);
    }
    setSubmitting(false);
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Produtos</h1>
        <p className="text-sm text-muted">
          Cadastre o preço de venda, os custos variáveis (tecido, costura, aviamentos, comissão do
          Mercado Livre, frete, embalagem) e a quantidade média vendida por mês de cada produto.
          Esses dados alimentam o ponto de equilíbrio, o ranking de margem de contribuição e o
          custo das peças vendidas na DRE.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gold/50 bg-surface p-4">
        <div>
          <h2 className="font-serif text-lg text-foreground">Prioridade de cadastro</h2>
          <p className="text-sm text-muted">
            SKUs vendidos no período que ainda não têm custo de tecido/costura/aviamentos
            cadastrado, do que mais vende pro que menos vende. Clique num item pra preencher o
            formulário abaixo com nome, SKU e preço médio — só falta completar os 3 custos.
          </p>
        </div>

        <PeriodFilter
          year={priorityYear}
          month={priorityMonth}
          years={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]}
          onChange={(y, m) => {
            setPriorityYear(y);
            setPriorityMonth(m);
          }}
        />

        {priorityLoading ? (
          <p className="text-sm text-muted">Carregando...</p>
        ) : priorityList.length === 0 ? (
          <p className="text-sm text-emerald-400">
            Todos os SKUs vendidos nesse período já têm custo cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-1.5 font-medium">Produto</th>
                  <th className="py-1.5 font-medium">SKU</th>
                  <th className="py-1.5 font-medium">Qtd. vendida</th>
                  <th className="py-1.5 font-medium">Receita</th>
                  <th className="py-1.5 font-medium">% acumulado</th>
                  <th className="py-1.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {priorityList.slice(0, 25).map((item) => (
                  <tr key={item.sku} className="border-b border-border/50">
                    <td className="py-1.5 max-w-[260px] truncate" title={item.name}>
                      {item.name}
                    </td>
                    <td className="py-1.5 text-muted">{item.sku}</td>
                    <td className="py-1.5">{item.quantity}</td>
                    <td className="py-1.5">{formatBRL(item.grossRevenue)}</td>
                    <td className="py-1.5 text-gold">{(item.cumulativeShare * 100).toFixed(0)}%</td>
                    <td className="py-1.5">
                      <button
                        onClick={() => fillFromPriority(item)}
                        className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                      >
                        Preencher formulário
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {priorityList.length > 25 && (
              <p className="mt-2 text-xs text-muted">
                Mostrando os 25 primeiros de {priorityList.length} SKUs sem custo cadastrado.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gold/50 bg-surface p-4">
        <div>
          <h2 className="font-serif text-lg text-foreground">Colar tabela (cadastro em lote)</h2>
          <p className="text-sm text-muted">
            Cole direto da sua planilha (Excel/Sheets): uma linha por produto, colunas separadas
            por tab — SKU, Nome, Preço, Tecido, Costura, Aviamentos. Se o SKU já existir, atualiza;
            se não existir, cria um produto novo. Os últimos 3 custos são opcionais (viram 0 se
            vazios).
          </p>
        </div>

        <textarea
          value={pasteText}
          onChange={(e) => {
            setPasteText(e.target.value);
            setPreviewRows(null);
            setPreviewErrors([]);
          }}
          placeholder={"ABC123\tCamiseta Branca\t42,29\t7,90\t3,20\t1,50\nDEF456\tCalça Jeans\t89,90\t20\t8\t2"}
          rows={5}
          className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-gold focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePreviewPaste}
            disabled={previewing || !pasteText.trim()}
            className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
          >
            {previewing ? "Analisando..." : "Analisar colagem"}
          </button>
          {previewRows && (
            <button
              type="button"
              onClick={cancelPreview}
              className="text-sm text-muted hover:text-foreground hover:underline"
            >
              Cancelar
            </button>
          )}
        </div>

        {applyResult && (
          <p className="text-sm text-emerald-400">
            {applyResult.created} produto(s) criado(s), {applyResult.updated} atualizado(s).
          </p>
        )}

        {previewErrors.length > 0 && (
          <div className="text-sm text-red-400">
            <p className="font-medium">{previewErrors.length} linha(s) ignorada(s):</p>
            <ul className="mt-1 list-inside list-disc text-xs">
              {previewErrors.map((e, idx) => (
                <li key={idx}>
                  Linha {e.line}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {previewRows && previewRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-1.5 font-medium">SKU</th>
                    <th className="py-1.5 font-medium">Nome</th>
                    <th className="py-1.5 font-medium">Preço</th>
                    <th className="py-1.5 font-medium">Tecido</th>
                    <th className="py-1.5 font-medium">Costura</th>
                    <th className="py-1.5 font-medium">Aviamentos</th>
                    <th className="py-1.5 font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-border/50">
                      <td className="py-1.5 text-muted">{row.sku}</td>
                      <td className="py-1.5 max-w-[220px] truncate" title={row.name}>
                        {row.name}
                      </td>
                      <td className="py-1.5">{formatBRL(row.salePrice)}</td>
                      <td className="py-1.5">{formatBRL(row.tecidoCost)}</td>
                      <td className="py-1.5">{formatBRL(row.costuraCost)}</td>
                      <td className="py-1.5">{formatBRL(row.aviamentosCost)}</td>
                      <td className="py-1.5">
                        <span
                          className={
                            row.action === "create"
                              ? "rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400"
                              : "rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400"
                          }
                        >
                          {row.action === "create" ? "Criar" : "Atualizar"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={handleApplyPaste}
              disabled={applying}
              className="w-fit rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
            >
              {applying ? "Salvando..." : `Confirmar e salvar (${previewRows.length})`}
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">SKU</label>
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Preço de venda</label>
          <input
            required
            type="number"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Tecido</label>
          <input
            type="number"
            step="0.01"
            value={tecidoCost}
            onChange={(e) => setTecidoCost(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Costura</label>
          <input
            type="number"
            step="0.01"
            value={costuraCost}
            onChange={(e) => setCosturaCost(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Aviamentos</label>
          <input
            type="number"
            step="0.01"
            value={aviamentosCost}
            onChange={(e) => setAviamentosCost(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Comissão ML (%)</label>
          <input
            type="number"
            step="0.01"
            value={marketplaceFeePercent}
            onChange={(e) => setMarketplaceFeePercent(e.target.value)}
            className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          {marketplaceFeePercent && salePrice && (
            <span className="text-xs text-muted">= {formatBRL(marketplaceFeeComputed)}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Frete</label>
          <input
            type="number"
            step="0.01"
            value={shippingCost}
            onChange={(e) => setShippingCost(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Embalagem</label>
          <input
            type="number"
            step="0.01"
            value={packagingCost}
            onChange={(e) => setPackagingCost(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Qtd. média/mês</label>
          <input
            type="number"
            min={0}
            value={avgMonthlyQuantity}
            onChange={(e) => setAvgMonthlyQuantity(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar produto"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-border px-4 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
          >
            Cancelar
          </button>
        )}
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {products.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gold/50 bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg text-foreground">Quantidade média vendida/mês</h2>
              <p className="text-sm text-muted">
                Calcula automaticamente a partir das vendas já importadas (total vendido de cada
                SKU ÷ número de meses com dados), em vez de digitar manualmente — evita erro de
                digitação e soma indevida.
              </p>
            </div>
            <button
              onClick={autoFillAvgQuantity}
              disabled={calculatingAvg}
              className="whitespace-nowrap rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
            >
              {calculatingAvg ? "Calculando..." : "Calcular automaticamente"}
            </button>
          </div>
          {avgResult && <p className="text-sm text-gold">{avgResult}</p>}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted">Nenhum produto cadastrado ainda.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Produto</th>
              <th className="py-2 font-medium">Preço</th>
              <th className="py-2 font-medium">Tecido</th>
              <th className="py-2 font-medium">Costura</th>
              <th className="py-2 font-medium">Aviamentos</th>
              <th className="py-2 font-medium">Margem</th>
              <th className="py-2 font-medium">Qtd./mês</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const margin = computeProductMargin(p);
              return (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="py-2">
                    {p.name}
                    {p.sku && <span className="ml-1 text-xs text-muted">({p.sku})</span>}
                  </td>
                  <td className="py-2">{formatBRL(p.salePrice)}</td>
                  <td className="py-2">{formatBRL(p.tecidoCost)}</td>
                  <td className="py-2">{formatBRL(p.costuraCost)}</td>
                  <td className="py-2">{formatBRL(p.aviamentosCost)}</td>
                  <td className={`py-2 ${margin.marginValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {formatBRL(margin.marginValue)} ({(margin.marginPercent * 100).toFixed(1)}%)
                  </td>
                  <td className="py-2">{p.avgMonthlyQuantity}</td>
                  <td className="py-2">
                    <span className={p.isActive ? "text-emerald-400" : "text-muted"}>
                      {p.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <button
                      onClick={() => toggleActive(p)}
                      className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                    >
                      {p.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => startEdit(p)}
                      className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
