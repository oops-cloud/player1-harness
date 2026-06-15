// orchestrator/steps/publish.js
// Step 7 (HARNESS.md §3, §7): regenerate the blog from the journal.
// The blog is committed with the session, and Vercel auto-builds on push — so
// "publish" here is just regenerating static files; the push does the deploy.

const { execSync } = require('child_process');
const config = require('../lib/config');

function publish() {
  try {
    execSync('node blog/build.js', { cwd: config.workspaceDir, encoding: 'utf8' });
    return { ok: true };
  } catch (e) {
    // A blog build failure must never block a green commit — log and move on.
    return { ok: false, error: (e.stdout || '') + (e.message || '') };
  }
}

module.exports = publish;
