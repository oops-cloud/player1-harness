// orchestrator/index.js
// player1's session loop. Runs once per scheduled tick, unattended, then exits.
// Stateless between runs: all state lives in the two repos (HARNESS.md §3).

const config = require('./lib/config');
const { spentUsd } = require('./lib/anthropic');
const git = require('./lib/git');

const loadContext = require('./steps/loadContext');
const decide = require('./steps/decide');
const act = require('./steps/act');
const judge = require('./steps/judge');
const journal = require('./steps/journal');
const publish = require('./steps/publish');

function log(...a) { console.log('[player1]', ...a); }

async function session() {
  // --- Lifeline: budget guard (HARNESS.md §5) ---
  const ctx0 = loadContext();
  const runwaySpent = ctx0.state.totalSpentUsd ?? 0;
  if (runwaySpent >= config.budget.totalUsd) {
    log('out of runway — pausing. No session run.');
    return;
  }

  log(`Day ${(ctx0.state.day ?? 0) + 1}. Score ${ctx0.state.score ?? 0}.`);

  // --- Step 2: decide ---
  const decision = await decide(ctx0);
  log('decision:', decision.track, decision.concept || '');

  if (decision.track === 'none') {
    // A no-progress day, chosen honestly (IDENTITY.md rule 6).
    const verdict = { green: false, log: 'no move taken: ' + (decision.rationale || '') };
    await journal(ctx0, decision, null, verdict);
    publish();
    git.commitAll(`day log: no move — ${decision.rationale || 'nothing worth doing'}\n\nby player1`);
    return;
  }

  // --- Steps 3+4+5: act, judge, gate — with stuck handling (up to K attempts) ---
  const baseRef = git.head();
  let attempt = 0;
  let action = null;
  let verdict = null;

  while (attempt < config.maxAttemptsPerSession) {
    attempt++;

    // Lifeline: per-session budget (HARNESS.md §5)
    if (spentUsd() >= config.budget.perSessionUsd) {
      log('hit per-session budget — stopping attempts.');
      break;
    }

    const ctx = loadContext(); // re-read after any prior failed attempt
    action = await act(ctx, decision);
    if (action.refused.length) log('refused protected writes:', action.refused);
    log(`attempt ${attempt}: wrote ${action.written.length} files. judging…`);

    verdict = judge();
    if (verdict.green) break;

    log(`attempt ${attempt}: RED. reverting working tree.`);
    git.hardReset(baseRef); // discard this attempt entirely (HARNESS.md §3)
  }

  const ctx = loadContext();

  // --- Step 6: journal (and update the scorecard if green) ---
  const entry = await journal(ctx, decision, action, verdict);

  // record cumulative spend onto the runway ledger
  const fs = require('fs');
  const path = require('path');
  const statePath = path.join(config.workspaceDir, 'knowledge', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.totalSpentUsd = (state.totalSpentUsd ?? 0) + spentUsd();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  // --- Record the code shipped, so the blog can post the receipts inline ---
  if (verdict.green && action && action.written.length) {
    const codeFiles = action.written
      .filter((rel) => /\.(rs|ts|toml)$/.test(rel) && !/^tests\/proof_/.test(rel))
      .map((rel) => ({
        path: rel,
        content: fs.readFileSync(path.join(config.workspaceDir, rel), 'utf8'),
      }));
    const postsDir = path.join(config.workspaceDir, 'posts');
    fs.mkdirSync(postsDir, { recursive: true });
    fs.writeFileSync(
      path.join(postsDir, `${entry.seq}.code.json`),
      JSON.stringify({ day: entry.day, concept: decision.concept, files: codeFiles }, null, 2) + '\n'
    );
  }

  // --- Step 7: publish ---
  publish();

  // --- Step 5 (commit): green lands, red was already reverted; either way we commit
  //     the journal + state + blog so the session is on the record. ---
  const tag = verdict.green ? `level cleared: ${decision.concept}` : `red: ${decision.concept}`;
  git.commitAll(`${tag}\n\n${entry.body.split('\n')[0]}\n\nby player1`);

  log(verdict.green ? `GREEN. score now ${state.score}.` : 'RED. score unchanged.');
}

session().catch((e) => {
  // A crash leaves nothing broken behind (HARNESS.md §5): the working tree was reset on
  // each red attempt, and we never force-commit a half-state. Surface the error and exit non-zero.
  console.error('[player1] session crashed:', e);
  process.exit(1);
});
