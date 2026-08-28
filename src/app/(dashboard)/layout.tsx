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
  { href: "/custos-fixos", label: "Custos fixos" },
  { href: "/emprestimos", label: "Empréstimos" },
  { href: "/produtos", label: "Produtos" },
  { href: "/ponto-de-equilibrio", label: "Ponto de Equilíbrio" },
  { href: "/projecao-90-dias", label: "Projeção" },
  { href: "/vendas", label: "Vendas" },
  { href: "/dre", label: "DRE" },
  { href: "/relatorio-mensal", label: "Relatório Mensal" },
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
    <div className="flex flex-1 flex-col">
      <header className="no-print border-b border-border bg-surface/60">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4 sm:gap-8">
          <span className="shrink-0 font-serif text-xl tracking-wide text-gold">
            Holm <span className="text-foreground">Finance</span>
          </span>
          <nav className="flex min-w-0 flex-1 gap-5 overflow-x-auto text-sm whitespace-nowrap">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? "shrink-0 text-gold"
                      : "shrink-0 text-muted transition hover:text-gold-soft"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
