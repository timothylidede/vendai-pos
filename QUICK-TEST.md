# 🚀 Quick Release Test - Windows Only

To test your new Windows-only release system:

## 1. Create a Test Release

```bash
# Update version
npm version patch

# Create tag and push
git add -A
git commit -m "Test release system"
git tag v1.0.1
git push origin main
git push origin v1.0.1
```

## 2. Monitor the Build

Visit: https://github.com/timothylidede/vendai-pos/actions

You should see:
- ✅ Windows build (creates .exe)
- ✅ Release creation with downloadable assets

## 3. Test Downloads

Visit: https://github.com/timothylidede/vendai-pos/releases

You should find:
- `VendAI-POS-Windows-Setup.exe` (Windows installer)

## 4. Website Integration

Use this URL in your website:

**Always Latest (Recommended):**
```html
<a href="https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe">
  Download for Windows
</a>
```

**Direct Download JavaScript:**
```javascript
const handleDownload = () => {
  const downloadUrl = "https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe";
  window.open(downloadUrl, '_blank');
};
```

## 5. Verify Success

- Click download button → .exe file downloads immediately
- No zip files, just clean Windows installer
- Professional NSIS installer with shortcuts
- Windows-only, simplified system

🎉 Your Windows-only release system is ready!

**Dynamic (Best UX):**
Use the JavaScript code from `website-download-template.html`

## 5. Verify Success

- Click download buttons → Files download immediately
- No zip files, just clean executables
- Professional installers with proper shortcuts
- Cross-platform support working

🎉 Your release system is ready!