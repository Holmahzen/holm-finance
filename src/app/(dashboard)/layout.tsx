"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Início" },
  { href: "/alertas", label: "Alertas" },
  { href: "/executivo", label: "Dashboard Executivo" },
  { href: "/accounts", label: "Contas" },
  { href: "/entries", label: "Lançamentos" },
  { href: "/cartao-credito", label: "Cartão de Crédito" },
  { href: "/fluxo-de-caixa", label: "Fluxo de Caixa" },
  { href: "/reserva-de-caixa", label: "Reserva de Caixa" },
  { href: "/simples-nacional", label: "Simples Nacional" },
  { href: "/custos-fixos", label: "Custos fixos" },
  { href: "/emprestimos", label: "Empréstimos" },
  { href: "/produtos", label: "Produtos" },
  { href: "/ponto-de-equilibrio", label: "Ponto de Equilíbrio" },
  { href: "/projecao-90-dias", label: "Projeção" },
  { href: "/vendas", label: "Vendas" },
  { href: "/recebiveis-ml", label: "Recebíveis ML" },
  { href: "/dre", label: "DRE" },
  { href: "/relatorio-mensal", label: "Relatório Mensal" },
  { href: "/balanco-patrimonial", label: "Balanço Patrimonial" },
  { href: "/saude-financeira", label: "Saúde Financeira" },
  { href: "/categories", label: "Categorias" },
  { href: "/counterparties", label: "Contrapartes" },
  { href: "/imports", label: "Importações" },
  { href: "/reconciliation", label: "Conciliação" },
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
        <nav className="flex flex-col gap-0.5 text-sm">
          {navItems.map((item) => {
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
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
