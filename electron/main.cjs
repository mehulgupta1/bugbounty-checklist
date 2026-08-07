const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, "icon.ico"),
  });

  win.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
}

// Ensures Windows uses our icon for the taskbar button (not a blank default).
if (process.platform === "win32") app.setAppUserModelId("com.mehul.bugbounty");
app.whenReady().then(createWindow);