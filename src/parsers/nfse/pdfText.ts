/**
 * Extrai o texto de um PDF. O worker que o pdf-parse carrega (pdfjs-dist)
 * referencia `DOMMatrix` no escopo do módulo — existe no navegador, não em
 * Node.js, então sem o polyfill o pacote quebra em produção. @napi-rs/canvas
 * (já é dependência do pdf-parse) tem uma implementação de verdade.
 */
async function ensureDomMatrixPolyfill() {
  if (typeof globalThis.DOMMatrix !== "undefined") return;
  const { DOMMatrix } = await import("@napi-rs/canvas");
  // @ts-expect-error -- polyfill de ambiente Node, não é o DOMMatrix do lib.dom.
  globalThis.DOMMatrix = DOMMatrix;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // Import dinâmico: se o binário nativo falhar ao carregar, o erro vira uma
  // exceção normal (pega pelo try/catch de quem chama, por arquivo) em vez de
  // derrubar o carregamento do módulo inteiro da rota.
  await ensureDomMatrixPolyfill();
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
}
