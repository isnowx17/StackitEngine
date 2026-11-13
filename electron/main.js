/* Stackit Engine — masaüstü (Electron) ana süreci */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');
app.setName('Stackit Engine');

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
      title: 'Stackit Engine hakkında',
      message: 'Stackit Engine ' + app.getVersion(),
      detail: 'Blok tabanlı 2D oyun motoru.\nElectron ' + process.versions.electron + ' · Chromium ' + process.versions.chrome
    });
    // Not: Düzen menüsü (Ctrl+Z vb.) bilerek yok — kısayolları editörün kendisi yönetiyor.
    return Menu.buildFromTemplate([
      { label: 'Dosya', submenu: [{ role: 'quit', label: 'Çıkış' }] },
      {
        label: 'Görünüm',
        submenu: [
          { role: 'reload', label: 'Yeniden yükle' },
          { role: 'toggleDevTools', label: 'Geliştirici araçları' },
          { type: 'separator' },
          { role: 'resetZoom', label: 'Gerçek boyut' },
          { role: 'zoomIn', label: 'Yakınlaştır' },
          { role: 'zoomOut', label: 'Uzaklaştır' },
          { type: 'separator' },
          { role: 'togglefullscreen', label: 'Tam ekran' }
        ]
      },
      { label: 'Yardım', submenu: [{ label: 'Stackit Engine hakkında', click: about }] }
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
