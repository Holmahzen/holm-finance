"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";

type Counterparty = { id: string; name: string; isCostureira: boolean; document?: string | null };
type Account = { id: string; name: string };

type Servico = {
  id: string;
  entryId?: string | null;
  date: string;
  amount: string;
  description: string | null;
  quantity?: number | null;
};

type Pendencia = {
  entryId: string | null;
  dueDate: string | null;
  servicos: Servico[];
  categoryId: string;
  categoryName: string;
};

type Entry = {
  id: string;
  description: string;
  amount: string;
  paidAmount: string | null;
  paidAt: string | null;
};

const COMPANY_NAME = "Holm Confecções — Regimar Souza Silva Ltda";
const COMPANY_CNPJ = "49.046.940/0001-00";

type PrintSheet = {
  kind: "pendente" | "pago";
  costureira: string;
  documento: string;
  categoria: string;
  /** vencimento previsto (pendente) ou data do pagamento (pago), em ISO */
  quando: string;
  total: number;
  rows: { date: string; descricao: string | null; qtd: number | null; valor: number }[];
};

function formatDocumento(value?: string | null) {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return value ?? "";
}

function PrintSheetView({ sheet }: { sheet: PrintSheet }) {
  const pendente = sheet.kind === "pendente";
  const totalQtd = sheet.rows.reduce((sum, r) => sum + (r.qtd ?? 0), 0);
  return (
    <div className="hidden text-foreground print:block">
      <div className="border-b border-border pb-3 text-center">
        <p className="text-lg font-bold uppercase">{COMPANY_NAME}</p>
        <p className="text-sm">CNPJ {COMPANY_CNPJ}</p>
      </div>
      <h1 className="mt-5 text-center text-xl font-bold">
        {pendente ? "Fechamento de serviços de costura" : "Recibo de pagamento — serviços de costura"}
      </h1>
      <div className="mt-4 flex flex-col gap-1 text-sm">
        <p>
          <strong>Costureira:</strong> {sheet.costureira}
          {sheet.documento ? " — CPF/CNPJ " + sheet.documento : ""}
        </p>
        {sheet.categoria !== "Costura" && (
          <p>
            <strong>Serviço:</strong> {sheet.categoria}
          </p>
        )}
        <p>
          <strong>{pendente ? "Vencimento previsto:" : "Data do pagamento:"}</strong>{" "}
          {sheet.quando ? formatDate(sheet.quando) : "—"}
        </p>
        <p>
          <strong>Emitido em:</strong> {new Date().toLocaleDateString("pt-BR")}
        </p>
      </div>
      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-t border-border">
            <th className="py-2 text-left font-semibold">Data</th>
            <th className="py-2 text-left font-semibold">Descrição</th>
            <th className="py-2 text-right font-semibold">Qtd</th>
            <th className="py-2 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {sheet.rows.length === 0 ? (
            <tr className="border-b border-border">
              <td className="py-2" colSpan={3}>
                Pagamento de serviços de costura (sem detalhamento por item)
              </td>
              <td className="py-2 text-right">{formatBRL(sheet.total)}</td>
            </tr>
          ) : (
            sheet.rows.map((r, i) => (
              <tr key={i} className="border-b border-border">
                <td className="py-1.5">{formatDate(r.date)}</td>
                <td className="py-1.5">{r.descricao || "—"}</td>
                <td className="py-1.5 text-right">{r.qtd ?? "—"}</td>
                <td className="py-1.5 text-right">{formatBRL(r.valor)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-bold" colSpan={2}>
              {pendente ? "Total a pagar" : "Total pago"}
            </td>
            <td className="pt-3 text-right font-bold">{totalQtd > 0 ? totalQtd : ""}</td>
            <td className="pt-3 text-right text-base font-bold">{formatBRL(sheet.total)}</td>
          </tr>
        </tfoot>
      </table>
      {pendente ? (
        <div className="mt-16 grid grid-cols-2 gap-10 text-center text-sm">
          <div className="border-t border-foreground pt-1">Conferido por (Holm Confecções)</div>
          <div className="border-t border-foreground pt-1">{sheet.costureira}</div>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm leading-relaxed">
            Recebi de {COMPANY_NAME} (CNPJ {COMPANY_CNPJ}) a quantia de <strong>{formatBRL(sheet.total)}</strong>, referente
            aos serviços de costura acima, dando plena quitação.
          </p>
          <div className="mt-16 grid grid-cols-2 gap-10 text-center text-sm">
            <div className="border-t border-foreground pt-1">Data: ____/____/________</div>
            <div className="border-t border-foreground pt-1">{sheet.costureira}</div>
          </div>
        </>
      )}
    </div>
  );
}

function todayLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Soma das peças do dia; "—" quando nenhum item informou quantidade.
function qtdGrupo(grupo: Servico[]) {
  const comQtd = grupo.filter((s) => s.quantity);
  return comQtd.length === 0 ? "—" : String(comQtd.reduce((sum, s) => sum + (s.quantity ?? 0), 0));
}

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date(todayLocalDateString());
}

export default function PagamentoCostureirasPage() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [counterpartyId, setCounterpartyId] = useState("");

  // lançar serviço
  const [servicoData, setServicoData] = useState(todayLocalDateString());
  const [servicoItens, setServicoItens] = useState<{ qtd: string; descricao: string; valor: string }[]>([{ qtd: "", descricao: "", valor: "" }]);
  const [servicoDueDate, setServicoDueDate] = useState("");
  const [savingServico, setSavingServico] = useState(false);
  const [servicoError, setServicoError] = useState<string | null>(null);

  // pagar
  const [pagamentoData, setPagamentoData] = useState(todayLocalDateString());
  const [bankAccountId, setBankAccountId] = useState("");
  const [pagando, setPagando] = useState(false);
  const [pagamentoError, setPagamentoError] = useState<string | null>(null);
  const [pagamentoSuccess, setPagamentoSuccess] = useState<string | null>(null);

  // editar vencimento
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editDueDateValue, setEditDueDateValue] = useState("");

  const [pendencia, setPendencia] = useState<Pendencia | null>(null);
  const [historico, setHistorico] = useState<Entry[] | null>(null);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [servicosPorPagamento, setServicosPorPagamento] = useState<Record<string, Servico[]>>({});
  const [expandedPagamentoId, setExpandedPagamentoId] = useState<string | null>(null);
  const [expandedPendenteDate, setExpandedPendenteDate] = useState<string | null>(null);
  const [printSheet, setPrintSheet] = useState<PrintSheet | null>(null);

  const costureiras = useMemo(() => counterparties.filter((c) => c.isCostureira), [counterparties]);
  const selectedCostureira = costureiras.find((c) => c.id === counterpartyId);
  const gruposPendentes = useMemo(() => {
    const map = new Map<string, Servico[]>();
    for (const s of pendencia?.servicos ?? []) {
      const key = s.date.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pendencia]);
  const totalPendente = useMemo(
    () => (pendencia?.servicos ?? []).reduce((sum, s) => sum + Number(s.amount), 0),
    [pendencia],
  );

  async function loadBase() {
    setLoading(true);
    const [counterpartiesRes, accountsRes] = await Promise.all([
      fetch("/api/counterparties"),
      fetch("/api/accounts"),
    ]);
    setCounterparties(await counterpartiesRes.json());
    setAccounts(await accountsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadBase();
  }, []);

  async function loadPendentesEHistorico(id: string) {
    if (!id) {
      setPendencia(null);
      setHistorico(null);
      setServicosPorPagamento({});
      return;
    }
    setLoadingPendentes(true);
    const pendenciaData: Pendencia = await fetch(`/api/costureira-servicos?counterpartyId=${id}`).then((r) =>
      r.json(),
    );
    setPendencia(pendenciaData);
    const entries: Entry[] = await fetch(
      `/api/entries?counterpartyId=${id}&categoryId=${pendenciaData.categoryId}&status=PAID`,
    ).then((r) => r.json());
    entries.sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
    const lancados: Servico[] = await fetch(`/api/costureira-servicos?counterpartyId=${id}&lancados=1`).then((r) =>
      r.json(),
    );
    const porPagamento: Record<string, Servico[]> = {};
    for (const servico of lancados) {
      if (servico.entryId) (porPagamento[servico.entryId] ??= []).push(servico);
    }
    setServicosPorPagamento(porPagamento);
    setExpandedPagamentoId(null);
    setHistorico(entries);
    setLoadingPendentes(false);
  }

  useEffect(() => {
    setEditingDueDate(false);
    loadPendentesEHistorico(counterpartyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterpartyId]);

  // Abre a janela de impressão assim que a folha está na tela; limpa depois de imprimir/cancelar.
  useEffect(() => {
    if (!printSheet) return;
    const onAfterPrint = () => setPrintSheet(null);
    window.addEventListener("afterprint", onAfterPrint);
    const timer = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printSheet]);

  function toPrintRows(list: Servico[]): PrintSheet["rows"] {
    return list
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ date: s.date, descricao: s.description, qtd: s.quantity ?? null, valor: Number(s.amount) }));
  }

  function imprimirFechamento() {
    if (!pendencia || !selectedCostureira || pendencia.servicos.length === 0) return;
    setPrintSheet({
      kind: "pendente",
      costureira: selectedCostureira.name,
      documento: formatDocumento(selectedCostureira.document),
      categoria: pendencia.categoryName,
      quando: pendencia.dueDate ?? "",
      total: totalPendente,
      rows: toPrintRows(pendencia.servicos),
    });
  }

  function imprimirRecibo(h: Entry) {
    if (!selectedCostureira) return;
    setPrintSheet({
      kind: "pago",
      costureira: selectedCostureira.name,
      documento: formatDocumento(selectedCostureira.document),
      categoria: pendencia?.categoryName ?? "Costura",
      quando: h.paidAt ?? "",
      total: Number(h.paidAmount ?? h.amount),
      rows: toPrintRows(servicosPorPagamento[h.id] ?? []),
    });
  }

  async function handleAddServico(e: FormEvent) {
    e.preventDefault();
    setSavingServico(true);
    setServicoError(null);
    // Um lançamento por item, todos na mesma data. O primeiro cria a previsão (com o vencimento);
    // os seguintes só somam nela.
    let launched = 0;
    for (const [i, item] of servicoItens.entries()) {
      const res = await fetch("/api/costureira-servicos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counterpartyId,
          date: servicoData,
          amount: item.valor,
          description: item.descricao.trim() || undefined,
          quantity: item.qtd || undefined,
          dueDate: i === 0 && !pendencia?.entryId ? servicoDueDate : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = typeof body.error === "string" ? body.error : "Não foi possível lançar o serviço.";
        setServicoError(launched > 0 ? `${msg} Os ${launched} primeiro(s) item(ns) já foram lançados.` : msg);
        setSavingServico(false);
        if (launched > 0) await loadPendentesEHistorico(counterpartyId);
        return;
      }
      launched++;
    }
    setServicoItens([{ qtd: "", descricao: "", valor: "" }]);
    setServicoDueDate("");
    setSavingServico(false);
    await loadPendentesEHistorico(counterpartyId);
  }

  async function handleRemoveServico(id: string) {
    if (!confirm("Excluir esse serviço lançado?")) return;
    await fetch(`/api/costureira-servicos/${id}`, { method: "DELETE" });
    await loadPendentesEHistorico(counterpartyId);
  }

  function startEditDueDate() {
    setEditDueDateValue(pendencia?.dueDate?.slice(0, 10) ?? "");
    setEditingDueDate(true);
  }

  async function saveDueDate() {
    await fetch("/api/costureira-servicos/due-date", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId, dueDate: editDueDateValue }),
    });
    setEditingDueDate(false);
    await loadPendentesEHistorico(counterpartyId);
  }

  async function handlePagarTudo() {
    setPagando(true);
    setPagamentoError(null);
    setPagamentoSuccess(null);
    const res = await fetch("/api/costureira-servicos/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId, bankAccountId, paidAt: pagamentoData }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPagamentoError(typeof body.error === "string" ? body.error : "Não foi possível pagar.");
      setPagando(false);
      return;
    }
    const result = await res.json();
    setPagamentoSuccess(
      `Pago ${formatBRL(result.total)} (${result.count} serviço${result.count > 1 ? "s" : ""}) pra ${selectedCostureira?.name}.`,
    );
    setPagando(false);
    await loadPendentesEHistorico(counterpartyId);
  }

  if (loading) return <p className="text-sm text-muted">Carregando...</p>;

  return (
    <>
    <div className="flex flex-col gap-6 print:hidden">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Pagamento de Costureiras</h1>
        <p className="max-w-prose text-sm text-muted">
          Lança cada serviço enviado (data + valor), sem gerar cobrança na hora — vai acumulando. O
          primeiro serviço de uma quinzena já cria a previsão no Fluxo de Caixa, com o vencimento que
          você escolher. Quando fechar a quinzena, clique em &quot;Pagar tudo&quot; pra virar um único
          lançamento pago. Pra aparecer aqui, marque a contraparte como costureira em{" "}
          <a href="/counterparties" className="text-gold hover:underline">
            Contrapartes
          </a>
          .
        </p>
      </div>

      {costureiras.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma contraparte marcada como costureira ainda. Marque em{" "}
          <a href="/counterparties" className="text-gold hover:underline">
            Contrapartes
          </a>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Costureira</label>
            <select
              value={counterpartyId}
              onChange={(e) => setCounterpartyId(e.target.value)}
              className="w-56 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              <option value="">Selecione...</option>
              {costureiras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {counterpartyId && (
            <>
              <form
                onSubmit={handleAddServico}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Data do serviço</label>
                  <input
                    required
                    type="date"
                    value={servicoData}
                    onChange={(e) => setServicoData(e.target.value)}
                    className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {servicoItens.map((item, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Qtd</label>
                        <input
                          type="number"
                          step="1"
                          min={1}
                          value={item.qtd}
                          onChange={(e) =>
                            setServicoItens((list) => list.map((x, j) => (j === i ? { ...x, qtd: e.target.value } : x)))
                          }
                          placeholder="10"
                          className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">
                          {servicoItens.length > 1 ? `Item ${i + 1} — descrição` : "Descrição (opcional)"}
                        </label>
                        <input
                          value={item.descricao}
                          onChange={(e) =>
                            setServicoItens((list) => list.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))
                          }
                          placeholder="Ex.: saias"
                          className="w-56 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Valor (R$)</label>
                        <input
                          required
                          type="number"
                          step="0.01"
                          min={0}
                          value={item.valor}
                          onChange={(e) =>
                            setServicoItens((list) => list.map((x, j) => (j === i ? { ...x, valor: e.target.value } : x)))
                          }
                          className="w-32 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                        />
                      </div>
                      {servicoItens.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setServicoItens((list) => list.filter((_, j) => j !== i))}
                          className="pb-1.5 text-xs font-medium text-red-400 hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setServicoItens((list) => [...list, { qtd: "", descricao: "", valor: "" }])}
                    className="self-start text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                  >
                    + Adicionar outro item nesta data
                  </button>
                </div>
                {pendencia && !pendencia.entryId && (
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs font-medium text-muted"
                      title="Primeiro serviço dessa quinzena — essa data já entra na previsão do Fluxo de Caixa. Pode ser uma data passada, se a quinzena já fechou e só falta pagar."
                    >
                      Vencimento previsto
                    </label>
                    <input
                      required
                      type="date"
                      value={servicoDueDate}
                      onChange={(e) => setServicoDueDate(e.target.value)}
                      className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={savingServico}
                  className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
                >
                  {savingServico ? "Lançando..." : servicoItens.length > 1 ? "Lançar serviços" : "Lançar serviço"}
                </button>
                {servicoError && <p className="w-full text-sm text-red-400">{servicoError}</p>}
              </form>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg text-foreground">
                      Pendente — {selectedCostureira?.name}
                      {pendencia && pendencia.categoryName !== "Costura" && (
                        <span className="ml-1 text-xs font-normal text-muted">
                          (categoria {pendencia.categoryName})
                        </span>
                      )}
                    </h2>
                    <div className="flex flex-wrap items-center gap-4">
                      <p className="text-2xl font-serif text-gold">{formatBRL(totalPendente)}</p>
                      {pendencia && pendencia.servicos.length > 0 && (
                        <button
                          type="button"
                          onClick={imprimirFechamento}
                          className="rounded border border-gold px-3 py-1 text-xs font-medium text-gold transition hover:bg-gold/10"
                        >
                          Imprimir fechamento
                        </button>
                      )}
                    </div>
                    {pendencia?.dueDate && (
                      <p className="mt-1 text-xs text-muted">
                        {editingDueDate ? (
                          <span className="inline-flex items-center gap-2">
                            Vencimento:
                            <input
                              type="date"
                              value={editDueDateValue}
                              onChange={(e) => setEditDueDateValue(e.target.value)}
                              className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:border-gold focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={saveDueDate}
                              className="font-medium text-gold hover:underline"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDueDate(false)}
                              className="text-muted hover:underline"
                            >
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <span className={isOverdue(pendencia.dueDate) ? "text-red-400" : ""}>
                            Vencimento: {formatDate(pendencia.dueDate)}
                            {isOverdue(pendencia.dueDate) && " (atrasado)"}{" "}
                            <button
                              type="button"
                              onClick={startEditDueDate}
                              className="ml-1 text-gold hover:underline"
                            >
                              editar
                            </button>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {loadingPendentes ? (
                  <p className="text-sm text-muted">Carregando...</p>
                ) : pendencia && pendencia.servicos.length > 0 ? (
                  <>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted">
                          <th className="py-2 font-medium">Data</th>
                          <th className="py-2 font-medium">Descrição</th>
                          <th className="py-2 font-medium">Qtd</th>
                          <th className="py-2 font-medium">Valor</th>
                          <th className="py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {gruposPendentes.map(([dateKey, grupo]) => {
                          const unico = grupo.length === 1 ? grupo[0] : null;
                          // Com um item só não há o que abrir (o aberto de antes sobrava ao excluir os outros).
                          const expanded = !unico && expandedPendenteDate === dateKey;
                          const totalGrupo = grupo.reduce((sum, s) => sum + Number(s.amount), 0);
                          return (
                            <Fragment key={dateKey}>
                              <tr className="border-b border-border/50">
                                <td className="py-2">{formatDate(grupo[0].date)}</td>
                                <td className="py-2 text-muted">
                                  {unico ? unico.description || "—" : `${grupo.length} itens`}
                                </td>
                                <td className="py-2 text-muted">{qtdGrupo(grupo)}</td>
                                <td className="py-2">{formatBRL(totalGrupo)}</td>
                                <td className="py-2 text-right">
                                  {unico ? (
                                    <button
                                      onClick={() => handleRemoveServico(unico.id)}
                                      className="text-xs font-medium text-red-400 hover:underline"
                                    >
                                      Excluir
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedPendenteDate(expanded ? null : dateKey)}
                                      className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                                    >
                                      {expanded ? "Ocultar itens" : "Ver itens"}
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="border-b border-border/50">
                                  <td colSpan={5} className="pb-3">
                                    <table className="mt-1 w-full text-left text-sm">
                                      <thead>
                                        <tr className="border-b border-border text-muted">
                                          <th className="py-1 font-medium">Descrição</th>
                                          <th className="py-1 font-medium">Qtd</th>
                                          <th className="py-1 font-medium">Valor</th>
                                          <th className="py-1 font-medium"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {grupo.map((s) => (
                                          <tr key={s.id} className="border-b border-border/50">
                                            <td className="py-1 text-muted">{s.description || "—"}</td>
                                            <td className="py-1 text-muted">{s.quantity ?? "—"}</td>
                                            <td className="py-1">{formatBRL(s.amount)}</td>
                                            <td className="py-1 text-right">
                                              <button
                                                onClick={() => handleRemoveServico(s.id)}
                                                className="text-xs font-medium text-red-400 hover:underline"
                                              >
                                                Excluir
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>

                    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Data do pagamento</label>
                        <input
                          type="date"
                          value={pagamentoData}
                          onChange={(e) => setPagamentoData(e.target.value)}
                          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Pago de qual conta</label>
                        <select
                          value={bankAccountId}
                          onChange={(e) => setBankAccountId(e.target.value)}
                          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                        >
                          <option value="">Selecione...</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={handlePagarTudo}
                        disabled={pagando || !bankAccountId}
                        className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
                      >
                        {pagando ? "Pagando..." : `Pagar tudo (${formatBRL(totalPendente)})`}
                      </button>
                    </div>
                    {pagamentoError && <p className="text-sm text-red-400">{pagamentoError}</p>}
                    {pagamentoSuccess && <p className="text-sm text-emerald-400">{pagamentoSuccess}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted">Nenhum serviço pendente — lance um acima.</p>
                )}
              </div>

              {historico && historico.length > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                  <h2 className="font-serif text-lg text-foreground">
                    Histórico de pagamentos — {selectedCostureira?.name}
                  </h2>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted">
                        <th className="py-2 font-medium">Data</th>
                        <th className="py-2 font-medium">Valor</th>
                        <th className="py-2 font-medium">Serviços</th>
                        <th className="py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.map((h) => {
                        const servicos = servicosPorPagamento[h.id] ?? [];
                        const expanded = expandedPagamentoId === h.id;
                        return (
                          <Fragment key={h.id}>
                            <tr className="border-b border-border/50">
                              <td className="py-2">{h.paidAt ? formatDate(h.paidAt) : "—"}</td>
                              <td className="py-2">{formatBRL(h.paidAmount ?? h.amount)}</td>
                              <td className="py-2 text-muted">
                                {servicos.length > 0
                                  ? `${servicos.length} serviço${servicos.length > 1 ? "s" : ""}`
                                  : "sem detalhe"}
                              </td>
                              <td className="py-2 text-right">
                                <span className="inline-flex items-center gap-3">
                                  {servicos.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedPagamentoId(expanded ? null : h.id)}
                                      className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                                    >
                                      {expanded ? "Ocultar serviços" : "Ver serviços"}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => imprimirRecibo(h)}
                                    className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                                  >
                                    Imprimir recibo
                                  </button>
                                </span>
                              </td>
                            </tr>
                            {expanded && (
                              <tr className="border-b border-border/50">
                                <td colSpan={4} className="pb-3">
                                  <table className="mt-1 w-full text-left text-sm">
                                    <thead>
                                      <tr className="border-b border-border text-muted">
                                        <th className="py-1 font-medium">Data do serviço</th>
                                        <th className="py-1 font-medium">Descrição</th>
                                        <th className="py-1 font-medium">Qtd</th>
                                        <th className="py-1 font-medium">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {servicos.map((s) => (
                                        <tr key={s.id} className="border-b border-border/50">
                                          <td className="py-1">{formatDate(s.date)}</td>
                                          <td className="py-1 text-muted">{s.description || "—"}</td>
                                          <td className="py-1 text-muted">{s.quantity ?? "—"}</td>
                                          <td className="py-1">{formatBRL(s.amount)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
    {printSheet && <PrintSheetView sheet={printSheet} />}
    </>
  );
}
