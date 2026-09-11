/**
 * Leitor mínimo de .zip, sem biblioteca, que roda no navegador (e no Node,
 * para os testes). O .zip de notas que o Tiny exporta passa fácil de 4,5 MB,
 * o limite de corpo de requisição da Vercel — então ele é aberto aqui, no
 * cliente, e só os XMLs seguem para o servidor, em lotes.
 *
 * Suporta os dois métodos que aparecem na prática (0 = sem compressão,
 * 8 = deflate) e .zip dentro de .zip. Não suporta zip64 nem arquivo com senha.
 */

export type ZipEntry = { name: string; data: Uint8Array };

const SIG_END_OF_CENTRAL_DIR = 0x06054b50;
const SIG_CENTRAL_DIR = 0x02014b50;
const SIG_LOCAL_HEADER = 0x04034b50;

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // O diretório central fica no fim do arquivo; o registro que aponta pra ele
  // tem 22 bytes mais um comentário opcional de até 64 KB.
  let end = -1;
  const lowest = Math.max(0, bytes.length - 22 - 0xffff);
  for (let i = bytes.length - 22; i >= lowest; i--) {
    if (view.getUint32(i, true) === SIG_END_OF_CENTRAL_DIR) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("O arquivo não é um .zip válido.");

  const entryCount = view.getUint16(end + 10, true);
  let p = view.getUint32(end + 16, true);
  const utf8 = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];

  for (let n = 0; n < entryCount; n++) {
    if (view.getUint32(p, true) !== SIG_CENTRAL_DIR) {
      throw new Error("O .zip está corrompido (diretório central inválido).");
    }
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compressedSize = view.getUint32(p + 20, true);
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    p += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue; // pasta
    if (flags & 0x1) throw new Error(`"${name}" está protegido por senha.`);
    if (view.getUint32(localOffset, true) !== SIG_LOCAL_HEADER) {
      throw new Error(`O .zip está corrompido ("${name}").`);
    }

    // O cabeçalho local pode ter "extra" de tamanho diferente do central.
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressedSize);

    let data: Uint8Array;
    if (method === 0) data = raw;
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error(`"${name}" usa um tipo de compressão não suportado (${method}).`);

    if (name.toLowerCase().endsWith(".zip") && isZip(data)) {
      entries.push(...(await readZip(data)));
    } else {
      entries.push({ name, data });
    }
  }

  return entries;
}

async function inflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([raw.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Quase todo XML de NF-e é UTF-8, mas emissor antigo de fornecedor às vezes
 * grava em ISO-8859-1 — lido como UTF-8, "CONFECÇÕES" vira lixo.
 */
export function decodeXml(bytes: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 120));
  const declared = /encoding\s*=\s*["']([^"']+)["']/i.exec(head)?.[1]?.toLowerCase();
  const latin = declared === "iso-8859-1" || declared === "latin1" || declared === "windows-1252";
  return new TextDecoder(latin ? "windows-1252" : "utf-8").decode(bytes);
}
