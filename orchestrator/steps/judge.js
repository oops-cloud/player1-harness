// orchestrator/steps/judge.js
// Step 4 (HARNESS.md §3, §4): the gate. Green or it never lands.
// Crucially, the authoritative proof-bar tests are copied IN from the harness side
// right before running — overwriting anything the agent may have changed — so the
// agent cannot weaken its own scorecard (IDENTITY.md rule 3).

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
  // anchor leaves a local validator + ledger behind when a test fails; without
  // clearing them, attempts after the first hit a port-in-use error and die in ~0.3s.
  try { execSync('pkill -f solana-test-validator', { stdio: 'ignore' }); } catch (_) {}
  try { execSync('rm -rf .anchor test-ledger', { cwd: config.workspaceDir, stdio: 'ignore' }); } catch (_) {}
  try {
    // anchor test builds the program, spins a local validator, and runs all tests
    // (proof-bar tests + any tests the agent added). One red test = a red session.
    const log = execSync('anchor test 2>&1', {
      cwd: config.workspaceDir,
      encoding: 'utf8',
      timeout: 1000 * 60 * 20,
    });
    return { green: true, log: log.slice(-4000) };
  } catch (e) {
    const log = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    return { green: false, log: log.slice(-4000) };
  }
}

module.exports = judge;
