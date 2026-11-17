#!/usr/bin/env node
/**
 * Pre-commit secret screen.
 *
 * Refuses a commit that stages anything shaped like a live credential. It runs on
 * the STAGED blobs (`git show :path`), not the working tree, so partial staging is
 * handled correctly.
 *
 * It prints file names and the kind of secret — never the value. A scanner that
 * echoes the secret into a terminal or CI log has moved the leak, not stopped it.
 *
 * Usage: node scripts/check-secrets.mjs        (wired as .githooks/pre-commit)
 */
import { execFileSync } from 'node:child_process'

const PATTERNS = [
  { name: 'Payments.lk secret key (sk_test_/sk_live_)', re: /\bsk_(?:test|live)_[A-Za-z0-9]{12,}/ },
  { name: 'Payments.lk webhook secret (whsec_)', re: /\bwhsec_[A-Za-z0-9]{12,}/ },
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}/ },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  {
    name: 'secret-looking assignment',
    re: /^(?:[A-Z0-9_]*(?:SECRET|TOKEN|API_KEY|PASSWORD|WEBHOOK)[A-Z0-9_]*)=(["']?)[A-Za-z0-9+/=_.:-]{24,}\1$/m,
  },
]

/** `.env.example` is a template; every other `.env*` is real configuration. */
function isEnvFile(path) {
  const base = path.split('/').pop()
  if (!base.startsWith('.env')) return false
  return !base.includes('.example')
}

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'], {
    encoding: 'utf8',
  })
  return out.split('\0').filter(Boolean)
}

function readStaged(path) {
  try {
    return execFileSync('git', ['show', `:${path}`], { encoding: 'utf8' })
  } catch {
    return ''
  }
}

const findings = []
for (const file of stagedFiles()) {
  if (isEnvFile(file)) {
    findings.push({ file, kind: 'an env file (add it to .gitignore instead)' })
    continue
  }
  const text = readStaged(file)
  if (text.includes('\0')) continue // binary
  for (const { name, re } of PATTERNS) {
    if (re.test(text)) findings.push({ file, kind: name })
  }
}

if (findings.length === 0) process.exit(0)

console.error('\nCommit blocked: staged files contain what looks like secret material.\n')
for (const f of findings) console.error(`  ${f.file}  ->  ${f.kind}`)
console.error('\nRemove the value, rotate it if it was ever real, and stage the file again.')
console.error('Emergency bypass (do NOT use on real secrets): git commit --no-verify\n')
process.exit(1)
