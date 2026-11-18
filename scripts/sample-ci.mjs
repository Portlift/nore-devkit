import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { randomBytes } from "node:crypto"
import { mkdir, readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const run = promisify(execFile)
const cli = fileURLToPath(new URL("../bin/nore.mjs", import.meta.url))
const reportsDirectory = resolve("sample-reports")
const key = "abk_" + randomBytes(32).toString("base64url")
const cases = new Map([
  ["wallet-safety", { status: "PASSED", summary: { pass: 1, fail: 0, skip: 0, infra: 0, critical: 0 } }],
  ["wallet-safety-regression", { status: "FAILED", summary: { pass: 0, fail: 1, skip: 0, infra: 0, critical: 1 } }]
])
const submitted = new Map()

function send(response, status, data) {
  response.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(data))
}

// A loopback fixture for exercising the CLI's API and exit-code contract in CI.
const server = createServer(async (request, response) => {
  if (request.headers.authorization !== "Bearer " + key) {
    send(response, 401, { error: { message: "Unauthorized fixture request" } })
    return
  }

  if (request.method === "POST" && request.url === "/api/v1/runs") {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    let input
    try {
      input = JSON.parse(Buffer.concat(chunks))
    } catch {
      send(response, 400, { error: { message: "Expected a JSON run request" } })
      return
    }
    const { suite, version } = input ?? {}
    if (!cases.has(suite) || version !== 1 || !request.headers["idempotency-key"]) {
      send(response, 400, { error: { message: "Expected a known suite, version 1, and an idempotency key" } })
      return
    }
    submitted.set(suite, { fixture: true, suite, suiteVersion: version, runId: suite, ...cases.get(suite) })
    send(response, 202, { data: { id: suite, status: "QUEUED" } })
    return
  }

  const match = /^\/api\/v1\/(runs|reports)\/([^/]+)$/.exec(request.url ?? "")
  const result = match && submitted.get(match[2])
  if (request.method === "GET" && result) {
    send(response, 200, { data: match[1] === "runs" ? { id: result.runId, status: result.status } : result })
    return
  }
  send(response, 404, { error: { message: "Unknown fixture route" } })
})

await mkdir(reportsDirectory, { recursive: true })
await new Promise((resolveListen, reject) => {
  server.once("error", reject)
  server.listen(0, "127.0.0.1", resolveListen)
})

try {
  const env = { ...process.env, NORE_URL: `http://127.0.0.1:${server.address().port}`, NORE_API_KEY: key }
  for (const [suite, expected] of cases) {
    const path = resolve(reportsDirectory, suite + ".json")
    const args = [cli, "run", "--suite", suite, "--version", "1", "--gate", "strict", "--timeout", "10", "--output", path]
    let exit = 0
    try {
      await run(process.execPath, args, { env, timeout: 15_000 })
    } catch (error) {
      if (typeof error.code !== "number") throw error
      exit = error.code
    }
    const expectedExit = expected.status === "PASSED" ? 0 : 1
    assert.equal(exit, expectedExit, `Strict gate for ${suite}`)
    assert.deepEqual(JSON.parse(await readFile(path, "utf8")), submitted.get(suite))
    console.log(`${suite}: ${expected.status}, exit ${exit} (fixture report saved)`)
  }
} finally {
  await new Promise(resolveClose => server.close(resolveClose))
}
