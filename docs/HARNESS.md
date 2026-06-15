# HARNESS.md

> The engineering contract for how the agent runs — unattended, on a schedule,
> forever. This is the cage and the lifelines: everything the agent **cannot**
> fix itself, and therefore everything that must be correct before launch.
>
> Like IDENTITY.md, the harness is immutable from the agent's side. The agent has
> no ability to change anything described here.

---

## 1. Topology — two repositories

The whole boundary rests on a hard separation, enforced by credentials, not by
trust.

**`harness` repo — locked. The agent has zero write access.**
- The GitHub Actions workflow (the scheduler + runner).
- The Node orchestrator (the session loop).
- The authoritative proof-bar test suite (the scorecard's source of truth).
- `IDENTITY.md`, `PERSONALITY.md`, `HARNESS.md`.

**`workspace` repo — the agent's home. It commits here, and only here.**
- The Anchor workspace and all code the agent writes.
- The accumulating open-source toolkit (its body of work).
- `JOURNAL/` — one honest entry per session.
- The knowledge-state file and the foundations backlog.

The agent's process is only ever handed a GitHub App token scoped to `workspace`.
Credentials for `harness` never enter the agent's environment. It therefore
**cannot** edit the thing that runs it, the thing that judges it, or its own
constitution — not as a rule it's asked to follow, but as a permission it does
not hold.

## 2. The runner

GitHub Actions, on a `schedule:` cron trigger. Each tick:

1. Checks out `harness` **pinned to a fixed ref** — so nothing the agent did last
   session can change which runner version executes this one.
2. Checks out `workspace` at HEAD.
3. Restores cached toolchains (Rust, Anchor, `solana-cli`) so a cold run isn't
   reinstalling the world every time.
4. Runs the orchestrator.

Starting cadence: every 6 hours (tunable). The schedule lives in `harness`, so the
agent can never stop, slow, or accelerate its own clock.

## 3. The session loop (the orchestrator, Node)

Stateless between runs — all state lives in the two repos. One pass:

1. **Load context.** IDENTITY, PERSONALITY, journal history, current scorecard,
   the knowledge-state + backlog, the workspace source.
2. **Assess & decide.** Call the model: pick the next move — a *foundation* to lay
   or a *field study* it is ready for. Readiness-gated: it may not attempt a live
   program it lacks the groundwork to understand.
3. **Act.** The model writes code changes into a fresh branch of `workspace`.
4. **Judge (the gate).** Build (`anchor build`) and run tests against a local
   validator / devnet. The authoritative proof-bar tests are sourced from
   `harness`, not from the agent's branch — so the agent can add tests but can
   never weaken or delete the ones that define the bar.
5. **Gate decision.** Green → merge to `workspace` main, commit signed by the bot,
   scorecard +1. Red → discard the branch, keep the failure. **No override, no
   third option.**
6. **Journal.** Write the session entry in PERSONALITY's voice — honest, including
   "no progress today" when that's the truth.
7. **Publish.** Generate the blog post from the entry; push to the blog (Vercel).
8. **Exit.** The next cron tick repeats, cleanly, regardless of how this one ended.

## 4. The scorecard

Owned by the harness, never by the agent. The score is **the count of concepts
proven by a green CI run**, derived from CI-passing commit history. The agent can
read it; it cannot write to it. Prose, journal length, and commit count do not
move it. Only green moves it.

## 5. Lifelines — so "never intervene" survives contact with reality

- **Budget cap.** Hard per-session and cumulative limits on API spend and Actions
  minutes. Exceed the session cap → abort cleanly and log. Exhaust the cumulative
  budget → pause (it has run out of runway) rather than fail messily.
- **Stuck handling.** If it cannot produce a green change after K attempts in a
  session, it logs "no progress" honestly and exits. No thrashing, no burning the
  budget against a wall. A no-commit day is an honest day.
- **Crash recovery.** Stateless-between-runs + commit-or-discard means a crashed
  run leaves nothing broken behind. The next tick simply resumes.
- **Liveness.** Nothing the agent can do in a session can prevent the next session
  from starting — the scheduler is in the locked harness.

## 6. Secrets & funds

All in Actions secrets, injected into the orchestrator env, never written into
either repo:
- Anthropic API key.
- GitHub App token (scoped to `workspace` only).
- Devnet wallet keypair.
- Helius RPC key.

**Devnet only.** The agent has hands but no real money: it deploys and tests on
devnet, and treats mainnet as **read-only** for fieldwork. No mainnet funds are
ever in reach.

## 7. Public surfaces

- **GitHub (`workspace`)** — the receipts: commits, CI status, and the
  zero-human contributor graph that proves the autonomy.
- **Blog (Vercel)** — the story: the readable journal, republished
  each session. Read-only; the public watches, it does not drive.

## 8. The day-0 seed

**`workspace` ships green from the first second:**
- A minimal Anchor program (hello-world) with a passing test → scorecard starts
  at 1, and the loop's first act is to *add to* something that works, never to
  repair something broken.
- The `JOURNAL/` structure and an entry zero.
- The blog scaffold, reading from the journal.
- A short starting foundations backlog.

**`harness` ships complete:**
- The Actions workflow, the Node orchestrator, the proof-bar test runner, and the
  three immutable docs (IDENTITY, PERSONALITY, HARNESS).

## 9. Tunable knobs (not blockers)

- cron interval (start: 6h)
- model + token budget per session
- session attempt cap, K
- devnet endpoint / RPC

---

Everything the agent cannot self-repair is specified above. Everything else — its
skills, its toolkit, its taste, its body of work — is its own to grow.
