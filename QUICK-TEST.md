# 🚀 Quick Release Test

To test your new release system:

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
- ✅ macOS build (creates .dmg files)
- ✅ Release creation with downloadable assets

## 3. Test Downloads

Visit: https://github.com/timothylidede/vendai-pos/releases

You should find:
- `VendAI-POS-Windows-Setup.exe` (Windows installer)
- `VendAI-POS-macOS-Intel.dmg` (Intel Macs)
- `VendAI-POS-macOS-AppleSilicon.dmg` (M1/M2/M3 Macs)

## 4. Integration URLs

Use these in your website:

**Always Latest (Recommended):**
```html
<a href="https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-Windows-Setup.exe">
  Download Windows
</a>

<a href="https://github.com/timothylidede/vendai-pos/releases/latest/download/VendAI-POS-macOS-AppleSilicon.dmg">
  Download macOS
</a>
```

**Dynamic (Best UX):**
Use the JavaScript code from `website-download-template.html`

## 5. Verify Success

- Click download buttons → Files download immediately
- No zip files, just clean executables
- Professional installers with proper shortcuts
- Cross-platform support working

🎉 Your release system is ready!