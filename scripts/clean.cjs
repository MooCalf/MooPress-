const fs = require('fs');
const path = require('path');

function remove(target) {
  if (!fs.existsSync(target)) return;
  if (fs.lstatSync(target).isDirectory()) {
    for (const entry of fs.readdirSync(target)) remove(path.join(target, entry));
    fs.rmdirSync(target);
  } else {
    fs.unlinkSync(target);
  }
}

for (const dir of ['dist', 'release']) remove(path.join(__dirname, '..', dir));
