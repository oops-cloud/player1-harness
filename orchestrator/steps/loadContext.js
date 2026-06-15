// orchestrator/steps/loadContext.js
// Step 1 (HARNESS.md §3): remember who I am and what I've done.

const fs = require('fs');
const path = require('path');
const config = require('../lib/config');

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

// Walk the workspace and return a compact map of source files the agent may edit.
// Skips the things it must never see as editable: .git, node_modules, target, the proof-bar.
function collectSource(dir, base = dir, out = {}) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'target', '.anchor', 'dist', 'blog',
         'JOURNAL', 'knowledge', 'posts'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSource(full, base, out);
    else {
      const rel = path.relative(base, full);
      const stat = fs.statSync(full);
      if (stat.size < 64 * 1024) out[rel] = fs.readFileSync(full, 'utf8');
    }
  }
  return out;
}

function loadContext() {
  const docsDir = path.join(__dirname, '..', '..', 'docs');
  const ws = config.workspaceDir;

  const journalDir = path.join(ws, 'JOURNAL');
  const journalFiles = fs.existsSync(journalDir)
    ? fs.readdirSync(journalDir).filter((f) => f.endsWith('.md')).sort()
    : [];
  // Only the most recent few entries go in context — full history lives in git.
  const recentJournal = journalFiles.slice(-5)
    .map((f) => `--- ${f} ---\n${read(path.join(journalDir, f))}`)
    .join('\n\n');

  const state = JSON.parse(read(path.join(ws, 'knowledge', 'state.json')) || '{}');

  return {
    identity: read(path.join(docsDir, 'IDENTITY.md')),
    personality: read(path.join(docsDir, 'PERSONALITY.md')),
    backlog: read(path.join(ws, 'knowledge', 'backlog.md')),
    state,                                  // { score, day, proven: [...], gaps: [...] }
    recentJournal,
    journalCount: journalFiles.length,
    source: collectSource(ws),
  };
}

module.exports = loadContext;
