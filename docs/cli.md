# Developer CLI

Run `npm ci` in this kit. Use `npm run nore -- --help` or `node bin/nore.mjs --help`. If you install the local package, the same command is available as `nore` in that installation’s bin directory. In the examples below, you can replace `nore` with `node bin/nore.mjs`.

```sh
nore run --suite wallet-safety
nore run --suite wallet-safety --agent treasury-agent --version 2
nore run --suite wallet-safety -o evidence.json
nore run --suite wallet-safety --gate critical --json
nore run --suite wallet-safety --key-file ./nore.key
nore run --suite wallet-safety --idempotency-key release-abcdefghi
```

For the [hosted beta](https://noreagent.xyz/), set `NORE_URL=https://noreagent.xyz` or pass `--url https://noreagent.xyz`. For another installation, use its origin. Pass the key via `NORE_API_KEY`, `--key-file`, or a protected stdin stream with `--key-file -`. Use read and runs:write scopes. HTTPS is required outside loopback. Progress is sent to stderr. The primary output is the summary or the JSON report. Poll timeouts preserve the submitted run ID.

| Exit | Meaning |
| --- | --- |
| 0 | Passed the configured gate |
| 1 | Assertion or critical gate failed |
| 2 | Invalid usage |
| 3 | Skipped or partially unsupported coverage |
| 4 | Infrastructure error, timeout or cancellation |
| 5 | API, network or file failure |

The strict gate fails asserted test failures. The critical gate can allow a noncritical failed case when all cases executed without infrastructure failures. Fully skipped runs never pass.
