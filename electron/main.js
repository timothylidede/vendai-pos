const { app, BrowserWindow, Menu, shell, ipcMain, dialog, session } = require('electron');
const path = require('path');
// Load environment variables for Electron main (development + production)
try {
  const dotenv = require('dotenv');
  // Load from project root .env.local if present
  dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
  // Also load generic .env as fallback
  dotenv.config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv is optional; if not installed, we will rely on process env provided by the shell/bundler
}
const { spawn } = require('child_process');
const { autoUpdater } = require('electron-updater');
const express = require('express');
const crypto = require('crypto');
const isDev = process.env.NODE_ENV === 'development';

// Single instance lock for proper deep-link handling on Windows
try {
  if (app.requestSingleInstanceLock && !app.requestSingleInstanceLock()) {
    app.quit();
  }
} catch (e) {
  // no-op
}

// Ensure app name branding (Windows/Linux)
try { app.setName('vendai'); } catch (e) {}
// Improve Windows taskbar integration
try { if (process.platform === 'win32') app.setAppUserModelId('com.vendai.app'); } catch (e) {}

// Keep a global reference of the window object
let mainWindow;
let nextServer;
let authWindow;
let oauthServer;
let currentOAuthProcess = null;

// Helper to safely dispatch deep-link events to renderer
function dispatchDeepLink(url) {
  if (!mainWindow) return;
  try {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } catch (_) {}

  const send = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (url.startsWith('vendai-pos://oauth/callback')) {
      mainWindow.webContents.send('oauth-callback', url);
    } else if (url.startsWith('vendai-pos://oauth/success')) {
      mainWindow.webContents.send('oauth-success');
    }
  };

  // If the webContents is still loading, wait for it
  try {
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', send);
    } else {
      send();
    }
  } catch (_) {
    // Fallback: attempt to send anyway
    send();
  }
}

// OAuth Configuration for Firebase - we'll use Firebase's OAuth flow
const OAUTH_PORT = 5173;
const REDIRECT_URI = `http://127.0.0.1:${OAUTH_PORT}/callback`;

// PKCE helper functions
function base64URLEncode(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

// Start Next.js server in production
function startNextServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In development, try both common ports
      const tryUrl = async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            return url;
          }
        } catch (error) {
          return null;
        }
        return null;
      };
      
      // Try common development ports
      const checkPorts = async () => {
        const urls = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002'
        ];
        
        for (const url of urls) {
          const result = await tryUrl(url);
          if (result) {
            console.log(`Found Next.js dev server at ${result}`);
            resolve(result);
            return;
          }
        }
        
        // If no server found, default to 3000 and let it fail gracefully
        console.log('No Next.js dev server found, defaulting to http://localhost:3000');
        resolve('http://localhost:3000');
      };
      
      // Give the dev server a moment to start, then check
      setTimeout(checkPorts, 2000);
      return;
    }

    // In production, start Next.js programmatically (no npm/cmd.exe)
    try {
      const next = require('next');
      const app = next({ dev: false, dir: path.join(__dirname, '..') });
      const handle = app.getRequestHandler();

      app.prepare().then(() => {
        const server = express();
        server.all('*', (req, res) => handle(req, res));
        const port = process.env.PORT ? Number(process.env.PORT) : 3000;
        nextServer = server;
        server.listen(port, () => {
          console.log(`Next.js server started on http://localhost:${port}`);
          resolve(`http://localhost:${port}`);
        });
      }).catch((err) => {
        console.error('Failed to prepare Next app:', err);
        reject(err);
      });
    } catch (err) {
      console.error('Unable to require Next. Is it installed?', err);
      reject(err);
    }
  });
}

async function createWindow() {
  // Start Next.js server first
  const serverUrl = await startNextServer();

  // Create the browser window
  const isWin = process.platform === 'win32'
  const windowIcon = isWin
    ? path.join(__dirname, '../build/icons/icon.ico')
    : path.join(__dirname, '../public/images/logo-icon-remove.png')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    preload: path.join(__dirname, 'preload.js')
    },
    icon: windowIcon,
    show: false,
    frame: false, // Remove window frame since app has its own header
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a', // Match your app's background
    webSecurity: false // Allow local file access
  });

  // Load the app
  console.log(`Loading Electron window with URL: ${serverUrl}`);
  mainWindow.loadURL(serverUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('Electron window ready to show');
    mainWindow.show();
    
    // Only open dev tools in development mode if explicitly needed
    // Remove this line to prevent dev tools from opening automatically
    // if (isDev) {
    //   mainWindow.webContents.openDevTools();
    // }
  });

  // Add error handling for failed loads
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading in Electron window');
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
    // Stop Next.js server when window closes
    if (nextServer && typeof nextServer.close === 'function') {
      try { nextServer.close(); } catch (e) { /* ignore */ }
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external websites
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const isLocal = parsedUrl.origin.startsWith('http://localhost') || parsedUrl.origin.startsWith('http://127.0.0.1');
      if (!isLocal) {
        event.preventDefault();
        shell.openExternal(navigationUrl);
      }
    } catch (e) {
      // If URL parsing fails, block navigation
      event.preventDefault();
    }
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'VendAI POS',
      submenu: [
        {
          label: 'About VendAI POS',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About VendAI POS',
              message: 'VendAI POS',
              detail: 'AI-Powered Point of Sale System\nVersion 1.0.0'
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            // You can implement preferences window here
            mainWindow.webContents.send('open-preferences');
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            shell.openExternal('https://github.com/timothylidede/vendai-pos');
          }
        }
      ]
    }
  ];

  // macOS specific menu adjustments
  if (process.platform === 'darwin') {
    template[0].label = app.getName();
    template[0].submenu.unshift(
      { role: 'about' },
      { type: 'separator' }
    );
    
    // Window menu
    template[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(() => {
  // Set up custom protocol for OAuth redirects
  try {
    let registered = app.isDefaultProtocolClient('vendai-pos');
    if (!registered) {
      if (process.platform === 'win32' && isDev) {
        // In Windows dev mode, pass explicit arguments for electron.exe
        registered = app.setAsDefaultProtocolClient('vendai-pos', process.execPath, [process.argv[1]]);
      } else {
        registered = app.setAsDefaultProtocolClient('vendai-pos');
      }
    }
    console.log('Custom protocol vendai-pos registered:', registered);
  } catch (e) {
    console.warn('Failed to register custom protocol vendai-pos:', e);
  }

  createWindow();
  createMenu();

  // On Windows, handle protocol URL passed on first launch (cold start)
  try {
    if (process.platform === 'win32') {
      const argUrl = process.argv.find((arg) => typeof arg === 'string' && arg.startsWith('vendai-pos://'));
      if (argUrl) {
        // Wait a tick to ensure window has begun loading
        setTimeout(() => dispatchDeepLink(argUrl), 300);
      }
    }
  } catch (_) {}

  // Handle app activation (macOS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Auto updater (for production builds)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Kill Next.js server
  if (nextServer) {
    nextServer.kill('SIGTERM');
  }
  
  // Close OAuth server if running
  if (oauthServer) {
    oauthServer.close();
  }
  
  // Clean up OAuth process
  if (currentOAuthProcess) {
    currentOAuthProcess.reject(new Error('App closing'));
    currentOAuthProcess = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
});

// Handle protocol for OAuth redirects
app.on('open-url', (event, url) => {
  event.preventDefault();
  dispatchDeepLink(url);
});

// Handle protocol on Windows
app.on('second-instance', (event, commandLine) => {
  const url = commandLine?.find?.((arg) => typeof arg === 'string' && arg.startsWith('vendai-pos://'));
  if (url) dispatchDeepLink(url);
});

// IPC handlers
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// Window control handlers
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// Electron-style OAuth flow (like VSCode, Zoom, etc.)
ipcMain.handle('google-oauth', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      // Clean up any existing OAuth process
      if (currentOAuthProcess) {
        currentOAuthProcess.reject(new Error('New OAuth process started'));
      }
      
      currentOAuthProcess = { resolve, reject };

      // Use direct Google OAuth with proper redirect to our app
      const googleClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      if (!googleClientId) {
        const msg = 'Missing GOOGLE_OAUTH_CLIENT_ID. Please create a Google OAuth "Desktop app" client in Google Cloud Console and set GOOGLE_OAUTH_CLIENT_ID in .env.local';
        console.error(msg);
        dialog.showErrorBox('Google Sign-in not configured', msg);
        currentOAuthProcess.reject(new Error(msg));
        currentOAuthProcess = null;
        return;
      }

      // Generate PKCE values (required for installed apps)
      const codeVerifier = base64URLEncode(crypto.randomBytes(32));
      const codeChallenge = base64URLEncode(sha256(codeVerifier));
      
  // Build Google OAuth URL that redirects to our local server
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', googleClientId);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid profile email');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('prompt', 'consent');

      // Start local callback server
      const serverApp = express();
      
      oauthServer = serverApp.listen(OAUTH_PORT, () => {
        console.log(`OAuth callback server listening on port ${OAUTH_PORT}`);
      });

      serverApp.get('/callback', async (req, res) => {
        console.log('OAuth callback received:', req.query);
        
        const code = req.query.code;
        const error = req.query.error;

        if (error) {
          const errorMsg = `Authentication failed: ${error}`;
          res.send(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h2>❌ Authentication Failed</h2>
                <p>${errorMsg}</p>
                <p>You can close this window and try again in the app.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          oauthServer.close();
          if (currentOAuthProcess) {
            currentOAuthProcess.reject(new Error(errorMsg));
            currentOAuthProcess = null;
          }
          return;
        }

        if (!code) {
          res.send(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h2>❌ No authorization code received</h2>
                <p>You can close this window and try again in the app.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          oauthServer.close();
          if (currentOAuthProcess) {
            currentOAuthProcess.reject(new Error('No authorization code received'));
            currentOAuthProcess = null;
          }
          return;
        }

        try {
          // Exchange code for tokens (we don't need client_secret for public OAuth apps)
          const tokenEndpoint = 'https://oauth2.googleapis.com/token';
          const googleClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET; // Optional: only required for Web clients
          const tokenBody = new URLSearchParams({
            client_id: googleClientId,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier
          });
          if (googleClientSecret) {
            tokenBody.set('client_secret', googleClientSecret);
          }
          const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenBody
          });

          const tokens = await tokenResponse.json();
          console.log('Token response:', tokens);

          if (tokens.error) {
            const desc = tokens.error_description || tokens.error || 'unknown_error';
            if (desc.includes('client_secret is missing')) {
              throw new Error('Token exchange failed: client_secret is missing. This usually means you are using a Web OAuth client ID. For Electron, create a Google OAuth "Desktop app" client and set GOOGLE_OAUTH_CLIENT_ID in .env.local, or set GOOGLE_OAUTH_CLIENT_SECRET as well (not recommended).');
            }
            throw new Error(`Token exchange failed: ${desc}`);
          }

          // Get user info from Google
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokens.access_token}` }
          });
          
          const userInfo = await userResponse.json();
          console.log('User info:', userInfo);

          // Success page with deep link back to app
          const deepLink = 'vendai-pos://oauth/success';
          res.send(`
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>Login Successful · VendAI</title>
                <style>
                  :root { color-scheme: dark; }
                  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; background: radial-gradient(100% 100% at 0% 0%, #0b1220 0%, #0a0f1c 50%, #0a0e19 100%); color: #e5e7eb; min-height: 100vh; display: grid; place-items: center; }
                  .card { width: min(560px, 92vw); padding: 28px; border-radius: 16px; background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03)); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06); backdrop-filter: blur(8px); text-align: center; }
                  .title { font-size: 22px; font-weight: 700; margin: 8px 0 4px; }
                  .muted { color: #9ca3af; font-size: 14px; margin: 6px 0 18px; }
                  .ok { display: inline-flex; width: 56px; height: 56px; border-radius: 50%; align-items: center; justify-content: center; background: linear-gradient(135deg,#22c55e33,#10b98122); border: 1px solid #10b98155; box-shadow: inset 0 0 20px #10b98111, 0 8px 24px rgba(16,185,129,0.15); }
                  .ok svg { color: #34d399; }
                  .btn { display: inline-flex; gap: 8px; align-items: center; justify-content: center; padding: 12px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: #ffffff; color: #111827; font-weight: 600; text-decoration: none; box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
                  .btn:hover { filter: brightness(0.97); }
                  .ghost { background: transparent; color: #e5e7eb; border-color: rgba(255,255,255,0.2); }
                  .footer { margin-top: 18px; font-size: 12px; color: #94a3b8; }
                  .row { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="ok" aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </div>
                  <div class="title">Login successful</div>
                  <div class="muted">Welcome, ${userInfo.name} — you’re signed in to VendAI.</div>
                  <div class="row">
                    <a class="btn" id="open-app" href="${deepLink}" rel="noopener">Return to the VendAI app</a>
                    <button class="btn ghost" id="close-window" type="button">Close this window</button>
                  </div>
                  <div class="footer">If the app doesn’t open automatically, click “Return to the VendAI app”.</div>
                </div>
                <script>
                  (function(){
                    const deepLink = ${JSON.stringify('vendai-pos://oauth/success')};
                    // Try to open the app automatically
                    const tryOpen = () => {
                      const a = document.createElement('a');
                      a.href = deepLink;
                      a.rel = 'noopener';
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    };
                    // Try immediately and again after a short delay
                    tryOpen();
                    setTimeout(tryOpen, 800);

                    document.getElementById('close-window').addEventListener('click', () => {
                      window.close();
                    });

                    // Attempt auto-close after a few seconds
                    setTimeout(() => { window.close(); }, 4000);
                  })();
                </script>
              </body>
            </html>
          `);
          
          oauthServer.close();
          
          if (currentOAuthProcess) {
            // Return user info to the renderer process
            currentOAuthProcess.resolve({
              success: true,
              user: {
                id: userInfo.id,
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture
              },
              tokens: {
                accessToken: tokens.access_token,
                idToken: tokens.id_token
              }
            });
            currentOAuthProcess = null;
          }

        } catch (error) {
          console.error('Token exchange error:', error);
          res.send(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: Arial; padding: 40px; text-align: center;">
                <h2>❌ Authentication Failed</h2>
                <p>Error: ${error.message}</p>
                <p>You can close this window and try again in the app.</p>
                <script>setTimeout(() => window.close(), 3000);</script>
              </body>
            </html>
          `);
          oauthServer.close();
          if (currentOAuthProcess) {
            currentOAuthProcess.reject(error);
            currentOAuthProcess = null;
          }
        }
      });

      console.log('Opening browser for Google OAuth...');
      console.log('Auth URL:', authUrl.toString());
      
      // Open the system browser to Google OAuth
  // Open the system browser using Electron's shell API (more reliable than 'open')
  await shell.openExternal(authUrl.toString());

      // Set timeout for OAuth flow (5 minutes)
      setTimeout(() => {
        if (oauthServer) {
          oauthServer.close();
        }
        if (currentOAuthProcess) {
          currentOAuthProcess.reject(new Error('OAuth timeout - please try again'));
          currentOAuthProcess = null;
        }
      }, 300000);

    } catch (error) {
      console.error('OAuth error:', error);
      if (oauthServer) {
        oauthServer.close();
      }
      reject(error);
    }
  });
});

// Handle certificate errors (for development)
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    // In development, ignore certificate errors
    event.preventDefault();
    callback(true);
  } else {
    // In production, use default behavior
    callback(false);
  }
});

// Enhanced Auto Updater Configuration
autoUpdater.autoDownload = false; // Don't auto-download, ask user first
autoUpdater.autoInstallOnAppQuit = true;

// IPC handlers for update management
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return { available: false, message: 'Updates not available in development mode' };
  }
  
  try {
    const result = await autoUpdater.checkForUpdates();
    return { available: !!result?.updateInfo, updateInfo: result?.updateInfo };
  } catch (error) {
    console.error('Update check error:', error);
    return { available: false, error: error.message };
  }
});

ipcMain.handle('download-update', async () => {
  if (isDev) {
    return { success: false, message: 'Updates not available in development mode' };
  }
  
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    console.error('Update download error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-update', () => {
  if (isDev) {
    return false;
  }
  autoUpdater.quitAndInstall(false, true);
  return true;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Auto updater events with enhanced UI feedback
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-checking');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available.');
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-not-available');
  }
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater:', err);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  console.log(`Download progress: ${percent}%`);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-download-progress', {
      percent: percent,
      transferred: progressObj.transferred,
      total: progressObj.total,
      bytesPerSecond: progressObj.bytesPerSecond
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded, ready to install');
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
});