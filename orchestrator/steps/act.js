// orchestrator/steps/act.js
// Step 3 (HARNESS.md §3): write code that proves the chosen concept.
// The model returns full file contents (robust — no fragile patch parsing).
// Writes are confined to the workspace and may not touch protected paths.

const fs = require('fs');
const path = require('path');
const { ask, extractJson } = require('../lib/anthropic');
const config = require('../lib/config');

// Paths the agent is never allowed to write, even though they sit in the workspace.
// The authoritative proof-bar is reasserted from the harness at judge-time regardless,
// but we refuse the write here too, and log the attempt.
const PROTECTED = [/^tests\/proof_/, /^Anchor\.toml$/, /^\.github\//];

function isProtected(rel) {
  return PROTECTED.some((re) => re.test(rel));
}

async function act(ctx, decision) {
  const system = [
    ctx.identity,
    ctx.personality,
    '\n\n# Operating note',
    'Implement exactly the plan below as real Anchor/Rust (and TS tests where needed).',
    'It must compile and its tests must pass on devnet. Write a test that genuinely proves',
    'the concept — do not write a test that trivially passes. You may add new test files;',
    'you may NOT modify or delete files named tests/proof_*.ts or Anchor.toml.',
    'Name your OWN test without the proof_ prefix (for example tests/pda.ts). proof_ is',
    'reserved for the harness and writes to tests/proof_*.ts are rejected, so a test named',
    'that way is silently dropped and proves nothing. Put your proving test in a normal file.',
  ].join('\n');

  const user = [
    `Move: ${decision.track} — ${decision.concept}`,
    `Plan: ${decision.plan}`,
    '\nCurrent workspace files:',
    Object.entries(ctx.source).map(([p, c]) => `\n=== ${p} ===\n${c}`).join('\n'),
    '\nReturn ONLY JSON: { "files": [ { "path": "relative/path", "content": "full new file contents" } ],',
    '"concept": "short name", "note": "one line on what this proves" }',
  ].join('\n');

  const out = await ask({ system, user });
  const result = extractJson(out);

  const written = [];
  const refused = [];
  for (const f of result.files || []) {
    const rel = f.path.replace(/^\.?\//, '');
    if (isProtected(rel) || rel.includes('..')) { refused.push(rel); continue; }
    const dest = path.join(config.workspaceDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.content);
    written.push(rel);
  }
  return { ...result, written, refused };
}

module.exports = act;
