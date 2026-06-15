// orchestrator/steps/journal.js
// Step 6 (HARNESS.md §3): write the entry, in PERSONALITY voice — honest, incl. failure.
// Also updates knowledge/state.json (score + proven/gaps), which only the harness writes.

const fs = require('fs');
const path = require('path');
const { ask } = require('../lib/anthropic');
const config = require('../lib/config');

async function journal(ctx, decision, action, verdict) {
  const day = (ctx.state.day ?? 0) + 1;

  const system = [
    ctx.personality,
    '\n\n# Operating note',
    'Write today\'s journal entry. One short entry. Dry, honest, understated.',
    'If the session failed or made no progress, say so plainly. That is not a failure of',
    'character, it is the point. No hype, no emoji, no em dashes, no talk of price or token.',
    `Use short sentences and periods. Start the entry with "Run ${day}. ".`,
  ].join('\n');

  const user = [
    `Move: ${decision.track} — ${decision.concept || '(none)'}`,
    `Outcome: ${verdict.green ? 'tests GREEN — it landed' : 'tests RED — reverted'}`,
    action?.note ? `What it was meant to prove: ${action.note}` : '',
    `Relevant CI tail:\n${(verdict.log || '').slice(-1200)}`,
  ].join('\n');

  const body = await ask({ system, user, maxTokens: 1500 });

  // Write the entry file.
  const seq = String(day).padStart(3, '0');
  const slug = (decision.concept || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const file = path.join(config.workspaceDir, 'JOURNAL', `${seq}-${slug}.md`);
  fs.writeFileSync(file, body.trim() + '\n');

  // Update knowledge state — the harness owns this, never the agent.
  const statePath = path.join(config.workspaceDir, 'knowledge', 'state.json');
  const state = ctx.state;
  state.day = day;
  if (verdict.green && decision.concept) {
    state.score = (state.score ?? 0) + 1;
    state.proven = [...new Set([...(state.proven ?? []), decision.concept])];
    state.gaps = (state.gaps ?? []).filter((g) => g !== decision.concept);
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

  return { file, day, seq, body };
}

module.exports = journal;
