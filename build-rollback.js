const fs = require('fs');
const { execFileSync } = require('child_process');
fs.mkdirSync('rollback', { recursive: true });
for (const file of ['index.html', 'vetsync-panel.bookmarklet.txt', 'vetsync-auto.user.js']) {
  let text = execFileSync('git', ['show', 'vetsync-1.0.22-backup:' + file], { encoding: 'utf8' });
  if (file.endsWith('.user.js')) text = text.replace(/^\/\/ @(updateURL|downloadURL).*\n/gm, '');
  fs.writeFileSync('rollback/' + file, text);
}
