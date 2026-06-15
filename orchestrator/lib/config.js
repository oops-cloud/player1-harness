// orchestrator/lib/config.js
// All tunable knobs in one place. Everything overridable by env in the Actions workflow.
// These are the "tunable knobs" from HARNESS.md §9 — none of them are the agent's to change.

module.exports = {
  // The brain. Swap this for a stronger model to raise player1's ceiling
  // (see HARNESS.md — the model is the ceiling, and it's the operator's lever, not the agent's).
  model: process.env.PLAYER1_MODEL || 'claude-opus-4-8',

  // Anthropic API
  anthropicBase: 'https://api.anthropic.com/v1/messages',
  apiKey: process.env.ANTHROPIC_API_KEY,
  anthropicVersion: '2023-06-01',
  maxTokens: Number(process.env.PLAYER1_MAX_TOKENS || 16000),

  // Lifelines (HARNESS.md §5)
  budget: {
    // Hard ceiling on model spend for a single session, in USD. Abort cleanly if exceeded.
    perSessionUsd: Number(process.env.PLAYER1_SESSION_BUDGET_USD || 2.0),
    // Cumulative runway. When the ledger crosses this, the agent pauses rather than dying messily.
    totalUsd: Number(process.env.PLAYER1_TOTAL_BUDGET_USD || 200.0),
  },

  // Stuck handling (HARNESS.md §5): give up a session gracefully after K failed attempts.
  maxAttemptsPerSession: Number(process.env.PLAYER1_MAX_ATTEMPTS || 3),

  // Where things live. The harness checks the workspace out next to itself.
  workspaceDir: process.env.PLAYER1_WORKSPACE_DIR || '../workspace',

  // Solana / Anchor
  rpcUrl: process.env.HELIUS_RPC_URL || 'https://api.devnet.solana.com',

  // Identity of the committer. Every commit is signed by the bot — zero humans (the moat).
  gitAuthorName: 'player1',
  gitAuthorEmail: process.env.PLAYER1_GIT_EMAIL || 'player1@oops-cloud.bot',
};
