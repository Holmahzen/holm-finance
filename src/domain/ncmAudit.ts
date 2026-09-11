import { isSaleCfop } from "@/domain/fiscalNotes";

/**
 * Conferência de NCM das vendas: agrupa por produto, mostra os NCMs que cada
 * um já usou e marca o que merece revisão. As regras olham só o nome do
 * produto — composição do tecido e malha × tecido plano não estão nas notas,
 * então isto aponta o que conferir, não dá a classificação certa.
 */

export type NcmAuditRow = {
  productCode: string;
  description: string;
  ncm: string;
  cfop: string;
  netValue: number;
  quantity: number;
  issuerName: string;
  /** "YYYY-MM-DD". */
  issuedOn: string;
};

/** O que cada posição (4 primeiros dígitos) quer dizer — só as que aparecem numa confecção. */
export const NCM_POSITION_LABELS: Record<string, string> = {
  "5407": "Tecidos de fios de filamentos sintéticos",
  "6103": "Ternos, conjuntos, calças e shorts masculinos, de malha",
  "6104": "Conjuntos, vestidos, saias, calças e shorts femininos, de malha",
  "6105": "Camisas masculinas, de malha",
  "6106": "Blusas e camisas femininas, de malha",
  "6109": "Camisetas e regatas, de malha",
  "6114": "Outros vestuários, de malha",
  "6203": "Ternos, conjuntos, calças e shorts masculinos, de tecido plano",
  "6204": "Conjuntos, vestidos, saias, calças e shorts femininos, de tecido plano",
  "6205": "Camisas masculinas, de tecido plano",
  "6206": "Blusas e camisas femininas, de tecido plano",
  "6211": "Outros vestuários, de tecido plano",
  "6214": "Xales, lenços e artigos semelhantes",
  "6302": "Roupa de cama, mesa, banho e cozinha",
  "6304": "Outros artefatos para decoração de interiores",
  "6309": "Artigos têxteis usados",
  "6504": "Chapéus trançados",
  "6505": "Chapéus e toucas de malha, renda, feltro ou tecido",
};

export function positionLabel(ncm: string): string {
  return NCM_POSITION_LABELS[ncm.slice(0, 4)] ?? "—";
}

/** "61059000" → "6105.90.00". */
export function formatNcm(ncm: string): string {
  return /^\d{8}$/.test(ncm) ? `${ncm.slice(0, 4)}.${ncm.slice(4, 6)}.${ncm.slice(6)}` : ncm;
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nome do produto sem a variação: "JALECO CAVADO - G - AZUL" → "JALECO
 * CAVADO". O NCM é da peça, não do tamanho nem da cor.
 */
export function productBaseName(description: string): string {
  const text = normalizeText(description);
  return text.split(/\s+-|-\s+/)[0].trim() || text;
}

export type NcmFlagCode =
  | "VARIOS_NCM"
  | "NCM_DE_USADO"
  | "MASCULINO_EM_FEMININO"
  | "FEMININO_EM_MASCULINO"
  | "CHAPEU_FORA_DO_65"
  | "SAIA_FORA"
  | "CALCA_FORA"
  | "CAMISETA_FORA"
  | "JALECO_AVENTAL"
  | "TECIDO_PLANO_EM_MALHA"
  | "MALHA_EM_TECIDO_PLANO";

export type NcmFlag = { code: NcmFlagCode; severity: "alta" | "conferir"; message: string };

const HEADWEAR = /\b(TOUCA|TOUCAS|TOQUINHA|CHAPEU|BONE|GORRO|BOINA)\b/;
const OTHER_GARMENT = /\b(CAMISETA|CAMISA|CALCA|BATA|SAIA|CONJUNTO|JALECO|AVENTAL|VESTIDO)\b/;
/** Kit e conjunto seguem a peça principal; as regras de tipo de peça não valem para eles. */
const KIT = /\bKIT\b|\+|\bCONJUNTO\b/;
/** Tecidos planos (capítulo 62) e malhas (capítulo 61) que aparecem no nome dos anúncios. */
const WOVEN = /\b(OXFORD|TRICOLINE|BRIM|SARJA|GABARDINE|JEANS|LINHO)\b/;
const KNIT = /\b(MALHA|MOLETOM|RIBANA|SUEDINE|PIQUET|DRY FIT)\b/;

/** Alertas de um NCM usado por um produto (nome já normalizado). */
export function ncmFlagsFor(name: string, ncm: string): NcmFlag[] {
  const flags: NcmFlag[] = [];
  const code = formatNcm(ncm);

  if (ncm.startsWith("6309")) {
    flags.push({ code: "NCM_DE_USADO", severity: "alta", message: `${code} é da posição 6309, de artigos têxteis usados.` });
  }
  const woven = WOVEN.exec(name)?.[1];
  if (woven && ncm.startsWith("61")) {
    flags.push({
      code: "TECIDO_PLANO_EM_MALHA",
      severity: "alta",
      message: `Tecido plano (${woven.toLowerCase()}) em ${code}: o capítulo 61 é de roupa de malha; tecido plano vai no 62.`,
    });
  }
  const knit = KNIT.exec(name)?.[1];
  if (knit && ncm.startsWith("62")) {
    flags.push({
      code: "MALHA_EM_TECIDO_PLANO",
      severity: "alta",
      message: `Malha (${knit.toLowerCase()}) em ${code}: o capítulo 62 é de tecido plano; malha vai no 61.`,
    });
  }
  if (/MASCULIN/.test(name) && /^6[12]04/.test(ncm)) {
    flags.push({
      code: "MASCULINO_EM_FEMININO",
      severity: "alta",
      message: `Peça masculina em ${code}, posição de roupa feminina (6104/6204).`,
    });
  }
  if (/FEMININ/.test(name) && /^6[12]0[357]/.test(ncm)) {
    flags.push({
      code: "FEMININO_EM_MASCULINO",
      severity: "alta",
      message: `Peça feminina em ${code}, posição de roupa masculina.`,
    });
  }
  if (HEADWEAR.test(name) && !ncm.startsWith("65")) {
    const mixed = OTHER_GARMENT.test(name);
    flags.push({
      code: "CHAPEU_FORA_DO_65",
      severity: mixed ? "conferir" : "alta",
      message: mixed
        ? `Kit com touca/chapéu e outra peça em ${code}: o NCM segue a peça principal — conferir qual é.`
        : `Touca/chapéu em ${code}; chapéus e toucas ficam no capítulo 65.`,
    });
  }
  if (!KIT.test(name)) {
    if (/\bSAIA\b/.test(name) && !/^6[12]045/.test(ncm)) {
      flags.push({
        code: "SAIA_FORA",
        severity: "conferir",
        message: `Saia em ${code}; saia costuma ir em 6104.5x (malha) ou 6204.5x (tecido plano).`,
      });
    }
    if (/\bCALCA\b/.test(name) && !/^6[12]0(34|46)/.test(ncm)) {
      flags.push({
        code: "CALCA_FORA",
        severity: "conferir",
        message: `Calça em ${code}; calça costuma ir em 6103.4x/6203.4x (masculina) ou 6104.6x/6204.6x (feminina).`,
      });
    }
    if (/\bCAMISETA\b/.test(name) && !/^6109/.test(ncm)) {
      flags.push({
        code: "CAMISETA_FORA",
        severity: "conferir",
        message: `Camiseta em ${code}; camiseta de malha costuma ir em 6109.`,
      });
    }
    if (/\b(JALECO|AVENTAL)\b/.test(name) && !/^6(114|211)/.test(ncm)) {
      flags.push({
        code: "JALECO_AVENTAL",
        severity: "conferir",
        message: `Jaleco/avental em ${code}; costumam ir em 6211 (tecido plano) ou 6114 (malha), "outros vestuários".`,
      });
    }
  }
  return flags;
}

export type ProductNcmUse = {
  ncm: string;
  positionLabel: string;
  items: number;
  quantity: number;
  value: number;
  skus: string[];
  issuers: string[];
  lastSeen: string;
};

export type ProductAudit = {
  name: string;
  items: number;
  value: number;
  ncms: ProductNcmUse[];
  flags: NcmFlag[];
};

export type NcmSummary = {
  ncm: string;
  positionLabel: string;
  items: number;
  value: number;
  products: number;
  flaggedProducts: number;
};

export type NcmAudit = {
  products: ProductAudit[];
  byNcm: NcmSummary[];
  totals: {
    products: number;
    flaggedProducts: number;
    value: number;
    flaggedValue: number;
    ncms: number;
    firstSale: string | null;
    lastSale: string | null;
  };
};

type UseAcc = { items: number; quantity: number; value: number; skus: Set<string>; issuers: Set<string>; lastSeen: string };

/** Ordem da lista: primeiro o que tem algo a revisar, depois o que é só a conferir. */
function severityRank(p: ProductAudit): number {
  if (p.flags.some((f) => f.severity === "alta")) return 2;
  return p.flags.length > 0 ? 1 : 0;
}

export function buildNcmAudit(rows: NcmAuditRow[]): NcmAudit {
  const sales = rows.filter((r) => isSaleCfop(r.cfop));
  const byProduct = new Map<string, { items: number; value: number; ncms: Map<string, UseAcc> }>();
  let firstSale: string | null = null;
  let lastSale: string | null = null;

  for (const r of sales) {
    const name = productBaseName(r.description);
    const p = byProduct.get(name) ?? byProduct.set(name, { items: 0, value: 0, ncms: new Map() }).get(name)!;
    p.items += 1;
    p.value += r.netValue;
    const ncm = r.ncm || "sem NCM";
    const use =
      p.ncms.get(ncm) ??
      p.ncms.set(ncm, { items: 0, quantity: 0, value: 0, skus: new Set(), issuers: new Set(), lastSeen: "" }).get(ncm)!;
    use.items += 1;
    use.quantity += r.quantity;
    use.value += r.netValue;
    if (r.productCode) use.skus.add(r.productCode);
    use.issuers.add(r.issuerName);
    if (r.issuedOn > use.lastSeen) use.lastSeen = r.issuedOn;
    if (!firstSale || r.issuedOn < firstSale) firstSale = r.issuedOn;
    if (!lastSale || r.issuedOn > lastSale) lastSale = r.issuedOn;
  }

  const products: ProductAudit[] = [...byProduct.entries()]
    .map(([name, p]) => {
      const ncms = [...p.ncms.entries()]
        .map(([ncm, u]) => ({
          ncm,
          positionLabel: positionLabel(ncm),
          items: u.items,
          quantity: u.quantity,
          value: u.value,
          skus: [...u.skus].sort(),
          issuers: [...u.issuers].sort(),
          lastSeen: u.lastSeen,
        }))
        .sort((a, b) => b.value - a.value);
      const flags: NcmFlag[] = [];
      if (ncms.length > 1) {
        flags.push({
          code: "VARIOS_NCM",
          severity: "alta",
          message: `Sai com ${ncms.length} NCMs diferentes (${ncms.map((n) => formatNcm(n.ncm)).join(", ")}). O NCM é do produto e deveria ser um só.`,
        });
      }
      for (const n of ncms) flags.push(...ncmFlagsFor(name, n.ncm));
      return { name, items: p.items, value: p.value, ncms, flags };
    })
    .sort((a, b) => severityRank(b) - severityRank(a) || b.value - a.value);

  const ncmMap = new Map<string, NcmSummary>();
  for (const p of products) {
    for (const n of p.ncms) {
      const s =
        ncmMap.get(n.ncm) ??
        ncmMap
          .set(n.ncm, { ncm: n.ncm, positionLabel: n.positionLabel, items: 0, value: 0, products: 0, flaggedProducts: 0 })
          .get(n.ncm)!;
      s.items += n.items;
      s.value += n.value;
      s.products += 1;
      if (p.flags.length > 0) s.flaggedProducts += 1;
    }
  }

  const flagged = products.filter((p) => p.flags.length > 0);
  return {
    products,
    byNcm: [...ncmMap.values()].sort((a, b) => b.value - a.value),
    totals: {
      products: products.length,
      flaggedProducts: flagged.length,
      value: products.reduce((sum, p) => sum + p.value, 0),
      flaggedValue: flagged.reduce((sum, p) => sum + p.value, 0),
      ncms: ncmMap.size,
      firstSale,
      lastSale,
    },
  };
}
