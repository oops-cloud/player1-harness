// orchestrator/steps/judge.js
// The gate. The proof-bar tests are copied in from the harness right before running,
// overwriting anything the agent changed, so it cannot weaken its own scorecard.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../lib/config');

function reassertProofBar() {
  const src = path.join(__dirname, '..', '..', 'proof-bar');
  const destDir = path.join(config.workspaceDir, 'tests');
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, f), path.join(destDir, f));
  }
}

function judge() {
  reassertProofBar();
  // anchor leaves a validator + ledger behind on a failed run; clear them so each attempt
  // starts on a fresh chain instead of dying on a port-in-use error.
  try { execSync('pkill -f solana-test-validator', { stdio: 'ignore' }); } catch (_) {}
  try { execSync('rm -rf .anchor test-ledger', { cwd: config.workspaceDir, stdio: 'ignore' }); } catch (_) {}
  try {
    // Native toolchain + committed lock builds the tree on its own, so let anchor orchestrate
    // build, IDL, and test from the workspace root. One command, nothing hand-rolled to break
    // when the agent restructures its program.
    const log = execSync('anchor test 2>&1', {
      cwd: config.workspaceDir, encoding: 'utf8', timeout: 1000 * 60 * 20,
    });
    return { green: true, log: log.slice(-4000) };
  } catch (e) {
    const log = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    return { green: false, log: log.slice(-4000) };
  }
}

module.exports = judge;
