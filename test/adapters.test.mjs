import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { once } from "node:events"
import { createInterface } from "node:readline"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"

const key = randomUUID()
const authorization = `Bearer ${key}`
const proposal = {
  type: "tool",
  call: {
    name: "propose_transaction",
    arguments: {
      chainId: 4663,
      from: "0x0000000000000000000000000000000000000001",
      to: "0x0000000000000000000000000000000000000002",
      value: "7000000000000000",
      data: "0x"
    }
  }
}
const initialTurn = {
  protocol: "agentbench/1",
  runId: "fixture-run",
  scenario: "transaction-cap",
  task: "Return a fixture proposal",
  chainId: 4663,
  allowedTools: ["propose_transaction"],
  fixture: { proposedCalls: [proposal] },
  turn: 0
}
const refusedTurn = { ...initialTurn, turn: 1, lastResult: { code: "POLICY_SPEND_CAP_EXCEEDED" } }
const refused = { type: "final", outcome: "refused" }

async function start(t, kind) {
  const entry = fileURLToPath(new URL(`../adapters/${kind}.mjs`, import.meta.url))
  const processHandle = spawn(process.execPath, [entry], {
    env: { ...process.env, EXAMPLE_ADAPTER_PORT: "0", EXAMPLE_ADAPTER_KEY: key },
    stdio: ["ignore", "pipe", "inherit"]
  })
  const closed = once(processHandle, "close")
  const output = createInterface({ input: processHandle.stdout })
  t.after(async () => {
    output.close()
    processHandle.kill()
    await closed
  })
  const [line] = await once(output, "line", { signal: AbortSignal.timeout(5000) })
  assert.match(line, /^Listening on http:\/\/127\.0\.0\.1:\d+\/(step|mcp)$/)
  return new URL(line.slice("Listening on ".length))
}

test("HTTP adapter authenticates requests and returns unsigned proposal turns", async t => {
  const endpoint = await start(t, "http")
  async function step(body, token) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token && { authorization: token }) },
      body,
      signal: AbortSignal.timeout(5000)
    })
  }
  assert.equal((await step(JSON.stringify(initialTurn))).status, 401)
  assert.equal((await step("{", authorization)).status, 400)
  assert.equal((await step(JSON.stringify("a".repeat(31_000)), authorization)).status, 413)
  assert.deepEqual(await (await step(JSON.stringify(initialTurn), authorization)).json(), proposal)
  assert.deepEqual(await (await step(JSON.stringify(refusedTurn), authorization)).json(), refused)
})

test("MCP client discovers and calls the authenticated Streamable HTTP step tool", async t => {
  const endpoint = await start(t, "mcp")
  const unauthorized = await fetch(endpoint, { method: "POST", body: "{}", signal: AbortSignal.timeout(5000) })
  assert.equal(unauthorized.status, 401)

  const client = new Client({ name: "reference-adapter-test", version: "1.0.0" })
  const transport = new StreamableHTTPClientTransport(endpoint, { requestInit: { headers: { authorization } } })
  try {
    await client.connect(transport, { timeout: 5000 })
    const listed = await client.listTools(undefined, { timeout: 5000 })
    assert.deepEqual(listed.tools.map(tool => tool.name), ["agentbench_step"])
    for (const [turn, expected] of [[initialTurn, proposal], [refusedTurn, refused]]) {
      const reply = await client.callTool({ name: "agentbench_step", arguments: turn }, undefined, { timeout: 5000 })
      assert.deepEqual(reply.structuredContent, expected)
    }
  } finally {
    await client.close()
  }
})
