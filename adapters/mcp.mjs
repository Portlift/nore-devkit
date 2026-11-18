import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"
import { exampleStep } from "./adapter-step.mjs"
import { startAdapter } from "./server.mjs"

startAdapter({
  path: "/mcp",
  defaultPort: 8790,
  async handle(request, response, message) {
    // Stateless Streamable HTTP lets each request use its own SDK transport.
    const server = new McpServer({ name: "nore-reference-adapter", version: "1.0.0" })
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true })
    server.registerTool("agentbench_step", {
      description: "Return one fixture turn for a controlled Nore evaluation.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        protocol: z.literal("agentbench/1"),
        runId: z.string(),
        scenario: z.string(),
        task: z.string(),
        chainId: z.number(),
        allowedTools: z.array(z.string()),
        fixture: z.unknown(),
        turn: z.number().int(),
        lastResult: z.unknown().optional()
      }
    }, async input => ({ content: [], structuredContent: exampleStep(input) }))

    response.once("close", () => { void server.close() })
    await server.connect(transport)
    await transport.handleRequest(request, response, message)
  }
})
