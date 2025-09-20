# 🚀 VendAI POS Release & Download System

## Overview

This system automatically builds and distributes VendAI POS executables for Windows and macOS using GitHub Actions. Users get direct executable downloads, not zip files.

## 🏗️ How It Works

### 1. **Automated Builds**
When you create a Git tag (like `v1.0.0`), GitHub Actions automatically:
- Builds Windows `.exe` installer using NSIS
- Builds macOS `.dmg` files for Intel and Apple Silicon
- Creates a GitHub Release with these executables as downloadable assets

### 2. **Cross-Platform Building**
- **Windows builds** run on `windows-latest` runners
- **macOS builds** run on `macos-latest` runners  
- Both platforms build simultaneously for faster releases

### 3. **Smart Asset Management**
The system automatically renames and organizes files:
- `VendAI-POS-Windows-Setup.exe` (Windows installer)
- `VendAI-POS-macOS-Intel.dmg` (Intel Macs)
- `VendAI-POS-macOS-AppleSilicon.dmg` (M1/M2/M3 Macs)

## 📦 Release Process

### Step 1: Prepare Release
```bash
# Update version in package.json
npm version 1.2.0

# Commit the version bump
git commit -am "Release v1.2.0"
```

### Step 2: Create Release Tag
```bash
# Create and push tag
git tag v1.2.0
git push origin v1.2.0
```

### Step 3: GitHub Actions Takes Over
- Builds start automatically when tag is pushed
- Check progress at: `https://github.com/timothylidede/vendai-pos/actions`
- Release appears at: `https://github.com/timothylidede/vendai-pos/releases`

### Step 4: Verify Downloads
```bash
# Check release info
npm run release:info
```

## 🛠️ Configuration Files

### `electron-builder.json`
```json
{
  "win": {
    "target": [{ "target": "nsis", "arch": ["x64"] }],
    "artifactName": "${productName}-${version}-Windows-Setup.${ext}"
  },
  "mac": {
    "target": [{ "target": "dmg", "arch": ["x64", "arm64"] }],
    "artifactName": "${productName}-${version}-macOS-${arch}.${ext}"
  }
}
```

### `.github/workflows/release.yml`
- **Trigger**: Git tags starting with `v` (e.g., `v1.0.0`)
- **Platforms**: Windows and macOS
- **Outputs**: Direct executables (no zip files)
- **Release**: Automatic GitHub release creation

## 🌐 Website Integration

### Option 1: Dynamic JavaScript (Recommended)
Use the provided `website-download-template.html` which:
- Automatically fetches latest release info
- Creates download buttons dynamically
- Always shows current version
- Handles different macOS architectures

### Option 2: Manual Update
```html
<!-- Update these URLs after each release -->
<a href="https://github.com/timothylidede/vendai-pos/releases/download/v1.0.0/VendAI-POS-Windows-Setup.exe" 
   download="VendAI-POS-Windows-Setup.exe">
   Download for Windows
</a>

<a href="https://github.com/timothylidede/vendai-pos/releases/download/v1.0.0/VendAI-POS-macOS-AppleSilicon.dmg"
   download="VendAI-POS-macOS-AppleSilicon.dmg">
   Download for macOS
</a>
```

### Option 3: Always Latest Links
```html
<!-- These always point to the latest release -->
<a href="https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe">
   Download for Windows
</a>

<a href="https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-macOS-AppleSilicon.dmg">
   Download for macOS
</a>
```

## 🔧 Available Commands

```bash
# Build locally (testing)
npm run dist:win          # Windows build
npm run dist:mac          # macOS build  
npm run dist:all          # All platforms

# Release info
npm run release:info      # Show latest release downloads
npm run release:help      # Show help information

# Manual releases (advanced)
npm run release           # Build and publish to GitHub
npm run release:win       # Windows only
npm run release:mac       # macOS only
```

## 🎯 File Types Generated

### Windows
- **NSIS Installer** (`.exe`): Full installer with uninstaller
- **Size**: ~150-300MB (includes Electron + Next.js)
- **Features**: Start menu shortcuts, desktop shortcut, add/remove programs entry

### macOS
- **DMG Package** (`.dmg`): Drag-to-Applications installer
- **Architectures**: Intel (x64) and Apple Silicon (arm64)
- **Size**: ~150-300MB per architecture
- **Features**: Code signing ready, notarization support

## 🔐 Security Setup (Optional)

For code signing and notarization, add these GitHub secrets:

### Windows Code Signing
- `WINDOWS_CSC_LINK`: Base64 encoded certificate
- `WINDOWS_CSC_KEY_PASSWORD`: Certificate password

### macOS Code Signing
- `APPLE_ID`: Apple Developer ID
- `APPLE_APP_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Developer team ID
- `CSC_LINK`: Base64 encoded certificate
- `CSC_KEY_PASSWORD`: Certificate password

## 🐛 Troubleshooting

### Build Failures
1. Check GitHub Actions logs: `/actions`
2. Verify Node.js version compatibility
3. Check for missing dependencies
4. Ensure Firebase environment variables are set

### Download Issues
1. Verify release was created successfully
2. Check file names match expected patterns
3. Ensure GitHub repository is public or user has access
4. Test direct GitHub release URLs

### Website Integration
1. Check CORS policies for GitHub API
2. Verify JavaScript fetch permissions
3. Test fallback to manual GitHub links
4. Check browser console for errors

## 📊 Usage Analytics

Track downloads by adding analytics to your website:

```javascript
// Track download clicks
document.querySelectorAll('.download-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    // Google Analytics example
    gtag('event', 'download', {
      'event_category': 'software',
      'event_label': e.target.dataset.platform,
      'value': 1
    });
  });
});
```

## 🔄 Version Management

### Semantic Versioning
- `v1.0.0` - Major release
- `v1.1.0` - Minor features
- `v1.0.1` - Bug fixes

### Pre-releases
- `v1.0.0-beta.1` - Beta versions
- `v1.0.0-alpha.1` - Alpha versions

## 🎉 Success!

After setup, your download flow is:
1. **User clicks download button** → Immediately starts downloading `.exe` or `.dmg`
2. **No zip files** → Direct executable downloads
3. **Auto-updates** → Website always shows latest version
4. **Cross-platform** → Windows and macOS support
5. **Professional** → Proper installers with shortcuts and uninstallers

The GitHub Actions system handles everything automatically - you just need to push a tag!