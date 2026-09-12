import { readFileSync } from "node:fs";
import { request } from "node:https";
import { DomainError } from "@/domain/errors";

/**
 * Conexão com os serviços da Receita. Eles exigem TLS mútuo: o servidor só
 * responde se o cliente apresentar o certificado digital da empresa (A1, um
 * arquivo .pfx/.p12 com senha).
 *
 * O arquivo e a senha ficam no .env, nunca no código:
 *   NFE_CERT_PATH="C:\\caminho\\certificado.pfx"
 *   NFE_CERT_PASSWORD="senha do certificado"
 */

export type SefazCertificate = { pfx: Buffer; passphrase: string };

export function loadCertificate(): SefazCertificate {
  const passphrase = process.env.NFE_CERT_PASSWORD;
  const path = process.env.NFE_CERT_PATH;
  // Na nuvem não existe caminho de arquivo: lá o certificado vai em base64.
  const base64 = process.env.NFE_CERT_BASE64;
  if (!passphrase || (!path && !base64)) {
    throw new DomainError(
      "Falta configurar o certificado: coloque NFE_CERT_PASSWORD e NFE_CERT_PATH (caminho do .pfx) — ou NFE_CERT_BASE64, na nuvem — e reinicie o servidor.",
    );
  }
  if (base64) return { pfx: Buffer.from(base64, "base64"), passphrase };
  try {
    return { pfx: readFileSync(path!), passphrase };
  } catch {
    throw new DomainError(`Não consegui abrir o certificado em ${path}. Confira o caminho no .env.`);
  }
}

export function postSoap(
  url: string,
  envelope: string,
  certificate: SefazCertificate,
  timeoutMs = 30_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = request(
      {
        host: target.hostname,
        path: target.pathname + target.search,
        method: "POST",
        pfx: certificate.pfx,
        passphrase: certificate.passphrase,
        headers: {
          "Content-Type": "application/soap+xml; charset=utf-8",
          "Content-Length": Buffer.byteLength(envelope),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 0) >= 400) {
            reject(new DomainError(`A Receita respondeu ${res.statusCode}: ${body.slice(0, 300)}`, 502));
            return;
          }
          resolve(body);
        });
      },
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new DomainError("A Receita não respondeu a tempo. Tente de novo em alguns minutos.", 504));
    });
    // Senha errada no .pfx aparece aqui, como erro de TLS.
    req.on("error", (err) =>
      reject(
        err instanceof DomainError
          ? err
          : new DomainError(`Não foi possível falar com a Receita: ${err.message}`, 502),
      ),
    );
    req.end(envelope);
  });
}
