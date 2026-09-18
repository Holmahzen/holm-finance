"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navGroups = [
  {
    title: "Visão geral",
    items: [
      { href: "/", label: "Início" },
      { href: "/alertas", label: "Alertas" },
      { href: "/saude-financeira", label: "Saúde Financeira" },
      { href: "/relatorio-mensal", label: "Relatório Mensal" },
    ],
  },
  {
    title: "Financeiro do dia a dia",
    items: [
      { href: "/accounts", label: "Contas" },
      { href: "/entries", label: "Lançamentos" },
      { href: "/cartao-credito", label: "Cartão de Crédito" },
      { href: "/fluxo-de-caixa", label: "Fluxo de Caixa" },
      { href: "/reserva-de-caixa", label: "Reserva de Caixa" },
      { href: "/reconciliation", label: "Conciliação" },
      { href: "/imports", label: "Importações" },
    ],
  },
  {
    title: "Análise",
    items: [
      { href: "/dre", label: "DRE" },
      { href: "/dre-competencia", label: "DRE por competência" },
      { href: "/balanco-patrimonial", label: "Balanço Patrimonial" },
      { href: "/projecao-90-dias", label: "Projeção" },
      { href: "/ponto-de-equilibrio", label: "Ponto de Equilíbrio" },
      { href: "/simples-nacional", label: "Simples Nacional" },
    ],
  },
  {
    title: "Produtos & vendas",
    items: [
      { href: "/produtos", label: "Produtos" },
      { href: "/lucratividade-produtos", label: "Lucratividade dos Produtos" },
      { href: "/vendas", label: "Vendas" },
      { href: "/recebiveis-ml", label: "Recebíveis ML" },
    ],
  },
  {
    title: "Fiscal",
    items: [
      { href: "/notas-fiscais", label: "Notas Fiscais" },
      { href: "/notas-producao", label: "Notas de Produção Terceirizada" },
      { href: "/conferencia-ncm", label: "Conferência de NCM" },
      { href: "/notas-da-receita", label: "Notas da Receita" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/custos-fixos", label: "Custos fixos" },
      { href: "/emprestimos", label: "Empréstimos" },
      { href: "/categories", label: "Categorias" },
      { href: "/counterparties", label: "Contrapartes" },
    ],
  },
];

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="flex flex-1">
      <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface/60 px-4 py-6">
        <Link href="/" className="mb-6 block shrink-0 font-serif text-xl tracking-wide text-gold">
          Holm <span className="text-foreground">Finance</span>
        </Link>
        <nav className="flex flex-col gap-4 text-sm">
          {navGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-gold-soft">
                {group.title}
              </span>
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? "rounded px-3 py-1.5 font-medium text-gold bg-gold/10"
                        : "rounded px-3 py-1.5 text-muted transition hover:bg-surface-hover hover:text-gold-soft"
                    }
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
