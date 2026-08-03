export type ParsedBoleto = {
  linhaDigitavel: string | null;
  bankCode: string | null;
  bankName: string | null;
  amount: string;
  dueDate: Date | null;
  // "linha_digitavel"/"codigo_barras": decodificado com checksum validado.
  // "texto": código de barras não veio como texto (ex.: fonte de barras em
  // contas de concessionária/operadora) — valor e vencimento vieram dos
  // rótulos "Vencimento" / "Total a pagar" no texto do PDF, sem checksum.
  source: "linha_digitavel" | "codigo_barras" | "texto";
};

// Data-base da FEBRABAN para o fator de vencimento dos boletos bancários.
// O campo de 4 dígitos estoura em 21/02/2025 (1997-10-07 + 9999 dias), então
// boletos emitidos depois disso usam uma nova contagem a partir dessa data.
// Como não há como saber com certeza qual das duas bases o boleto em mãos usa,
// calculamos as duas e ficamos com a que resulta numa data mais próxima de
// hoje — é sempre isso que faz sentido pra um boleto (vencimento é sempre
// "logo ali", nunca anos no passado ou no futuro). A data extraída deve ser
// conferida antes de salvar o lançamento.
const BASE_DATE_ORIGINAL = Date.UTC(1997, 9, 7); // 1997-10-07
const BASE_DATE_2025 = Date.UTC(2025, 1, 22); // 2025-02-22
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BANK_NAMES: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "077": "Inter",
  "104": "Caixa Econômica Federal",
  "237": "Bradesco",
  "260": "Nubank",
  "336": "C6 Bank",
  "341": "Itaú",
  "748": "Sicredi",
  "756": "Sicoob",
};

function mod10(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    let product = Number(digits[i]) * weight;
    if (product > 9) product = Math.floor(product / 10) + (product % 10);
    sum += product;
    weight = weight === 2 ? 1 : 2;
  }
  const dv = 10 - (sum % 10);
  return dv === 10 ? 0 : dv;
}

// DV geral do código de barras (posição 5): módulo 11 com pesos 2..9
// cíclicos da direita pra esquerda, sobre os 43 dígitos restantes.
function mod11(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const resto = sum % 11;
  const dv = 11 - resto;
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

function isValidLinhaBancaria(digits: string): boolean {
  if (digits.length !== 47) return false;
  const campo1 = digits.slice(0, 10);
  const campo2 = digits.slice(10, 21);
  const campo3 = digits.slice(21, 32);
  return (
    mod10(campo1.slice(0, 9)) === Number(campo1[9]) &&
    mod10(campo2.slice(0, 10)) === Number(campo2[10]) &&
    mod10(campo3.slice(0, 10)) === Number(campo3[10])
  );
}

function isValidCodigoBarras(digits: string): boolean {
  if (digits.length !== 44) return false;
  const semDv = digits.slice(0, 4) + digits.slice(5);
  return mod11(semDv) === Number(digits[4]);
}

/**
 * Procura, dentro do texto extraído do PDF, uma sequência de 47 dígitos que
 * seja uma linha digitável de boleto bancário válida (checksum módulo 10 nos
 * campos 1, 2 e 3). Ignora pontuação/espaços entre os dígitos.
 */
export function extractLinhaDigitavel(rawText: string): string | null {
  const allDigits = rawText.replace(/\D/g, "");
  for (let i = 0; i + 47 <= allDigits.length; i++) {
    const candidate = allDigits.slice(i, i + 47);
    if (isValidLinhaBancaria(candidate)) return candidate;
  }
  return null;
}

function computeDueDate(fatorVencimento: number): Date {
  const candidateOriginal = BASE_DATE_ORIGINAL + fatorVencimento * MS_PER_DAY;
  const candidate2025 = BASE_DATE_2025 + fatorVencimento * MS_PER_DAY;
  const now = Date.now();
  const closer =
    Math.abs(candidateOriginal - now) <= Math.abs(candidate2025 - now)
      ? candidateOriginal
      : candidate2025;
  return new Date(closer);
}

export function decodeLinhaDigitavel(linha: string): ParsedBoleto {
  if (linha.length !== 47) {
    throw new Error("Linha digitável precisa ter 47 dígitos.");
  }
  const bankCode = linha.slice(0, 3);
  const campo5 = linha.slice(33, 47); // fator de vencimento (4) + valor (10)
  const fatorVencimento = Number(campo5.slice(0, 4));
  const amountCents = Number(campo5.slice(4, 14));

  const dueDate = fatorVencimento > 0 ? computeDueDate(fatorVencimento) : null;

  return {
    linhaDigitavel: linha,
    bankCode,
    bankName: BANK_NAMES[bankCode] ?? null,
    amount: (amountCents / 100).toFixed(2),
    dueDate,
    source: "linha_digitavel",
  };
}

export function decodeCodigoBarras(digits: string): ParsedBoleto {
  if (digits.length !== 44) {
    throw new Error("Código de barras precisa ter 44 dígitos.");
  }
  const bankCode = digits.slice(0, 3);
  const fatorVencimento = Number(digits.slice(5, 9));
  const amountCents = Number(digits.slice(9, 19));

  const dueDate = fatorVencimento > 0 ? computeDueDate(fatorVencimento) : null;

  return {
    linhaDigitavel: null,
    bankCode,
    bankName: BANK_NAMES[bankCode] ?? null,
    amount: (amountCents / 100).toFixed(2),
    dueDate,
    source: "codigo_barras",
  };
}

/**
 * Recebe o que a pessoa colou (linha digitável de 47 números ou código de
 * barras de 44, com ou sem pontos/espaços) e decodifica, validando o
 * checksum antes de aceitar — nunca decodifica um número que a pessoa possa
 * ter digitado errado sem avisar.
 */
export function parseBoletoCode(raw: string): ParsedBoleto {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 47) {
    if (!isValidLinhaBancaria(digits)) {
      throw new Error("Linha digitável inválida — confira os 47 números.");
    }
    return decodeLinhaDigitavel(digits);
  }

  if (digits.length === 44) {
    if (!isValidCodigoBarras(digits)) {
      throw new Error("Código de barras inválido — confira os 44 números.");
    }
    return decodeCodigoBarras(digits);
  }

  throw new Error(
    `Cole a linha digitável (47 números) ou o código de barras (44 números) do boleto — foram encontrados ${digits.length}.`,
  );
}
