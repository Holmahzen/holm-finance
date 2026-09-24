/**
 * Define o e-mail e a senha de acesso ao Holm Finance na Vercel (produção).
 * A senha é digitada aqui, no seu terminal (não aparece na tela), vira um hash
 * e só o hash é enviado — a senha em si nunca é guardada nem mostrada.
 *
 * Uso:  npx tsx scripts/configurar-login.ts
 */
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { hashPassword } from "../src/lib/auth";

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const anyRl = rl as unknown as { _writeToOutput: (s: string) => void };
      anyRl._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function setVercelEnv(name: string, value: string) {
  spawnSync("npx", ["vercel", "env", "rm", name, "production", "--yes"], { stdio: "ignore", shell: true });
  const r = spawnSync("npx", ["vercel", "env", "add", name, "production"], {
    input: value,
    stdio: ["pipe", "ignore", "inherit"],
    shell: true,
  });
  if (r.status !== 0) throw new Error(`Falhou ao gravar ${name} na Vercel.`);
  console.log(`✓ ${name} gravado na Vercel (produção)`);
}

async function main() {
  const email = (await ask("E-mail de acesso: ")).trim().toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido.");

  const password = await ask("Senha (mínimo 12 caracteres): ", true);
  if (password.length < 12) throw new Error("Use uma senha com pelo menos 12 caracteres.");
  const again = await ask("Repita a senha: ", true);
  if (password !== again) throw new Error("As senhas não conferem.");

  setVercelEnv("ADMIN_EMAIL", email);
  setVercelEnv("ADMIN_PASSWORD_HASH", hashPassword(password));
  console.log("\nPronto. Avise o Claude que terminou — falta só publicar.");
}

main().catch((e) => {
  console.error("\nErro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
