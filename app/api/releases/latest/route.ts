import { NextRequest, NextResponse } from 'next/server'

interface GitHubAsset {
  id: number
  name: string
  browser_download_url: string
  size: number
  content_type: string
  download_count: number
}

interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: GitHubAsset[]
}

interface ProcessedAsset {
  name: string
  url: string
  size: number
  platform: 'windows' | 'macos' | 'linux'
  type: 'installer' | 'portable' | 'archive' | 'package'
  downloads: number
}

interface ReleaseInfo {
  version: string
  name: string
  description: string
  publishedAt: string
  downloads: {
    total: number
    windows: ProcessedAsset[]
    macos: ProcessedAsset[]
    linux: ProcessedAsset[]
  }
}

function categorizeAsset(asset: GitHubAsset): ProcessedAsset {
  const name = asset.name.toLowerCase()
  
  let platform: 'windows' | 'macos' | 'linux'
  let type: 'installer' | 'portable' | 'archive' | 'package'
  
  // Determine platform
  if (name.includes('windows') || name.includes('win') || name.endsWith('.exe')) {
    platform = 'windows'
  } else if (name.includes('macos') || name.includes('mac') || name.endsWith('.dmg')) {
    platform = 'macos'
  } else if (name.includes('linux') || name.endsWith('.appimage') || name.endsWith('.deb') || name.endsWith('.rpm')) {
    platform = 'linux'
  } else {
    platform = 'windows' // Default fallback
  }
  
  // Determine type
  if (name.includes('setup') || name.includes('installer') || name.endsWith('.exe')) {
    type = 'installer'
  } else if (name.includes('portable')) {
    type = 'portable'
  } else if (name.endsWith('.zip') || name.endsWith('.tar.gz')) {
    type = 'archive'
  } else if (name.endsWith('.deb') || name.endsWith('.rpm') || name.endsWith('.appimage')) {
    type = 'package'
  } else {
    type = 'installer' // Default fallback
  }
  
  return {
    name: asset.name,
    url: asset.browser_download_url,
    size: asset.size,
    platform,
    type,
    downloads: asset.download_count
  }
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(
      'https://api.github.com/repos/timothylidede/vendai-pos/releases/latest',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'VendAI-POS-Website'
        },
        next: { revalidate: 300 } // Cache for 5 minutes
      }
    )
    
    if (!response.ok) {
      console.error('GitHub API error:', response.status, response.statusText)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching release:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const release = await fetchLatestRelease()
    
    if (!release) {
      return NextResponse.json(
        { error: 'Unable to fetch release information' },
        { status: 503 }
      )
    }
    
    // Process assets
    const processedAssets = release.assets.map(categorizeAsset)
    
    const windows = processedAssets.filter(asset => asset.platform === 'windows')
    const macos = processedAssets.filter(asset => asset.platform === 'macos')
    const linux = processedAssets.filter(asset => asset.platform === 'linux')
    
    const totalDownloads = processedAssets.reduce((sum, asset) => sum + asset.downloads, 0)
    
    const releaseInfo: ReleaseInfo = {
      version: release.tag_name,
      name: release.name,
      description: release.body || '',
      publishedAt: release.published_at,
      downloads: {
        total: totalDownloads,
        windows,
        macos,
        linux
      }
    }
    
    return NextResponse.json(releaseInfo, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}