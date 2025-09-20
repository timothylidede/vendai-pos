#!/usr/bin/env node

// Environment verification script for VendAI POS
const path = require('path');
const fs = require('fs');

console.log('🔍 VendAI POS Environment Verification\n');

// Check if .env.local exists
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envExists = fs.existsSync(envLocalPath);

console.log('📄 Environment Files:');
console.log(`- .env.local: ${envExists ? '✅ Found' : '❌ Missing'}`);

if (envExists) {
  try {
    // Load dotenv to read the file
    require('dotenv').config({ path: envLocalPath });
    
    const requiredVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID'
    ];
    
    console.log('\n🔧 Firebase Environment Variables:');
    requiredVars.forEach(varName => {
      const value = process.env[varName];
      const status = value ? '✅' : '❌';
      const display = value ? `${value.substring(0, 10)}...` : 'Missing';
      console.log(`- ${varName}: ${status} ${display}`);
    });
    
    // Check Firebase project configuration
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    
    console.log('\n🔥 Firebase Configuration:');
    console.log(`- Project ID: ${projectId || 'Not configured'}`);
    console.log(`- Auth Domain: ${authDomain || 'Not configured'}`);
    
  } catch (error) {
    console.log('❌ Error reading .env.local:', error.message);
  }
}

// Check if required files exist for build
console.log('\n📦 Build Files:');
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const electronBuilderPath = path.join(__dirname, '..', 'electron-builder.json');
const mainElectronPath = path.join(__dirname, '..', 'electron', 'main.js');

console.log(`- package.json: ${fs.existsSync(packageJsonPath) ? '✅' : '❌'}`);
console.log(`- electron-builder.json: ${fs.existsSync(electronBuilderPath) ? '✅' : '❌'}`);
console.log(`- electron/main.js: ${fs.existsSync(mainElectronPath) ? '✅' : '❌'}`);

// Check Next.js build
const nextBuildPath = path.join(__dirname, '..', '.next');
console.log(`- Next.js build: ${fs.existsSync(nextBuildPath) ? '✅ Found' : '⚠️ Not built yet'}`);

console.log('\n🚀 Recommendations:');
if (!envExists) {
  console.log('- Copy .env.template to .env.local and configure Firebase credentials');
}
if (!fs.existsSync(nextBuildPath)) {
  console.log('- Run "npm run build" to create Next.js production build');
}
console.log('- Run "npm run electron:dev" for development');
console.log('- Run "npm run electron:pack" to create distributable package');

console.log('\n✨ Environment check complete!');