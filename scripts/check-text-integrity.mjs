#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const BASELINE_PATH = `${ROOT}/scripts/text-integrity-baseline.json`;
const UPDATE = process.argv.includes('--update-baseline');

const MOJIBAKE_PATTERNS = [
  { key: 'replacement_char', re: /�/g, reason: 'Unicode replacement character; file was decoded with the wrong encoding.' },
  { key: 'latin1_utf8_A', re: /Ã[\u0080-\u00BF]?/g, reason: 'Likely UTF-8 decoded as Latin-1/Windows-1252.' },
  { key: 'latin1_utf8_B', re: /Â[\u0080-\u00BF]?/g, reason: 'Likely stray Latin-1/Windows-1252 byte sequence.' },
  { key: 'broken_dash_quote', re: /â(?:€|€™|€œ|€|€˜|€\u009d|€\u009c|€\u0093|€\u0094)/g, reason: 'Likely broken smart quote, dash or arrow.' },
  { key: 'double_encoded_utf8', re: /Ãƒ|Ã‚|Ã¢/g, reason: 'Likely double-encoded UTF-8 text.' },
];

const SOURCE_EXTENSIONS = /\.(cjs|css|html|js|jsx|json|md|mjs|py|sh|sql|ts|tsx|txt|yml|yaml)$/i;
const IGNORED = [
  /^node_modules\//,
  /^\.git\//,
  /^dist\//,
  /^apps\/web\/dist\//,
  /^apps\/web\/playwright-report\//,
  /^apps\/web\/test-results\//,
  /^backups\//,
  /^runtime\//,
  /^\.deploy-reports\//,
];

function gitFiles() {
  const output = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' });
  return output.split(/\r?\n/).filter(Boolean).filter(path => SOURCE_EXTENSIONS.test(path) && !IGNORED.some(re => re.test(path.replace(/\\/g, '/'))));
}

function emptyCounts() {
  return Object.fromEntries(MOJIBAKE_PATTERNS.map(pattern => [pattern.key, 0]));
}

function scanFile(path) {
  const text = readFileSync(`${ROOT}/${path}`, 'utf8');
  const counts = emptyCounts();
  const findings = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of MOJIBAKE_PATTERNS) {
      pattern.re.lastIndex = 0;
      const matches = [...line.matchAll(pattern.re)];
      if (!matches.length) continue;
      counts[pattern.key] += matches.length;
      findings.push({
        path,
        line: index + 1,
        pattern: pattern.key,
        reason: pattern.reason,
        text: line.trim().slice(0, 180),
      });
    }
  }
  return { counts, findings };
}

function addCounts(left, right) {
  const result = { ...left };
  for (const [key, value] of Object.entries(right)) result[key] = (result[key] ?? 0) + value;
  return result;
}

const files = gitFiles();
const scan = {};
let totalCounts = emptyCounts();
let allFindings = [];
for (const file of files) {
  const result = scanFile(file);
  const hasIssue = Object.values(result.counts).some(Boolean);
  if (hasIssue) {
    scan[file] = result.counts;
    totalCounts = addCounts(totalCounts, result.counts);
    allFindings = allFindings.concat(result.findings);
  }
}

if (UPDATE) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), files: scan }, null, 2)}\n`);
  console.log(`Text integrity baseline updated: ${relative(ROOT, BASELINE_PATH)}`);
  console.log(JSON.stringify(totalCounts, null, 2));
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? {} : {};
const regressions = [];
for (const [file, counts] of Object.entries(scan)) {
  const allowed = baseline[file] ?? emptyCounts();
  for (const [key, value] of Object.entries(counts)) {
    if (value > (allowed[key] ?? 0)) {
      regressions.push({ file, pattern: key, current: value, allowed: allowed[key] ?? 0 });
    }
  }
}

if (regressions.length) {
  console.error('Text integrity check failed: new mojibake/corrupted text was found.');
  for (const regression of regressions) {
    console.error(`- ${regression.file}: ${regression.pattern} current=${regression.current} allowed=${regression.allowed}`);
    const examples = allFindings.filter(finding => finding.path === regression.file && finding.pattern === regression.pattern).slice(0, 5);
    for (const example of examples) console.error(`  line ${example.line}: ${example.text}`);
  }
  process.exit(1);
}

console.log('Text integrity check passed.');
