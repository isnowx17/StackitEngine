/* Stackit Engine — masaüstü (Electron) ana süreci */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
app.setName('Stackit Engine');

// Menü dili sistem diline göre (uygulamanın kendisi de aynı kuralı kullanır)
const EN = {
  'Dosya': 'File', 'Çıkış': 'Quit', 'Görünüm': 'View', 'Yeniden yükle': 'Reload', 'Geliştirici araçları': 'Developer tools',
  'Gerçek boyut': 'Actual size', 'Yakınlaştır': 'Zoom in', 'Uzaklaştır': 'Zoom out', 'Tam ekran': 'Full screen',
  'Yardım': 'Help', 'Stackit Engine hakkında': 'About Stackit Engine', 'Blok tabanlı 2D oyun motoru.': 'Block-based 2D game engine.'
};
const t = (s) => (/^tr/i.test(app.getLocale()) ? s : EN[s] || s);

// Aynı anda tek pencere: ikinci kez açılırsa mevcut pencereyi öne getir
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let win = null;

  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  function createWindow() {
    win = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 660,
      title: 'Stackit Engine',
      backgroundColor: '#11131d',
      icon: path.join(__dirname, 'icon.png'),
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false
      }
    });
    win.once('ready-to-show', () => {
      win.maximize();
      win.show();
    });
    // dış bağlantılar sistem tarayıcısında açılsın; uygulama başka sayfaya gitmesin
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
      if (!url.startsWith('file://')) {
        e.preventDefault();
        if (/^https?:\/\//.test(url)) shell.openExternal(url);
      }
    });
    win.on('closed', () => { win = null; });
    win.loadFile(path.join(ROOT, 'index.html'));
  }

  function buildMenu() {
    const about = () => dialog.showMessageBox(win, {
      type: 'info',
      title: t('Stackit Engine hakkında'),
      message: 'Stackit Engine ' + app.getVersion(),
      detail: t('Blok tabanlı 2D oyun motoru.') + '\nElectron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome
    });
    // Not: Düzen menüsü (Ctrl+Z vb.) bilerek yok — kısayolları editörün kendisi yönetiyor.
    return Menu.buildFromTemplate([
      { label: t('Dosya'), submenu: [{ role: 'quit', label: t('Çıkış') }] },
      {
        label: t('Görünüm'),
        submenu: [
          { role: 'reload', label: t('Yeniden yükle') },
          { role: 'toggleDevTools', label: t('Geliştirici araçları') },
          { type: 'separator' },
          { role: 'resetZoom', label: t('Gerçek boyut') },
          { role: 'zoomIn', label: t('Yakınlaştır') },
          { role: 'zoomOut', label: t('Uzaklaştır') },
          { type: 'separator' },
          { role: 'togglefullscreen', label: t('Tam ekran') }
        ]
      },
      { label: t('Yardım'), submenu: [{ label: t('Stackit Engine hakkında'), click: about }] }
    ]);
  }

  app.whenReady().then(() => {
    Menu.setApplicationMenu(buildMenu());
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
