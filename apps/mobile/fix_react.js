const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory() && !file.includes('node_modules')) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}
const files = walk('.');
let changed = 0;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  if (content.includes('React.useMemo')) {
    if (!content.match(/import\s+(?:.*,\s*)?React(?:\s*,.*)?\s+from\s+['"]react['"]/)) {
      const lines = content.split('\n');
      lines.unshift('import React from \'react\';');
      fs.writeFileSync(f, lines.join('\n'), 'utf8');
      changed++;
    }
  }
});
console.log('Fixed React imports in ' + changed + ' files.');
