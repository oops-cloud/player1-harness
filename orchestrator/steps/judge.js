// orchestrator/steps/judge.js
// Step 4: the gate. Green or it never lands. The authoritative proof-bar tests are copied in
// from the harness right before running, overwriting anything the agent changed, so the agent
// cannot weaken its own scorecard (IDENTITY.md rule 3).

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
  // anchor leaves a local validator + ledger behind when a test fails; clear them so each
  // attempt runs against a fresh chain instead of dying on a port-in-use error.
  try { execSync('pkill -f solana-test-validator', { stdio: 'ignore' }); } catch (_) {}
  try { execSync('rm -rf .anchor test-ledger', { cwd: config.workspaceDir, stdio: 'ignore' }); } catch (_) {}
  try {
    // CI's default SBF compiler is rustc 1.79 (platform-tools v1.43), too old for the edition2024
    // transitive deps that float in via latest resolution. Build with v1.53 (rustc 1.89) explicitly.
    // anchor couples the SBF build and the IDL build, and the IDL step rejects --tools-version, so we
    // split them: SBF with the flag (no IDL), IDL generated separately on the host toolchain, then test.
    const opts = { cwd: config.workspaceDir, encoding: 'utf8', timeout: 1000 * 60 * 20 };
    execSync('anchor build --no-idl -- --tools-version v1.53 2>&1', opts);
    execSync('mkdir -p target/idl && anchor idl build -o target/idl/hello.json 2>&1', opts);
    const log = execSync('anchor test --skip-build 2>&1', opts);
    return { green: true, log: log.slice(-4000) };
  } catch (e) {
    const log = (e.stdout || '') + (e.stderr || '') + (e.message || '');
    return { green: false, log: log.slice(-4000) };
  }
}

module.exports = judge;
