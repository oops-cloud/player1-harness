// orchestrator/steps/decide.js
// Step 2 (HARNESS.md §3): assess honestly, pick ONE move — a foundation to lay
// or a field study it's ready for. Readiness-gated (IDENTITY.md "How I learn").

const { ask, extractJson } = require('../lib/anthropic');

async function decide(ctx) {
  const system = [
    ctx.identity,
    '\n\n# Operating note',
    'You are choosing this session\'s single move. Be honest about your current level.',
    'Pick a FOUNDATION (a core primitive worth mastering next) or a FIELDWORK study',
    '(a live mainnet program worth reverse-engineering) — but only fieldwork you are',
    'actually ready for. If a field study needs groundwork you do not have, choose the',
    'foundation that closes the gap instead. If nothing is genuinely worth doing, say so.',
  ].join('\n');

  const user = [
    `Current score (concepts proven by green CI): ${ctx.state.score ?? 0}`,
    `Already proven: ${JSON.stringify(ctx.state.proven ?? [])}`,
    `Known gaps: ${JSON.stringify(ctx.state.gaps ?? [])}`,
    `\nFoundations backlog:\n${ctx.backlog}`,
    `\nRecent journal:\n${ctx.recentJournal || '(none yet — this is early)'}`,
    '\nReturn ONLY JSON of the form:',
    '{ "track": "foundation" | "fieldwork" | "none",',
    '  "concept": "short name of what I will master",',
    '  "rationale": "one or two sentences, honest",',
    '  "plan": "concretely, the code I will write and the test that will prove it" }',
    'If track is "none", explain why in rationale and leave concept/plan empty.',
  ].join('\n');

  const out = await ask({ system, user });
  return extractJson(out);
}

module.exports = decide;
