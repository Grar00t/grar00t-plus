// ╔══════════════════════════════════════════════╗
// ║  Haven Desktop — Casper Lives On Your Screen  ║
// ║  Built by KHAWRIZM 🐉  |  Team 403           ║
// ╚══════════════════════════════════════════════╝

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen, shell, clipboard, net, session, desktopCapturer } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const nodeNet = require('net'); // Native Node.js net module for TCP sockets

// ====== SINGLE INSTANCE ======
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }

let win, tray;
app.isQuitting = false;

// Optimization for Windows ARM64 & Stability
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// ====== CREATE MAIN WINDOW ======
function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  win = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    show: true, 
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: false // Ensure it's not offscreen
    }
  });

  // Force window to stay on top even on ARM
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Initial state: Clickable
  win.setIgnoreMouseEvents(false);

  win.loadFile('index.html').catch(e => console.error('Failed to load:', e));

  // Memory Management: Clear cache every 5 minutes
  setInterval(() => {
    if (win) win.webContents.clearHistory();
  }, 300000);

  // When window is hidden, reduce its resource usage
  win.on('hide', () => {
    if (win.webContents) win.webContents.setBackgroundThrottling(true);
  });

  // Don't close — just hide. Use tray → Quit to actually exit
  win.on('close', e => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('show', () => {
    // Resume normal operation when shown
    win.webContents.setBackgroundThrottling(false);
  });

  // DevTools in dev mode: npm run dev
  if (process.argv.includes('--dev')) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

// ====== SYSTEM TRAY ======
function createTray() {
  try {
    const iconPath = path.join(__dirname, 'icon.png');
    let icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn('⚠️ icon.png not found — tray may not show icon');
      // Create a minimal 16x16 fallback icon (teal filled)
      icon = createFallbackIcon();
    }

    tray = new Tray(icon);
    tray.setToolTip('Haven 👻 — KHAWRIZM');

    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '👻 Show Haven', click: () => { win.show(); win.setAlwaysOnTop(true); } },
      { label: '📌 Always On Top', type: 'checkbox', checked: true, click: m => win.setAlwaysOnTop(m.checked) },
      { type: 'separator' },
      { label: '🔄 Reload', click: () => win.reload() },
      { label: '🛠 DevTools', click: () => win.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: '❌ Quit Haven', click: () => { app.isQuitting = true; app.quit(); } }
    ]));

    tray.on('double-click', () => {
      win.show();
      win.setAlwaysOnTop(true);
    });
  } catch (e) {
    console.warn('Tray creation failed:', e.message);
  }
}

function createFallbackIcon() {
  // Generate a minimal 16x16 ghost-shaped icon programmatically
  const s = 16;
  const buf = Buffer.alloc(s * s * 4, 0);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const dx = x - 7.5, dy = y - 6;
      const inBody = (dx * dx / 42 + Math.min(dy, 0) ** 2 / 36) < 1 && y < 14;
      const wavy = y >= 12 && y < 15 && Math.abs(dx) < 6.5 && ((x + y) % 3 !== 0);
      if (inBody || wavy) {
        // BGRA format on Windows
        buf[i] = 156;     // B
        buf[i + 1] = 188; // G
        buf[i + 2] = 26;  // R
        buf[i + 3] = 230; // A
      }
    }
  }
  try {
    return nativeImage.createFromBitmap(buf, { width: s, height: s });
  } catch {
    return nativeImage.createEmpty();
  }
}

// ====== IPC HANDLERS ======
ipcMain.on('set-ignore-mouse', (_, ignore) => {
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('get-screen-bounds', (event) => {
  const { width, height } = screen.getPrimaryDisplay().bounds;
  event.returnValue = { width, height };
});

// Desktop control: run system commands
// Approved command list for safe desktop control
const APPROVED_CMDS = [
  // System info
  /^systeminfo$/i, /^ipconfig$/i, /^tasklist$/i,
  // Apps (no args)
  /^notepad$/i, /^calc$/i, /^explorer$/i, /^mspaint$/i,
  /^taskmgr$/i, /^snippingtool$/i, /^control$/i,
  /^wt$/i, /^cmd$/i, /^powershell$/i,
  // Start protocol / app launches
  /^start\s+(chrome|msedge|firefox|winword|excel|powerpnt|spotify:|discord:|tg:|msteams:|zoommtg:)/i,
  /^start\s+ms-settings:[a-zA-Z0-9-]*$/i,
  /^start\s+ms-[a-zA-Z0-9.:-]+$/i,
  /^start\s+microsoft\.[a-zA-Z0-9.:-]+$/i,
  /^start\s+""\s+"[^";&|<>]+"$/i,
  // Ping with safe hostname
  /^ping\s+-n\s+\d+\s+[a-zA-Z0-9.-]+$/i,
  /^ping\s+[a-zA-Z0-9.-]+$/i,
  // Code editor
  /^code(\s+\.)?$/i,
];

ipcMain.handle('exec-command', async (_, commandString) => {
  const cmd = commandString.trim();
  const allowed = APPROVED_CMDS.some(r => r.test(cmd));
  if (!allowed) return { ok: false, error: `Command not allowed: ${cmd.substring(0, 60)}` };

  return new Promise((resolve) => {
    exec(cmd, { timeout: 10000, windowsHide: true, shell: true }, (err, stdout, stderr) => {
      if (err) resolve({ ok: false, error: err.message, stderr });
      else resolve({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
});

// Open URL in default browser
ipcMain.on('open-url', (_, url) => {
  shell.openExternal(url);
});

// Open file/folder
ipcMain.on('open-path', (_, p) => {
  shell.openPath(p);
});

// System information
ipcMain.handle('get-system-info', async () => {
  return {
    platform: os.platform(),
    hostname: os.hostname(),
    user: os.userInfo().username,
    cpus: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / (1024**3)) + ' GB',
    freeMemory: Math.round(os.freemem() / (1024**3)) + ' GB',
    homedir: os.homedir(),
    uptime: Math.round(os.uptime() / 3600) + ' hrs',
  };
});

// List directory
ipcMain.handle('list-dir', async (_, dirPath) => {
  try {
    const dir = dirPath || os.homedir();
    const items = fs.readdirSync(dir, { withFileTypes: true });
    return { ok: true, path: dir, items: items.slice(0, 100).map(i => ({ name: i.name, isDir: i.isDirectory() })) };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Read file
ipcMain.handle('read-file-content', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return { ok: true, content: content.substring(0, 10000) };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Write file
ipcMain.handle('write-file-content', async (_, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Append to file (for logs/recon)
ipcMain.handle('append-file', async (_, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(filePath, content + '\n', 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Clipboard
ipcMain.handle('read-clipboard', async () => clipboard.readText());
ipcMain.handle('write-clipboard', async (_, text) => { clipboard.writeText(text); return true; });

// Search files
ipcMain.handle('search-files', async (_, query, dir) => {
  const searchDir = dir || os.homedir();
  return new Promise(resolve => {
    // Use 'where' on windows, 'find' on others.
    const isWindows = os.platform() === 'win32';
    const command = isWindows
      ? `where /r "${searchDir}" "*${query}*"`
      : `find "${searchDir}" -name "*${query}*" -type f`;

    exec(command, { timeout: 15000, windowsHide: true }, (err, stdout, stderr) => {
      if (err || stderr) resolve({ ok: true, results: [] }); // Silently fail on error
      else resolve({ ok: true, results: stdout.trim().split('\n').filter(Boolean).slice(0, 30) });
    });
  });
});

// Advanced Automation with nut.js
ipcMain.handle('automate-excel', async (_, instructions) => {
  // Nut.js removed for lighter build. 
  // You can re-enable this by installing robotjs or nut.js later.
  return { ok: false, error: "Excel automation module is currently disabled for lightweight mode." };
});

// HTTP Recon — fetch headers + status of a URL
ipcMain.handle('http-recon', async (_, url) => {
  return new Promise((resolve) => {
    try {
      const request = net.request({ url, method: 'GET' });
      request.on('response', (response) => {
        let data = '';
        response.on('data', (chunk) => { if (data.length < 4000) data += chunk; });
        response.on('end', () => {
          const headers = Object.entries(response.headers)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');
          resolve({ ok: true, status: response.statusCode, headers, data: data.substring(0, 2000) });
        });
      });
      request.on('error', (err) => resolve({ ok: false, error: err.message }));
      request.setTimeout(8000);
      request.end();
    } catch (e) { resolve({ ok: false, error: e.message }); }
  });
});

// Web Search (Sovereign & Free via DuckDuckGo HTML)
ipcMain.handle('web-search', async (_, query) => {
  return new Promise((resolve) => {
    const request = net.request(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    
    request.on('response', (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        // Simple regex to extract titles and links (robust enough for basic needs)
        const results = [];
        const linkRegex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>/g;
        let match;
        while ((match = linkRegex.exec(data)) !== null) {
          results.push({ title: match[2], link: match[1] });
          if (results.length >= 5) break; // Top 5 results
        }
        
        if (results.length > 0) resolve({ ok: true, results });
        else resolve({ ok: false, error: "No results found" });
      });
    });
    
    request.on('error', (err) => resolve({ ok: false, error: err.message }));
    request.end();
  });
});

// Port Scan (TCP)
ipcMain.handle('port-scan', async (_, host) => {
  const ports = [21, 22, 80, 443, 3306, 8080, 8443]; // Common ports
  const openPorts = [];
  
  for (const port of ports) {
    const isOpen = await new Promise(resolve => {
      const socket = new nodeNet.Socket();
      socket.setTimeout(1500); // 1.5s timeout
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.on('error', () => { socket.destroy(); resolve(false); });
      socket.connect(port, host);
    });
    if (isOpen) openPorts.push(port);
  }
  return { ok: true, open: openPorts };
});

// Save File (Auto-save uploads)
ipcMain.handle('save-file', async (_, name, dataUrl) => {
  try {
    const desktop = app.getPath('desktop');
    const saveDir = path.join(desktop, 'Haven_Downloads');
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);
    const filePath = path.join(saveDir, name);
    const base64Data = dataUrl.replace(/^data:.*;base64,/, "");
    fs.writeFileSync(filePath, base64Data, 'base64');
    return { ok: true, path: filePath };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Save Text File (For Code Artifacts)
ipcMain.handle('save-text', async (_, filename, content) => {
  try {
    const desktop = app.getPath('desktop');
    const saveDir = path.join(desktop, 'Haven_Downloads');
    if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir);
    const filePath = path.join(saveDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, path: filePath };
  } catch (e) { return { ok: false, error: e.message }; }
});

// Screen Capture
ipcMain.handle('capture-screen', async () => {
  try {
    const { width, height } = screen.getPrimaryDisplay().bounds;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    // Primary screen is usually index 0
    return { ok: true, img: sources[0].thumbnail.toDataURL() };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ====== APP LIFECYCLE ======
app.whenReady().then(() => {
  // Allow microphone, camera, and media access in renderer
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'microphone', 'notifications', 'audioCapture', 'videoCapture'];
    callback(allowed.includes(permission));
  });

  createWindow();
  createTray();

  // Global shortcut: Ctrl+Shift+H toggles entire overlay
  globalShortcut.register('CommandOrControl+Shift+H', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.setAlwaysOnTop(true);
    }
  });

  console.log('👻 Haven Desktop launched!');
  console.log('🐉 Ctrl+Shift+H to toggle');
  console.log('📌 Right-click tray icon for options');
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('second-instance', () => {
  if (win) {
    win.show();
    win.setAlwaysOnTop(true);
  }
});
