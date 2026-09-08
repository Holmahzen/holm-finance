const OFX_DATE_PATTERN =
  /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?(?:\.\d+)?(?:\[([+-]?\d+(?:\.\d+)?):\w+\])?/;

/**
 * O PagBank escreve o DTASOF como `08/09/2026` — data brasileira, fora do
 * padrão OFX, que pede `AAAAMMDD`. As demais datas do mesmo arquivo (DTPOSTED,
 * DTSTART, DTEND) vêm no formato certo; só o saldo destoa. Era o que fazia a
 * importação do extrato do PagBank estourar com 500.
 */
const BR_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Parses OFX dates like `20260714000000[-3:GMT]` into a real UTC instant,
 * applying the bracketed timezone offset explicitly instead of relying on
 * the host machine's local timezone.
 */
export function parseOfxDate(raw: string): Date {
  const br = raw.trim().match(BR_DATE_PATTERN);
  if (br) {
    const [, day, month, year] = br;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const match = raw.match(OFX_DATE_PATTERN);
  if (!match) {
    throw new Error(`Data OFX inválida: "${raw}"`);
  }

  const [, year, month, day, hour = "00", minute = "00", second = "00", offsetStr] = match;
  const offsetHours = offsetStr ? Number.parseFloat(offsetStr) : 0;

  const utcMillis =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ) -
    offsetHours * 60 * 60 * 1000;

  return new Date(utcMillis);
}
