import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildMcpServer } from "@/mcp/server";
import { isMcpAuthorized } from "@/lib/mcpAuth";

const TOKEN = "t".repeat(40);

describe("isMcpAuthorized", () => {
  it("aceita o Bearer certo", () => {
    expect(isMcpAuthorized(`Bearer ${TOKEN}`, TOKEN)).toBe(true);
  });

  it("recusa token errado, sem Bearer ou ausente", () => {
    expect(isMcpAuthorized(`Bearer ${"x".repeat(40)}`, TOKEN)).toBe(false);
    expect(isMcpAuthorized(TOKEN, TOKEN)).toBe(false);
    expect(isMcpAuthorized(null, TOKEN)).toBe(false);
  });

  it("fica fechado sem MCP_TOKEN ou com token curto", () => {
    expect(isMcpAuthorized("Bearer ", undefined)).toBe(false);
    expect(isMcpAuthorized("Bearer ", "")).toBe(false);
    expect(isMcpAuthorized("Bearer curto", "curto")).toBe(false);
  });
});

describe("servidor MCP", () => {
  it("expõe só ferramentas de leitura", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await buildMcpServer().connect(serverTransport);
    const client = new Client({ name: "teste", version: "0" });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "alertas",
      "dre",
      "dre_competencia",
      "fluxo_de_caixa",
      "lucratividade_produtos",
      "projecao_empresa",
      "recebiveis_mercado_livre",
      "resumo_do_mes",
      "saude_financeira",
    ]);
    for (const t of tools) {
      expect(t.annotations?.readOnlyHint, t.name).toBe(true);
      expect(t.annotations?.destructiveHint, t.name).toBe(false);
    }
    await client.close();
  });

  it("valida os argumentos antes de consultar o banco", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await buildMcpServer().connect(serverTransport);
    const client = new Client({ name: "teste", version: "0" });
    await client.connect(clientTransport);

    const res = await client.callTool({ name: "dre", arguments: { mes: 13 } });
    expect(res.isError).toBe(true);
    await client.close();
  });
});
