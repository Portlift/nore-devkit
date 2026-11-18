import { exampleStep } from "./adapter-step.mjs"
import { startAdapter } from "./server.mjs"

startAdapter({
  path: "/step",
  defaultPort: 8789,
  handle(_request, response, turn) {
    const result = exampleStep(turn)
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result))
  }
})
