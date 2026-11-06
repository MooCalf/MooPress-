const { app, BrowserWindow } = require('electron');
const path = require('node:path');

app.setPath('userData', path.join(app.getPath('temp'), 'moopress-built-integration'));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(__dirname, 'test-preload.cjs'), contextIsolation: true, offscreen: true, backgroundThrottling: false } });
  const errors = [];
  win.webContents.on('console-message', (event) => { if (event.level === 'error') errors.push(event.message); });
  try {
    await win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    const checks = await win.webContents.executeJavaScript(`(async () => {
      const wait = () => new Promise(resolve => setTimeout(resolve, 100));
      for (let i = 0; i < 30 && !document.querySelector('.chapter-paper'); i++) await wait();
      const checks = [];
      const check = (name, pass) => checks.push({ name, pass: !!pass });
      check('built app boots on the title page', document.querySelector('.title-item.active') && !document.querySelector('.boot-error'));
      document.querySelectorAll('.rb-tab').forEach(tab => { if (tab.textContent === 'Insert') tab.click(); });
      const picture = document.querySelector('[data-action="picture"]');
      check('built app allows pictures on the title page', picture && !picture.disabled);
      picture.click(); await wait();
      check('built app renders title artwork', document.querySelector('.title-art img'));
      document.querySelector('.sb-add').click(); await wait();
      check('built app adds and activates a chapter', document.querySelectorAll('.chapter-paper').length === 2 && document.getElementById('chapter-title'));
      document.querySelectorAll('.rb-tab').forEach(tab => { if (tab.textContent === 'Insert') tab.click(); });
      document.querySelector('[data-action="caption"]').click(); await wait();
      check('built app opens element editing', document.querySelector('.modal-overlay textarea'));
      return checks;
    })()`);
    for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);
    if (errors.length) console.error(errors.join('\n'));
    app.exit(checks.every(check => check.pass) && !errors.length ? 0 : 1);
  } catch (error) { console.error(error); app.exit(1); }
});
