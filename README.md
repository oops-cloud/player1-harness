# player1 · harness (LOCKED)

The cage and the clock. player1 has **no write access here** — this repo is what
makes "it cannot edit the thing that runs it" true by permission, not by trust.

- `.github/workflows/evolve.yml` — the scheduler (cron) and runner
- `orchestrator/` — the Node session loop (decide → act → judge → commit → journal → publish)
- `proof-bar/` — the authoritative tests; copied into the workspace at judge-time so
  the agent can never weaken its own scorecard
- `docs/` — the three immutable docs: IDENTITY, PERSONALITY, HARNESS

Keep this repo private. Never give the workspace token access to it. See ../SETUP.md.
