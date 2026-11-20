# Nore developer kit

Connect an agent to Nore, run a versioned evaluation suite in CI, and keep the JSON report with your release. This kit includes the CLI, reference adapters for HTTP and MCP, and examples for local and hosted runs.

[Open Nore’s public beta](https://noreagent.xyz/) · [Read the docs](https://noreagent.xyz/docs)

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

## Run a suite on the hosted beta

To try Nore with a built-in test agent, connect a wallet in the [workspace](https://noreagent.xyz/app) and select **Start sandbox**. Choose **Open Failure Recovery**, run the suite, and open its report.

To run your own agent, get its exact HTTPS origin approved by the Nore operator before registering the endpoint. An external webhook receiver needs origin approval too. See the [hosted adapter guide](https://noreagent.xyz/docs#connect-agent).

1. Open the [workspace](https://noreagent.xyz/app), connect your wallet, and sign the sign-in message to open your personal workspace.
2. Under **Agents → Register agent**, select HTTP or MCP and enter the approved endpoint and its bearer credential, if required. For MCP, discover and approve a compatible step tool on the agent version.
3. Under **Test suites → New test suite**, select your agent, network, and cases. Save and publish the suite, then note its slug and published version. The [wallet safety definition](examples/wallet-safety.json) shows an example to adapt to your own agent.
4. In **API keys**, create a workspace key with `read` and `runs:write`. Store it as `NORE_API_KEY` in your local secret manager or CI secret store.
5. Run the CLI from this checkout with Node.js 24 or later. Replace `wallet-safety` and `1` with your suite slug and published version.

```sh
npm ci
export NORE_URL=https://noreagent.xyz
npm run nore -- run --suite wallet-safety --version 1 --gate strict --output evaluation.json
```

The CLI submits the suite, polls for a terminal result, and saves the JSON report. A failed gate still produces a report when the API has one. For another Nore installation, set `NORE_URL` to its HTTPS origin. Loopback HTTP is supported for local development. See the [CLI reference](docs/cli.md) for exit codes and the [OpenAPI snapshot](docs/openapi.json) for API fields.

To run the gate in GitHub Actions, copy [the release workflow](examples/nore-release-gate.yml) into `.github/workflows/` in a checkout containing `bin/nore.mjs`. Set the `NORE_URL` repository variable to `https://noreagent.xyz` and add the `NORE_API_KEY` Actions secret. Open **Actions → Nore release gate → Run workflow** and enter the published suite and version. The report uploads even when the strict gate fails.

## Production evaluation

On November 20, 2026, all six cases passed through a hosted HTTPS adapter from the Nore public beta. Nore blocked a wrong-chain proposal and verified an approved transfer on a Robinhood Chain mainnet fork at block `117172638`. The webhook receiver verified the signatures on `run.started` and `run.completed` for the run. [Sanitized production results](examples/robinhood-production-beta-summary.json)

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
