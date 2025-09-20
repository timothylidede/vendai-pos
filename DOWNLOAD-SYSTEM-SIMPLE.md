# 🎯 VendAI POS Download System - Simple Instructions

## Quick Overview
VendAI POS uses an automated GitHub Actions system that builds Windows executables and provides direct download links.

## Download URL (Always Latest)
```
https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe
```

## JavaScript Implementation
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
```

That's it! The system is fully automated and handles everything else.