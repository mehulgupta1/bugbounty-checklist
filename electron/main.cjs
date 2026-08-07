const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900
  });

  win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
}

app.whenReady().then(createWindow);