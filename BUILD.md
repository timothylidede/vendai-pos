# VendAI POS - Build Instructions

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- For Mac builds: macOS with Xcode Command Line Tools
- For Windows builds: Windows with Visual Studio Build Tools or Visual Studio

## Quick Build Commands

### Development
```bash
# Start development mode
npm run electron:dev

# Build for testing (without publishing)
npm run pack
```

### Production Builds

#### Build for Current Platform
```bash
# Build for your current platform
npm run dist
```

#### Build for Specific Platforms
```bash
# Build Windows executable (from any platform)
npm run dist:win

# Build Mac DMG (requires macOS)
npm run dist:mac

# Build Linux packages (from Linux or Docker)
npm run dist:linux

# Build for all platforms (requires appropriate OS or CI)
npm run dist:all
```

#### Release Builds (with GitHub Release)
```bash
# Release to GitHub for current platform
npm run release

# Release Windows version
npm run release:win

# Release Mac version (requires macOS + Apple Developer account)
npm run release:mac
```

## Build Outputs

After running build commands, find your distributable files in the `dist/` directory:

### Windows
- `VendAI POS-1.0.0-x64-Setup.exe` - Installer
- `VendAI POS-1.0.0-Portable.exe` - Portable executable

### Mac
- `VendAI POS-1.0.0.dmg` - Disk image for installation
- `VendAI POS-1.0.0-mac.zip` - Zip archive

### Linux
- `VendAI POS-1.0.0.AppImage` - Portable app
- `VendAI POS_1.0.0_amd64.deb` - Debian/Ubuntu package
- `VendAI POS-1.0.0.x86_64.rpm` - RedHat/Fedora package

## Code Signing & Notarization

### Mac Notarization
For Mac App Store distribution or to avoid Gatekeeper warnings, set these environment variables:
```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASS="your-app-specific-password"
```

### Windows Code Signing
For Windows code signing, you'll need a code signing certificate. Set:
```bash
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"
```

## Icon Requirements

Place your app icons in the `build/` directory:
- `icon.icns` - Mac icon (512x512 minimum)
- `icon.ico` - Windows icon (256x256 recommended)
- `icon.png` - Linux icon (512x512 recommended)
- `dmg-background.png` - Mac DMG background (540x380)

## Troubleshooting

### Build Fails
1. Ensure all dependencies are installed: `npm install`
2. Clear build cache: `rm -rf dist/ out/`
3. Update electron-builder: `npm update electron-builder`

### Mac Notarization Issues
1. Ensure you have an Apple Developer account
2. Generate an app-specific password in your Apple ID account
3. Use Keychain Access to verify certificates

### Windows Antivirus False Positives
- Submit your built executable to antivirus vendors for whitelisting
- Consider Extended Validation (EV) code signing certificates

## CI/CD Integration

The app is configured to work with GitHub Actions for automated builds. See `.github/workflows/build.yml` for the automated build pipeline.

## Publishing to Website

After successful builds, executables can be downloaded from:
- GitHub Releases (automatic)
- Your website at vendai.digital (manual upload or API integration)

## Support

For build issues, contact: timothyliidede@gmail.com