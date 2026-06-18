#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const URL_TAGS_PATTERN = /utm_source=meta.*utm_medium=paid_social.*utm_campaign=\{\{campaign\.name\}\}.*utm_content=\{\{ad\.name\}\}/s;
const CREATE_CREATIVE_PATTERN = /\/adcreatives|adcreatives['"`]/;

const files = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard', 'scripts'], { cwd: ROOT, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(file => /\.(py|js|mjs|cjs|ts)$/.test(file))
  .filter(file => !file.endsWith('check-meta-url-tags.mjs'));

const failures = [];
for (const file of files) {
  const text = readFileSync(`${ROOT}/${file}`, 'utf8');
  if (!CREATE_CREATIVE_PATTERN.test(text)) continue;
  if (!URL_TAGS_PATTERN.test(text) || !/url_tags/.test(text)) {
    failures.push(file);
  }
}

if (failures.length) {
  console.error('Meta URL tags check failed. Scripts that create Meta ad creatives must include the Enervita URL tags template and pass url_tags.');
  for (const file of failures) console.error(`- ${file}`);
  process.exit(1);
}

console.log('Meta URL tags check passed.');
