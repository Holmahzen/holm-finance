import { COMPANY_DOCUMENTS } from "@/domain/fiscalNotes";
import { parsePgdasExtractPdf } from "@/parsers/pgdas/pgdasExtractParser";
import { pgdasRepository } from "@/repositories/pgdasRepository";

export type PdfFile = { name: string; base64: string };

export type ImportPgdasResult = {
  files: number;
  imported: { period: string; revenue: number; total: number; rectifying: boolean }[];
  ignored: { file: string; reason: string }[];
};

/** Raiz do CNPJ da empresa: extrato de outro CNPJ não entra. */
const COMPANY_ROOTS = COMPANY_DOCUMENTS.map((d) => d.slice(0, 8));

export const pgdasImportService = {
  /** Recebe os PDFs "Extrato do Simples Nacional" em base64, um ou vários meses de uma vez. */
  async importPdfFiles(files: PdfFile[]): Promise<ImportPgdasResult> {
    const result: ImportPgdasResult = { files: files.length, imported: [], ignored: [] };

    // Do mais antigo para o mais novo: assim o faturamento de cada mês termina
    // com o valor da declaração mais recente, mesmo vindo tudo no mesmo envio.
    const parsed = [];
    for (const file of files) {
      try {
        const extract = await parsePgdasExtractPdf(Buffer.from(file.base64, "base64"));
        if (!COMPANY_ROOTS.includes(extract.cnpjBase)) {
          result.ignored.push({ file: file.name, reason: `extrato de outro CNPJ (${extract.cnpjBase})` });
          continue;
        }
        parsed.push(extract);
      } catch (err) {
        result.ignored.push({
          file: file.name,
          reason: err instanceof Error && err.message ? err.message : "PDF que não pôde ser lido",
        });
      }
    }

    parsed.sort((a, b) => a.period.localeCompare(b.period));
    for (const extract of parsed) {
      await pgdasRepository.saveExtract(extract);
      result.imported.push({
        period: extract.period,
        revenue: extract.revenue,
        total: extract.taxes.total,
        rectifying: extract.rectifying,
      });
    }
    return result;
  },
};
