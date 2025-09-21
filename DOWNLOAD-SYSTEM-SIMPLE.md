# 🎯 VendAI POS Download System - Simple Instructions

## Quick Overview
VendAI POS uses an automated GitHub Actions system that builds Windows executables and provides direct download links.

## Download URL (Always Latest)
```
https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe
```

If your browser or network blocks .exe downloads, use the ZIP fallback:
```
https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.zip
```

## JavaScript Implementation (Large File Optimized)
```javascript
const handleDownload = () => {
  // Method 1: Direct navigation (most reliable for large files)
  window.location.href = "https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe";
};

// Alternative: Open in new tab (allows user to manage download)
const handleDownloadNewTab = () => {
  window.open("https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe", '_blank');
};

// Fallback: Redirect to releases page
const handleDownloadFallback = () => {
  window.open("https://github.com/timothylidede/vendai-pos/releases/latest", '_blank');
};

// ZIP fallback (if .exe is blocked)
const handleZipDownload = () => {
  window.location.href = "https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.zip";
};
```

## JavaScript Implementation (with Error Handling)
```javascript
const handleDownload = async () => {
  const downloadUrl = "https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe";
  
  try {
    // For large files, direct navigation is more reliable
    window.location.href = downloadUrl;
  } catch (error) {
    // Fallback: redirect to releases page
    console.error('Direct download failed:', error);
    window.open('https://github.com/timothylidede/vendai-pos/releases/latest', '_blank');
  }
};
```

## Simple JavaScript Implementation
```javascript
const handleDownload = () => {
  const downloadUrl = "https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe";
  
  // Create download link and trigger immediately
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = 'VendAI-POS-Windows-Setup.exe';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

## React/Next.js Button Implementation
```jsx
<Button onClick={handleDownload}>
  <img src="/microsoft.png" alt="Windows" className="w-5 h-5" />
  Download for Windows
</Button>

<div className="mt-2 flex gap-3">
  <Button variant="secondary" onClick={() => window.open('https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe', '_blank')}>Open in New Tab</Button>
  <Button variant="outline" onClick={() => window.location.href = 'https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.zip'}>ZIP Fallback</Button>
</div>
```

## What Happens
1. User clicks download button
2. `.exe` file starts downloading immediately (no redirect pages)
3. File is a professional Windows installer (~150-300MB)
4. User runs installer → gets desktop shortcut + start menu entry

## Key Points
- **Windows only** - no macOS support
- **Always latest version** - URL auto-updates when new releases are published
- **Direct executable** - no zip files to extract
- **Immediate download** - no intermediate download pages
- **Professional installer** - NSIS installer with proper shortcuts

## Release Process
When developers want to update:
1. Create git tag: `git tag v1.2.0`
2. Push tag: `git push origin v1.2.0`
3. GitHub Actions automatically builds and publishes new `.exe`
4. Website download URL automatically points to new version

## File Details
- **File name**: `VendAI-POS-Windows-Setup.exe`
- **Type**: NSIS installer
- **Size**: ~150-300MB
- **Platform**: Windows only (x64)
- **Features**: Desktop shortcut, Start menu entry, Add/Remove Programs listing

## HTML Alternative (if JavaScript not available)
```html
<a href="https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe" 
   download="VendAI-POS-Windows-Setup.exe">
   Download VendAI POS for Windows
</a>

<!-- ZIP fallback link -->
<a href="https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.zip" 
  download="VendAI-POS-Windows-Setup.zip">
  Download ZIP (if .exe blocked)
</a>
```

That's it! The system is fully automated and handles everything else.

## Troubleshooting

### "Site Not Available" at 140MB+ Downloads
This is a **GitHub CDN limitation** for large files. Solutions:

1. **Use direct navigation**: `window.location.href = downloadUrl` (most reliable)
2. **Open in new tab**: `window.open(downloadUrl, '_blank')` (allows resume)
3. **Use ZIP fallback**: Some browsers/corporate networks block direct .exe downloads
3. **Multiple download mirrors**: Consider hosting on additional CDNs
4. **Reduce file size**: Optimize the Electron build

### Download Resume Support
```jsx
// Best approach for large files
<Button onClick={() => window.location.href = 'https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe'}>
  Download VendAI POS (177 MB)
</Button>

// Alternative with new tab (allows browser resume)
<Button onClick={() => window.open('https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe', '_blank')}>
  Download in New Tab
</Button>
```

### Fallback Download Button
```jsx
<Button 
  onClick={() => window.open('https://github.com/timothylidede/vendai-pos/releases/latest', '_blank')}
>
  Open Download Page
</Button>
```

### Build Issues
1. **Check GitHub Actions logs**: Go to your repo → Actions tab → Click on failed workflow
2. **Common issues**:
   - Missing icon files (remove icon references from electron-builder.json)
   - Wrong file paths in artifacts (check dist/ directory contents)
   - PowerShell vs Unix command conflicts (use PowerShell syntax on Windows runners)
3. **Test locally first**: Run `npm run dist:win` to verify build works locally
4. **Debug artifacts**: Check what files are actually being uploaded in GitHub Actions

### File Size Optimization (Long-term Solution)
177 MB is quite large for an Electron app. You can reduce this by:

1. **Remove unused dependencies**: Check package.json for unused packages
2. **Optimize build**: Add to electron-builder.json:
```json
{
  "compression": "maximum",
  "asar": {
    "smartUnpack": false
  },
  "nsis": {
    "differentialPackage": false
  }
}
```
3. **External dependencies**: Move large assets to external downloads
4. **Portable version**: Consider offering a portable .exe alongside installer

### Alternative Hosting (if GitHub limits persist)
Consider additional hosting for large files:
- **AWS S3 + CloudFront** 
- **Azure Blob Storage**
- **Google Cloud Storage** 
- **SourceForge** (free for open source)

### Notes
- Some mobile browsers cannot download large .exe files; advise users to download on a desktop.
- If Windows SmartScreen warns, click "More info" → "Run anyway" (we'll add code signing when ready).