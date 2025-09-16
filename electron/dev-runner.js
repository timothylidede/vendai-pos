#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  // In development mode, start Next.js dev server first
  console.log('Starting development server...');
  
  const nextDev = spawn('npm', ['run', 'dev'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  // Wait for the dev server to start, then launch Electron
  setTimeout(() => {
    console.log('Starting Electron...');
    const electron = spawn('electron', ['.'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    // Handle cleanup
    process.on('SIGINT', () => {
      nextDev.kill();
      electron.kill();
      process.exit();
    });
  }, 5000); // Wait 5 seconds for dev server to start

} else {
  // In production, just start Electron
  const electron = spawn('electron', ['.'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });
}