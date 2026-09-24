/**
 * Define o e-mail e a senha de acesso ao Holm Finance na Vercel (produção),
 * publica de novo (a Vercel só usa variáveis novas numa publicação nova) e
 * testa o login de verdade no final.
 *
 * A senha é digitada aqui, no seu terminal (não aparece na tela), vira um hash
 * e só o hash é enviado — a senha em si nunca é guardada nem mostrada.
 *
 * Uso:  npx tsx scripts/configurar-login.ts
 */
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";
import { hashPassword, verifyPassword } from "../src/lib/auth";

const SITE = "https://holm-finance.vercel.app";

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

async function testLogin(email: string, password: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${SITE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) return true;
    } catch {
      // tenta de novo
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  return false;
}

async function main() {
  const email = (await ask("E-mail de acesso: ")).trim().toLowerCase();
  if (!email.includes("@")) throw new Error("E-mail inválido.");
  const confirm = (await ask(`O e-mail é mesmo  ${email}  ? (s/n): `)).trim().toLowerCase();
  if (confirm !== "s") throw new Error("Cancelado — rode de novo e digite o e-mail certo.");

  const password = await ask("Senha (mínimo 12 caracteres): ", true);
  if (password.length < 12) throw new Error("Use uma senha com pelo menos 12 caracteres.");
  if (/[^\x20-\x7E]/.test(password)) {
    throw new Error("Use só letras sem acento, números e símbolos comuns (o terminal do Windows lê acento diferente do navegador).");
  }
  const again = await ask("Repita a senha: ", true);
  if (password !== again) throw new Error("As senhas não conferem.");

  const hash = hashPassword(password);
  if (!verifyPassword(password, hash)) throw new Error("Falha interna ao gerar a senha.");

  setVercelEnv("ADMIN_EMAIL", email);
  setVercelEnv("ADMIN_PASSWORD_HASH", hash);

  console.log("\nPublicando de novo pra valer a mudança (leva ~1 minuto)...");
  const deploy = spawnSync("npx", ["vercel", "redeploy", SITE, "--target", "production"], {
    stdio: "inherit",
    shell: true,
  });
  if (deploy.status !== 0) throw new Error("Não consegui publicar de novo. Avise o Claude.");

  console.log("\nTestando o login de verdade...");
  if (await testLogin(email, password)) {
    console.log(`\n✓ Login funcionando. Entre em ${SITE} com esse e-mail e essa senha.`);
  } else {
    console.log("\n✗ O teste de login falhou. Avise o Claude (não digite a senha pra ele).");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nErro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
