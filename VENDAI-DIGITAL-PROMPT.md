# 📋 Prompt for vendai.digital Copilot

Copy this exact prompt to your Copilot working on the vendai.digital website:

---

**I need to create a download page for VendAI POS desktop app on vendai.digital. I have a working API that serves release information.**

## Requirements:
1. Create a modern download page at `/download` or `/vendai-pos-download` 
2. Fetch release info from API: `https://vendai-pos.vercel.app/api/releases/latest`
3. Auto-detect user's operating system (Windows/Mac/Linux)
4. Show appropriate download buttons for each platform
5. Include system requirements and installation instructions
6. Handle loading states and API errors gracefully

## API Response Format:
```json
{
  "version": "v1.0.0",
  "name": "VendAI POS v1.0.0", 
  "description": "Release notes...",
  "publishedAt": "2025-09-18T12:00:00Z",
  "downloads": {
    "total": 1234,
    "windows": [
      {
        "name": "VendAI-POS-v1.0.0-Windows-Setup.exe",
        "url": "https://github.com/timothylidede/vendai-pos/releases/download/v1.0.0/VendAI-POS-v1.0.0-Windows-Setup.exe",
        "size": 87654321,
        "platform": "windows",
        "type": "installer",
        "downloads": 567
      }
    ],
    "macos": [
      {
        "name": "VendAI-POS-v1.0.0-macOS-Intel.dmg",
        "url": "https://github.com/.../VendAI-POS-v1.0.0-macOS-Intel.dmg",
        "size": 92345678,
        "platform": "macos", 
        "type": "installer",
        "downloads": 234
      }
    ],
    "linux": [
      {
        "name": "VendAI-POS-v1.0.0-Linux.AppImage",
        "url": "https://github.com/.../VendAI-POS-v1.0.0-Linux.AppImage",
        "size": 78901234,
        "platform": "linux",
        "type": "package", 
        "downloads": 123
      }
    ]
  }
}
```

## Design Requirements:
- Use vendai.digital's existing design system and components
- Responsive design (mobile + desktop)
- Show file sizes in human-readable format (MB/GB)
- Display download counts if available
- Loading spinner while fetching API data
- Error message if API fails: "Download information temporarily unavailable"
- Platform detection JavaScript to show relevant downloads first

## System Requirements to Display:
**Windows:** Windows 10 or later (64-bit), 4GB RAM, 500MB storage
**macOS:** macOS 10.15 (Catalina) or later, 4GB RAM, 500MB storage  
**Linux:** Ubuntu 18.04+ or equivalent, 4GB RAM, 500MB storage

## Platform Detection Logic:
```javascript
function detectOS() {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  
  if (/Mac/.test(platform)) return 'macos';
  if (/Win/.test(platform)) return 'windows'; 
  if (/Linux/.test(platform)) return 'linux';
  return 'unknown';
}
```

## Call-to-Action:
Primary button: "Download for [Detected OS]"
Secondary buttons: "Download for [Other OS]"
Tertiary: "View all downloads"

Create a professional download experience that integrates seamlessly with vendai.digital's branding and navigation.

---

**That's the complete prompt for your vendai.digital Copilot! 📋**