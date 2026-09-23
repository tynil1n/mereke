'use strict';
const fs = require('node:fs');
for (const file of ['dist/index.html', 'dist/front.js', 'dist/ai.js', 'dist/engine.js', 'dist/data.js', 'api/recommend.mjs']) {
  if (!fs.existsSync(file)) throw new Error('Missing file: ' + file);
}
console.log('Static files and API handler are present.');
