/**
 * Chave de acesso de 44 dígitos — a que vem no código de barras do DANFE e de
 * outros documentos fiscais. Ela já diz bastante sobre a nota (quem emitiu,
 * modelo, série, número e o mês), o que permite reconhecer uma nota impressa
 * antes mesmo de ter o XML.
 */

const UF_BY_CODE: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
  "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
  "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

const MODEL_NAMES: Record<string, string> = {
  "55": "NF-e (mercadoria)",
  "57": "CT-e (transporte)",
  "58": "MDF-e (manifesto de carga)",
  "59": "CF-e (cupom do SAT)",
  "65": "NFC-e (cupom ao consumidor)",
  "67": "CT-e OS (transporte)",
};

export type ParsedAccessKey = {
  key: string;
  uf: string;
  ufName: string;
  year: number;
  month: number;
  issuerDocument: string;
  model: string;
  modelName: string;
  series: number;
  number: number;
  checkDigit: number;
  /** O 44o digito confere com o calculo (modulo 11)? Leitor que perde digito cai aqui. */
  valid: boolean;
};

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Digito verificador da chave: modulo 11 com pesos 2 a 9, da direita para a esquerda. */
export function accessKeyCheckDigit(first43: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = first43.length - 1; i >= 0; i--) {
    sum += Number(first43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest === 0 || rest === 1 ? 0 : 11 - rest;
}

export function parseAccessKey(raw: string): ParsedAccessKey | null {
  const key = digitsOnly(raw);
  if (key.length !== 44) return null;
  const uf = key.slice(0, 2);
  const model = key.slice(20, 22);
  return {
    key,
    uf,
    ufName: UF_BY_CODE[uf] ?? "?",
    year: 2000 + Number(key.slice(2, 4)),
    month: Number(key.slice(4, 6)),
    issuerDocument: key.slice(6, 20),
    model,
    modelName: MODEL_NAMES[model] ?? "modelo " + model,
    series: Number(key.slice(22, 25)),
    number: Number(key.slice(25, 34)),
    checkDigit: Number(key[43]),
    valid: accessKeyCheckDigit(key.slice(0, 43)) === Number(key[43]),
  };
}

/** Em blocos de 4, como aparece impresso no DANFE. */
export function formatAccessKey(raw: string): string {
  return digitsOnly(raw).replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function formatCnpj(document: string): string {
  if (document.length !== 14) return document;
  const d = document;
  return d.slice(0, 2) + "." + d.slice(2, 5) + "." + d.slice(5, 8) + "/" + d.slice(8, 12) + "-" + d.slice(12);
}
