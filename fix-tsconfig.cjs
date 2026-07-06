const fs = require('fs');
const f = 'apps/web/tsconfig.app.json';
const c = JSON.parse(fs.readFileSync(f, 'utf8'));
c.compilerOptions.ignoreDeprecations = '6.0';
fs.writeFileSync(f, JSON.stringify(c, null, 2) + '\n');
