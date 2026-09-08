const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const COMBINING_MARKS = /[\u0300-\u036f]/g;

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "");
}

function monthIndex(name: string): number | null {
  const normalized = stripAccents(name.trim().toLowerCase());
  const index = MONTHS.findIndex((m) => stripAccents(m) === normalized);
  return index === -1 ? null : index;
}

/**
 * "1 de setembro de 2026 18:51 hs." — formato da coluna "Data da venda" no
 * export nativo do Mercado Livre. Só a data importa: a hora é descartada e a
 * data volta em UTC, igual aos outros parsers do projeto.
 */
export function parseFullPtBrDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2}) de ([a-zA-ZçÇãÃéÉ]+) de (\d{4})/);
  if (!match) return null;

  const month = monthIndex(match[2]);
  if (month === null) return null;

  return new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HALF_YEAR_IN_DAYS = 182;

/**
 * "1 de setembro | 11:51" — formato das colunas de envio ("Data a caminho",
 * "Data de entrega"). O Mercado Livre omite o ano nessas colunas, então ele é
 * inferido a partir da data da venda: das três opções (ano anterior, mesmo
 * ano, ano seguinte) vale a que cai mais perto da venda, já que envio e
 * entrega acontecem em dias — nunca em meses — de distância dela.
 *
 * Não dá pra assumir que a entrega vem DEPOIS da venda: no Mercado Envios
 * Full o pacote já está no centro de distribuição e pode ser despachado e
 * entregue com data anterior à do fechamento da venda.
 */
export function parsePtBrDayMonth(value: unknown, reference: Date): Date | null {
  if (value instanceof Date) return value;
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{1,2}) de ([a-zA-ZçÇãÃéÉ]+)/);
  if (!match) return null;

  const month = monthIndex(match[2]);
  if (month === null) return null;

  const day = Number(match[1]);
  const sameYear = new Date(Date.UTC(reference.getUTCFullYear(), month, day));
  const daysApart = (sameYear.getTime() - reference.getTime()) / MS_PER_DAY;

  // Venda em dezembro, entrega em janeiro: o mesmo ano jogaria a entrega 11
  // meses ANTES da venda, então o certo é o ano seguinte (e vice-versa).
  if (daysApart > HALF_YEAR_IN_DAYS) {
    return new Date(Date.UTC(reference.getUTCFullYear() - 1, month, day));
  }
  if (daysApart < -HALF_YEAR_IN_DAYS) {
    return new Date(Date.UTC(reference.getUTCFullYear() + 1, month, day));
  }
  return sameYear;
}
