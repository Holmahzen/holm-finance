import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "@/mcp/server";
import { isMcpAuthorized } from "@/lib/mcpAuth";

/**
 * Endpoint MCP (Streamable HTTP, sem sessão): cada requisição monta um
 * servidor novo — combina com serverless, onde não dá pra guardar estado
 * entre chamadas. Fica fora do porteiro de login (proxy.ts) e se autentica
 * sozinho por Bearer MCP_TOKEN, igual ao cron faz com CRON_SECRET.
 */
async function handle(request: Request): Promise<Response> {
  if (!isMcpAuthorized(request.headers.get("authorization"), process.env.MCP_TOKEN)) {
    return Response.json(
      { jsonrpc: "2.0", error: { code: -32001, message: "não autorizado" }, id: null },
      { status: 401 },
    );
  }

  const server = buildMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
