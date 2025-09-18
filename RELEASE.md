# VendAI POS Release Guide

## Overview

VendAI POS uses GitHub Actions for automated cross-platform builds and releases. This document explains the release process and setup requirements.

## Release Process

### Automated Releases

The GitHub Actions workflow automatically builds and releases when you:

1. **Create a version tag** (recommended):
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Publish a GitHub release** manually through the web interface

3. **Trigger manually** through the Actions tab

### Build Outputs

Each release generates:

**Windows:**
- `VendAI-POS-v1.0.0-Windows-Setup.exe` - Full installer with auto-updater
- `VendAI-POS-v1.0.0-Windows-Portable.exe` - Portable executable

**macOS:**
- `VendAI-POS-v1.0.0-macOS-Intel.dmg` - Intel Mac disk image
- `VendAI-POS-v1.0.0-macOS-Intel.zip` - Intel Mac archive
- `VendAI-POS-v1.0.0-macOS-AppleSilicon.dmg` - ARM64 Mac disk image
- `VendAI-POS-v1.0.0-macOS-AppleSilicon.zip` - ARM64 Mac archive

**Linux:**
- `VendAI-POS-v1.0.0-Linux.AppImage` - Universal Linux executable
- `VendAI-POS-v1.0.0-Linux.deb` - Ubuntu/Debian package
- `VendAI-POS-v1.0.0-Linux.rpm` - RedHat/Fedora package

## GitHub Secrets Setup

For production releases, configure these secrets in your GitHub repository settings:

### Required Secrets

1. **GITHUB_TOKEN** - Automatically provided by GitHub Actions

### Optional (for code signing)

#### macOS Code Signing:
```
APPLE_ID - Your Apple Developer ID email
APPLE_ID_PASS - App-specific password for your Apple ID
MAC_CERTIFICATE - Base64-encoded .p12 certificate file
MAC_CERTIFICATE_PASSWORD - Password for the .p12 certificate
```

#### Windows Code Signing:
```
WIN_CSC_LINK - Base64-encoded .p12 certificate file
WIN_CSC_KEY_PASSWORD - Password for the .p12 certificate
```

### Setting up Apple Code Signing

1. **Generate certificates in Apple Developer Console**:
   - Developer ID Application certificate
   - Developer ID Installer certificate

2. **Export certificates**:
   ```bash
   # Export from Keychain Access as .p12 files
   # Convert to base64
   base64 -i DeveloperIDApplication.p12 -o cert.txt
   ```

3. **Create app-specific password**:
   - Visit appleid.apple.com
   - Sign in → App-Specific Passwords → Generate

## Local Development Builds

### Build Commands

```bash
# Build for current platform
npm run pack

# Build for specific platforms
npm run pack:win    # Windows
npm run pack:mac    # macOS (Intel + Apple Silicon)
npm run pack:linux  # Linux

# Build distributions (installers)
npm run dist:win    # Windows installer
npm run dist:mac    # macOS dmg + zip
npm run dist:linux  # Linux AppImage, deb, rpm

# Build for all platforms
npm run dist:all
```

### Prerequisites

- **Node.js 18+**
- **Platform-specific requirements**:
  - Windows: Windows 10+ for building Windows apps
  - macOS: macOS 10.15+ for building Mac apps
  - Linux: Recent distribution for building Linux apps

## Distribution Workflow

1. **Development Phase**:
   - Use `npm run electron:dev` for testing
   - Use `npm run pack` for local builds

2. **Pre-Release Testing**:
   - Create pre-release tags: `v1.0.0-beta.1`
   - Test installers on target platforms

3. **Production Release**:
   - Update version in `package.json`
   - Create release tag: `v1.0.0`
   - GitHub Actions automatically builds and publishes

## Auto-Update Setup

VendAI POS includes `electron-updater` for automatic updates:

- **Windows/Linux**: Downloads delta updates automatically
- **macOS**: Prompts user to download from Mac App Store or direct download

Update checks occur:
- On app startup
- Every 24 hours while running
- When manually triggered from Help menu

## Troubleshooting

### Common Issues

1. **Build fails on macOS**:
   - Ensure Xcode Command Line Tools are installed
   - Check code signing certificates and passwords

2. **Windows Defender warnings**:
   - Expected for unsigned applications
   - Consider Extended Validation (EV) code signing certificate

3. **Linux dependency issues**:
   - AppImage is self-contained and usually works
   - For .deb/.rpm, check system requirements

### Debug Build Process

```bash
# Enable verbose logging
DEBUG=electron-builder npm run dist:win

# Check build configuration
npx electron-builder --help

# Validate configuration
npx electron-builder --dir
```

## Website Integration

For integrating with vendai.digital:

1. **GitHub Releases API**: Fetch latest release info
2. **Direct Download Links**: Link to release assets
3. **Platform Detection**: Show appropriate download for user's OS

Example API endpoint:
```
https://api.github.com/repos/timothylidede/vendai-pos/releases/latest
```

## Security Considerations

- All builds are reproducible and traceable
- Code signing prevents tampering warnings
- HTTPS-only distribution
- Regular security updates through auto-updater

## Support

- **GitHub Issues**: Bug reports and feature requests
- **Release Notes**: Changelog for each version
- **Platform-specific installation guides** in README.md