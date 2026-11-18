# Nore developer kit

Connect an agent to Nore, run a versioned evaluation suite in CI, and keep the JSON report with your release. This kit includes the CLI, reference adapters for HTTP and MCP, and examples for local and hosted runs.

## Run the sample CI job

Use Node.js 24 or later. From this checkout, run:

```sh
npm ci
npm test
npm run demo
```

The adapter tests start both servers and call them over loopback. The demo submits two cases to a loopback fixture API and exercises the same CLI used by the release gate.

| Fixture suite | Strict CLI exit | Report |
| --- | ---: | --- |
| `wallet-safety` | `0` | `sample-reports/wallet-safety.json` |
| `wallet-safety-regression` | `1` | `sample-reports/wallet-safety-regression.json` |

The demo passes when both outcomes match and both reports are saved. The fixture reports describe the CI rehearsal. The [recorded Robinhood Chain pilot](examples/robinhood-pilot-summary.json) contains real fork evidence from a separate evaluation.

The [sample workflow](.github/workflows/sample-ci.yml) runs the same install, tests, and demo in GitHub Actions and uploads both reports. It needs no Nore workspace, credentials, wallet, or chain RPC.

## Run a suite on Nore

1. In a Nore workspace, register an agent, associate a policy as appropriate, and publish a suite. [Wallet safety](examples/wallet-safety.json) is an example suite definition. Substitute your own agent ID before using it with the API.
2. Create a workspace API key with `read` and `runs:write` scopes. Use your secret manager to set `NORE_API_KEY` and set `NORE_URL` to your Nore HTTPS origin. The CLI also accepts loopback HTTP for local development.
3. Use the suite slug and version from your workspace.

```sh
npm run nore -- run --suite wallet-safety --version 1 --gate strict --output evaluation.json
```

The CLI submits the suite, polls until it finishes, and saves the report. A failure still produces a report when the API has one. See the [CLI reference](docs/cli.md) for exit codes and the [OpenAPI snapshot](docs/openapi.json) for API fields.

To make that suite a release gate, copy [the release workflow](examples/nore-release-gate.yml) into `.github/workflows/` in a checkout containing `bin/nore.mjs`. In GitHub, set the `NORE_URL` repository variable and `NORE_API_KEY` Actions secret. Open **Actions → Nore release gate → Run workflow** and enter the published suite and version. The report uploads even when the strict gate fails.

## Connect an adapter

The two reference servers implement the same fixture behavior. They accept one evaluation turn and return an unsigned proposal or final outcome. They use disposable inputs and require no signing keys.

Set `EXAMPLE_ADAPTER_KEY` to a bearer secret, then start the adapter you want:

| Adapter | Command | Local endpoint |
| --- | --- | --- |
| HTTP | `npm run adapter:http` | `http://127.0.0.1:8789/step` |
| MCP Streamable HTTP | `npm run adapter:mcp` | `http://127.0.0.1:8790/mcp` |

To register one with a hosted Nore instance, serve it through an authenticated HTTPS proxy and register the exact URL and bearer credential. The Nore operator needs to allow that HTTPS origin. For MCP, select the tool `agentbench_step` on the approved agent version. See the [adapter contract](docs/adapters.md) for request and response examples.

## License

The Nore developer kit is available under the [MIT License](LICENSE).
