#!/usr/bin/env node

/**
 * Release Helper Script for VendAI POS
 * This script helps create releases and provides download URLs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_REPO = 'timothylidede/vendai-pos';
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

async function getLatestRelease() {
  try {
    return new Promise((resolve, reject) => {
      const req = https.get(LATEST_RELEASE_API, {
        headers: {
          'User-Agent': 'VendAI-POS-Release-Script'
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const release = JSON.parse(data);
            resolve(release);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  } catch (error) {
    console.error('Error fetching latest release:', error.message);
    return null;
  }
}

async function generateDownloadInfo() {
  console.log('🔍 Fetching latest release information...\n');
  
  const release = await getLatestRelease();
  
  if (!release) {
    console.log('❌ Could not fetch release information');
    console.log('💡 Make sure you have created a release on GitHub first');
    return;
  }

  console.log(`📦 Latest Release: ${release.tag_name}`);
  console.log(`📅 Published: ${new Date(release.published_at).toLocaleString()}`);
  console.log(`🌟 Downloads: ${release.assets.reduce((sum, asset) => sum + asset.download_count, 0)}\n`);

  console.log('📥 Download URLs:');
  console.log('================\n');

  // Find Windows executable
  const windowsAsset = release.assets.find(asset => 
    asset.name.includes('Windows') && asset.name.endsWith('.exe')
  );
  
  if (windowsAsset) {
    console.log('🪟 Windows:');
    console.log(`   File: ${windowsAsset.name}`);
    console.log(`   URL:  ${windowsAsset.browser_download_url}`);
    console.log(`   Size: ${(windowsAsset.size / 1024 / 1024).toFixed(1)} MB\n`);
  }

  // Find macOS executables
  const macAssets = release.assets.filter(asset => 
    asset.name.includes('macOS') && asset.name.endsWith('.dmg')
  );
  
  if (macAssets.length > 0) {
    console.log('🍎 macOS:');
    macAssets.forEach(asset => {
      console.log(`   File: ${asset.name}`);
      console.log(`   URL:  ${asset.browser_download_url}`);
      console.log(`   Size: ${(asset.size / 1024 / 1024).toFixed(1)} MB\n`);
    });
  }

  // Generate HTML snippet for website
  console.log('🌐 HTML for Website Integration:');
  console.log('=================================\n');

  let htmlSnippet = '';
  
  if (windowsAsset) {
    htmlSnippet += `<!-- Windows Download Button -->\n`;
    htmlSnippet += `<a href="${windowsAsset.browser_download_url}" \n`;
    htmlSnippet += `   download="${windowsAsset.name}"\n`;
    htmlSnippet += `   class="download-btn windows-btn">\n`;
    htmlSnippet += `  <span>Download for Windows</span>\n`;
    htmlSnippet += `  <small>${windowsAsset.name} (${(windowsAsset.size / 1024 / 1024).toFixed(1)} MB)</small>\n`;
    htmlSnippet += `</a>\n\n`;
  }

  const intelMac = macAssets.find(asset => asset.name.includes('Intel'));
  const appleSiliconMac = macAssets.find(asset => asset.name.includes('AppleSilicon'));
  const universalMac = macAssets.find(asset => !asset.name.includes('Intel') && !asset.name.includes('AppleSilicon'));

  if (appleSiliconMac || intelMac || universalMac) {
    htmlSnippet += `<!-- macOS Download Button -->\n`;
    const macAsset = appleSiliconMac || universalMac || intelMac;
    htmlSnippet += `<a href="${macAsset.browser_download_url}" \n`;
    htmlSnippet += `   download="${macAsset.name}"\n`;
    htmlSnippet += `   class="download-btn macos-btn">\n`;
    htmlSnippet += `  <span>Download for macOS</span>\n`;
    htmlSnippet += `  <small>${macAsset.name} (${(macAsset.size / 1024 / 1024).toFixed(1)} MB)</small>\n`;
    htmlSnippet += `</a>\n\n`;
  }

  console.log(htmlSnippet);

  // Save to file
  const outputFile = path.join(__dirname, '..', 'download-info.json');
  const downloadInfo = {
    version: release.tag_name,
    published_at: release.published_at,
    windows: windowsAsset ? {
      name: windowsAsset.name,
      url: windowsAsset.browser_download_url,
      size: windowsAsset.size
    } : null,
    macos: macAssets.map(asset => ({
      name: asset.name,
      url: asset.browser_download_url,
      size: asset.size
    })),
    html_snippet: htmlSnippet
  };

  fs.writeFileSync(outputFile, JSON.stringify(downloadInfo, null, 2));
  console.log(`💾 Download information saved to: ${outputFile}`);
}

function showUsage() {
  console.log(`
🚀 VendAI POS Release Helper

Usage:
  node scripts/create-release.js [command]

Commands:
  info     - Show latest release download information
  help     - Show this help message

Examples:
  node scripts/create-release.js info
  
How GitHub Actions Works:
========================

1. 🏷️  Create a Git Tag:
   git tag v1.0.0
   git push origin v1.0.0

2. 🤖 GitHub Actions automatically:
   - Builds Windows .exe installer
   - Builds macOS .dmg files (Intel + Apple Silicon)
   - Creates a GitHub Release
   - Uploads executables as release assets

3. 📥 Users can then download:
   - Direct .exe file for Windows
   - Direct .dmg file for macOS
   - No zip files, just clean executables!

4. 🌐 Update your website to point to these URLs

Release Process:
===============
1. Update version in package.json
2. Commit changes: git commit -am "Release v1.0.0"
3. Create tag: git tag v1.0.0
4. Push tag: git push origin v1.0.0
5. GitHub Actions builds and creates release automatically!
`);
}

// Main execution
const command = process.argv[2] || 'help';

switch (command) {
  case 'info':
    generateDownloadInfo();
    break;
  case 'help':
  default:
    showUsage();
    break;
}