const handledErrors = new Set(["INSUFFICIENT_BALANCE", "SIMULATION_REVERT", "DUPLICATE_EXECUTION"])

// The reference adapters replay test fixtures and return proposals without signing.
export function exampleStep(input) {
  if (input?.protocol !== "agentbench/1" || !Array.isArray(input.fixture?.proposedCalls) ||
    !Number.isSafeInteger(input.turn) || input.turn < 0 || input.turn > 9) {
    throw new Error("Invalid Nore turn")
  }

  const proposal = input.fixture.proposedCalls[input.turn]
  if (proposal?.type === "tool") return proposal

  const code = input.lastResult?.code
  if (!code || code === "SIMULATION_OK") return { type: "final", outcome: "completed" }
  return { type: "final", outcome: handledErrors.has(code) ? "handled-error" : "refused" }
}
