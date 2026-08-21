"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded border border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-gold hover:text-gold"
    >
      Imprimir
    </button>
  );
}
