import { COMPANY_DOCUMENTS } from "@/domain/fiscalNotes";
import { buildDistributionEnvelope, hasMore, parseDistributionResponse } from "@/domain/sefazDistribution";
import { loadCertificate, postSoap } from "@/lib/sefazClient";
import { sefazDocumentRepository } from "@/repositories/sefazDocumentRepository";
import { fiscalNoteImportService } from "@/services/fiscalNoteImportService";

/** Ambiente nacional da Distribuição DF-e (produção). */
const DISTRIBUTION_URL = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";

/** 138 = documentos localizados; 137 = nenhum documento novo. */
const FOUND = "138";
const NONE = "137";

/** Cada consulta traz até 50 documentos; a Receita limita a frequência, então o padrão é conservador. */
const MAX_BATCHES = 5;

export const sefazDistributionService = {
  /**
   * Busca na Receita os documentos emitidos contra o CNPJ da empresa, a partir
   * do último NSU lido, e importa sozinho as notas que vierem inteiras.
   */
  async sync({ maxBatches = MAX_BATCHES }: { maxBatches?: number } = {}) {
    const certificate = loadCertificate();
    const cnpj = (process.env.NFE_CNPJ ?? COMPANY_DOCUMENTS[0]).replace(/\D/g, "");
    const ufCode = process.env.NFE_UF_CODE ?? "35";
    const environment = process.env.NFE_AMBIENTE === "2" ? "2" : "1";

    const state = await sefazDocumentRepository.getState();
    let lastNsu = state.lastNsu;
    let maxNsu = state.maxNsu;
    let status = "";
    let message = "";
    let saved = 0;
    let batches = 0;

    for (let i = 0; i < maxBatches; i++) {
      const envelope = buildDistributionEnvelope({ cnpj, environment, ufCode, lastNsu });
      const result = parseDistributionResponse(await postSoap(DISTRIBUTION_URL, envelope, certificate));
      batches += 1;
      status = result.status;
      message = result.message;
      maxNsu = result.maxNsu || maxNsu;

      saved += await sefazDocumentRepository.saveDocuments(result.documents);
      if (result.lastNsu) lastNsu = result.lastNsu;

      if (status === NONE) break;
      if (status !== FOUND) break; // 656 (consumo indevido) e outros erros: para e mostra a mensagem
      if (!hasMore(result)) break;
    }

    await sefazDocumentRepository.saveState({ lastNsu, maxNsu, lastStatus: status, lastMessage: message });
    const imported = await this.importFullNotes();

    return {
      status,
      message,
      lastNsu,
      maxNsu,
      batches,
      newDocuments: saved,
      importedNotes: imported.notes,
      counts: await sefazDocumentRepository.counts(),
    };
  },

  /** Manda para o importador de XML as notas inteiras que a Receita entregou. */
  async importFullNotes() {
    const documents = await sefazDocumentRepository.findFullNotesToImport();
    if (documents.length === 0) return { notes: 0 };

    const result = await fiscalNoteImportService.importXmlFiles(
      documents.map((d) => ({ name: `receita-nsu-${d.nsu}.xml`, content: d.xml })),
    );
    await sefazDocumentRepository.markImported(documents.map((d) => d.nsu));
    return { notes: result.newNotes + result.updatedNotes };
  },

  async getReport() {
    const [state, counts, pending] = await Promise.all([
      sefazDocumentRepository.getState(),
      sefazDocumentRepository.counts(),
      sefazDocumentRepository.listPendingSummaries(),
    ]);
    return {
      state,
      counts,
      configured: Boolean((process.env.NFE_CERT_PATH || process.env.NFE_CERT_BASE64) && process.env.NFE_CERT_PASSWORD),
      pending: pending.map((p) => ({ ...p, total: p.total == null ? null : Number(p.total) })),
    };
  },
};
