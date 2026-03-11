const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  // Mouse & screen
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  getScreenBounds: () => ipcRenderer.sendSync('get-screen-bounds'),
  // Execute system commands
  runCommand: (cmd) => ipcRenderer.invoke('exec-command', cmd),
  // Open URL / file / folder
  openURL: (url) => ipcRenderer.send('open-url', url),
  openPath: (p) => ipcRenderer.send('open-path', p),
  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  // File system
  listDir: (dir) => ipcRenderer.invoke('list-dir', dir),
  readFile: (path) => ipcRenderer.invoke('read-file-content', path),
  writeFile: (path, content) => ipcRenderer.invoke('write-file-content', path, content),
  appendFile: (path, content) => ipcRenderer.invoke('append-file', path, content),
  // Clipboard
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  writeClipboard: (text) => ipcRenderer.invoke('write-clipboard', text),
  // Search files
  searchFiles: (query, dir) => ipcRenderer.invoke('search-files', query, dir),
  // Advanced Automation
  automateExcel: (instructions) => ipcRenderer.invoke('automate-excel', instructions),
  // Web Search
  webSearch: (query) => ipcRenderer.invoke('web-search', query),
  // HTTP Recon
  httpRecon: (url) => ipcRenderer.invoke('http-recon', url),
  // Port Scan
  portScan: (host) => ipcRenderer.invoke('port-scan', host),
  // Save File
  saveFile: (name, data) => ipcRenderer.invoke('save-file', name, data),
  // Save Text
  saveText: (name, content) => ipcRenderer.invoke('save-text', name, content),
  // Screen Capture
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
});
