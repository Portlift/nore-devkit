import { createServer } from "node:http"
import { timingSafeEqual } from "node:crypto"

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 30_000) throw new RequestError(413, "Request too large")
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new RequestError(400, "Expected a JSON request body")
  }
}

export function startAdapter({ path, defaultPort, handle }) {
  const key = process.env.EXAMPLE_ADAPTER_KEY
  if (!key) throw new Error("Set EXAMPLE_ADAPTER_KEY for inbound authentication")
  const expected = Buffer.from(`Bearer ${key}`)

  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== path) {
      response.writeHead(404).end()
      return
    }

    const presented = Buffer.from(request.headers.authorization ?? "")
    if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      response.writeHead(401).end()
      return
    }

    try {
      await handle(request, response, await readJson(request))
    } catch (error) {
      if (response.headersSent) {
        response.end()
        return
      }
      const status = error instanceof RequestError ? error.status : 400
      response.writeHead(status).end()
    }
  })

  server.listen(Number(process.env.EXAMPLE_ADAPTER_PORT ?? defaultPort), "127.0.0.1", () => {
    console.log(`Listening on http://127.0.0.1:${server.address().port}${path}`)
  })
}
