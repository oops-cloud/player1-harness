// orchestrator/lib/git.js
// All git operations run inside the workspace checkout only.
// The orchestrator holds a token scoped to `workspace` and never to `harness`,
// so this module physically cannot touch the locked side (HARNESS.md §1).

const { execSync } = require('child_process');
const config = require('./config');

function run(cmd, cwd) {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function inWorkspace(cmd) {
  return run(cmd, config.workspaceDir);
}

// Snapshot the current commit so a failed session can be reverted exactly.
function head() {
  return inWorkspace('git rev-parse HEAD').trim();
}

// Discard everything since `ref` — used when CI goes red (HARNESS.md §3, no override).
function hardReset(ref) {
  inWorkspace(`git reset --hard ${ref}`);
  inWorkspace('git clean -fd');
}

// Commit current state, signed by player1, and push. Returns the new commit hash.
function commitAll(message) {
  inWorkspace('git add -A');
  const env = `GIT_AUTHOR_NAME="${config.gitAuthorName}" GIT_AUTHOR_EMAIL="${config.gitAuthorEmail}" ` +
              `GIT_COMMITTER_NAME="${config.gitAuthorName}" GIT_COMMITTER_EMAIL="${config.gitAuthorEmail}"`;
  // Use a heredoc-safe message file to avoid shell escaping pain.
  const fs = require('fs');
  const path = require('path');
  const msgFile = path.join(config.workspaceDir, '.commitmsg');
  fs.writeFileSync(msgFile, message);
  inWorkspace(`${env} git commit -F .commitmsg`);
  fs.unlinkSync(msgFile);
  inWorkspace('git push origin HEAD');
  return head();
}

module.exports = { inWorkspace, head, hardReset, commitAll };
