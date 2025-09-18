import { NextRequest, NextResponse } from 'next/server'

interface UpdateCheckRequest {
  currentVersion: string
  platform: 'win32' | 'darwin' | 'linux'
  arch: 'x64' | 'arm64'
}

interface UpdateResponse {
  updateAvailable: boolean
  latestVersion: string
  releaseNotes?: string
  downloadUrl?: string
  publishedAt?: string
}

async function fetchLatestRelease() {
  try {
    const response = await fetch(
      'https://api.github.com/repos/timothylidede/vendai-pos/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'VendAI-POS-Updater'
        },
        next: { revalidate: 3600 } // Cache for 1 hour
      }
    )
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching release:', error)
    return null
  }
}

function compareVersions(current: string, latest: string): boolean {
  // Remove 'v' prefix if present
  const cleanCurrent = current.replace(/^v/, '')
  const cleanLatest = latest.replace(/^v/, '')
  
  const currentParts = cleanCurrent.split('.').map(Number)
  const latestParts = cleanLatest.split('.').map(Number)
  
  // Ensure both version arrays have same length
  const maxLength = Math.max(currentParts.length, latestParts.length)
  while (currentParts.length < maxLength) currentParts.push(0)
  while (latestParts.length < maxLength) latestParts.push(0)
  
  for (let i = 0; i < maxLength; i++) {
    if (latestParts[i] > currentParts[i]) return true
    if (latestParts[i] < currentParts[i]) return false
  }
  
  return false // Versions are equal
}

function findDownloadUrl(assets: any[], platform: string, arch: string): string | undefined {
  // Find the appropriate download URL based on platform and architecture
  for (const asset of assets) {
    const name = asset.name.toLowerCase()
    
    if (platform === 'win32' && (name.includes('windows') || name.endsWith('.exe'))) {
      // For Windows, prefer Setup.exe over portable
      if (name.includes('setup')) return asset.browser_download_url
    }
    
    if (platform === 'darwin' && (name.includes('mac') || name.endsWith('.dmg'))) {
      // For macOS, match architecture if specified
      if (arch === 'arm64' && name.includes('apple')) return asset.browser_download_url
      if (arch === 'x64' && name.includes('intel')) return asset.browser_download_url
      // Fallback to any Mac download
      if (!name.includes('apple') && !name.includes('intel')) return asset.browser_download_url
    }
    
    if (platform === 'linux' && (name.includes('linux') || name.endsWith('.appimage'))) {
      return asset.browser_download_url
    }
  }
  
  // Fallback: return first asset URL if no specific match
  return assets[0]?.browser_download_url
}

export async function POST(request: NextRequest) {
  try {
    const body: UpdateCheckRequest = await request.json()
    
    if (!body.currentVersion || !body.platform) {
      return NextResponse.json(
        { error: 'Missing required fields: currentVersion, platform' },
        { status: 400 }
      )
    }
    
    const release = await fetchLatestRelease()
    
    if (!release) {
      return NextResponse.json(
        { error: 'Unable to check for updates' },
        { status: 503 }
      )
    }
    
    const updateAvailable = compareVersions(body.currentVersion, release.tag_name)
    
    const response: UpdateResponse = {
      updateAvailable,
      latestVersion: release.tag_name,
      publishedAt: release.published_at
    }
    
    if (updateAvailable) {
      response.releaseNotes = release.body || 'New version available'
      response.downloadUrl = findDownloadUrl(release.assets, body.platform, body.arch)
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('Update check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also support GET requests for simple version checks
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const currentVersion = searchParams.get('version')
  const platform = searchParams.get('platform')
  const arch = searchParams.get('arch') || 'x64'
  
  if (!currentVersion || !platform) {
    return NextResponse.json(
      { error: 'Missing required query parameters: version, platform' },
      { status: 400 }
    )
  }
  
  // Create a mock request body and call POST logic
  const mockBody: UpdateCheckRequest = {
    currentVersion,
    platform: platform as 'win32' | 'darwin' | 'linux',
    arch: arch as 'x64' | 'arm64'
  }
  
  try {
    const release = await fetchLatestRelease()
    
    if (!release) {
      return NextResponse.json(
        { error: 'Unable to check for updates' },
        { status: 503 }
      )
    }
    
    const updateAvailable = compareVersions(mockBody.currentVersion, release.tag_name)
    
    const response: UpdateResponse = {
      updateAvailable,
      latestVersion: release.tag_name,
      publishedAt: release.published_at
    }
    
    if (updateAvailable) {
      response.releaseNotes = release.body || 'New version available'
      response.downloadUrl = findDownloadUrl(release.assets, mockBody.platform, mockBody.arch)
    }
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    console.error('Update check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}