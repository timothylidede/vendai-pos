'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, RefreshCw, AlertCircle, CheckCircle, X } from 'lucide-react'

interface UpdateInfo {
  version: string
  releaseNotes?: string
  releaseDate?: string
}

interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

type UpdateState = 
  | 'idle' 
  | 'checking' 
  | 'available' 
  | 'not-available' 
  | 'downloading' 
  | 'downloaded' 
  | 'error'

const UpdateManager: React.FC = () => {
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [isVisible, setIsVisible] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if running in Electron environment
    const electronAvailable = typeof window !== 'undefined' && window.electronAPI
    setIsElectron(!!electronAvailable)
    
    if (!electronAvailable) return

    // Get current version
    window.electronAPI!.getAppVersion().then(setCurrentVersion).catch(console.error)

    // Set up event listeners
    const removeListeners: (() => void)[] = []

    // Update checking
    const onUpdateChecking = () => {
      setUpdateState('checking')
      setError(null)
    }
    window.electronAPI!.onUpdateChecking(onUpdateChecking)
    removeListeners.push(() => window.electronAPI!.offUpdateChecking(onUpdateChecking))

    // Update available
    const onUpdateAvailable = (info: UpdateInfo) => {
      setUpdateState('available')
      setUpdateInfo(info)
      setIsVisible(true)
    }
    window.electronAPI!.onUpdateAvailable(onUpdateAvailable)
    removeListeners.push(() => window.electronAPI!.offUpdateAvailable(onUpdateAvailable))

    // Update not available
    const onUpdateNotAvailable = () => {
      setUpdateState('not-available')
      setUpdateInfo(null)
    }
    window.electronAPI!.onUpdateNotAvailable(onUpdateNotAvailable)
    removeListeners.push(() => window.electronAPI!.offUpdateNotAvailable(onUpdateNotAvailable))

    // Update error
    const onUpdateError = (errorMessage: string) => {
      setUpdateState('error')
      setError(errorMessage)
      setIsVisible(true)
    }
    window.electronAPI!.onUpdateError(onUpdateError)
    removeListeners.push(() => window.electronAPI!.offUpdateError(onUpdateError))

    // Download progress
    const onDownloadProgress = (progress: DownloadProgress) => {
      setDownloadProgress(progress)
    }
    window.electronAPI!.onUpdateDownloadProgress(onDownloadProgress)
    removeListeners.push(() => window.electronAPI!.offUpdateDownloadProgress(onDownloadProgress))

    // Update downloaded
    const onUpdateDownloaded = (info: UpdateInfo) => {
      setUpdateState('downloaded')
      setUpdateInfo(info)
      setDownloadProgress(null)
      setIsVisible(true)
    }
    window.electronAPI!.onUpdateDownloaded(onUpdateDownloaded)
    removeListeners.push(() => window.electronAPI!.offUpdateDownloaded(onUpdateDownloaded))

    return () => {
      removeListeners.forEach(remove => remove())
    }
  }, [])

  // Don't render if not in Electron environment
  if (!isElectron) return null

  const checkForUpdates = async () => {
    if (!window.electronAPI) return

    setUpdateState('checking')
    setError(null)
    setIsVisible(true)

    try {
      const result = await window.electronAPI.checkForUpdates()
      
      if (result.error) {
        setUpdateState('error')
        setError(result.error)
      } else if (result.available) {
        setUpdateState('available')
        setUpdateInfo(result.updateInfo)
      } else {
        setUpdateState('not-available')
        setTimeout(() => setIsVisible(false), 3000) // Auto-hide after 3 seconds
      }
    } catch (err) {
      setUpdateState('error')
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    }
  }

  const downloadUpdate = async () => {
    if (!window.electronAPI) return

    setUpdateState('downloading')
    setDownloadProgress(null)

    try {
      const result = await window.electronAPI.downloadUpdate()
      
      if (!result.success) {
        setUpdateState('error')
        setError(result.error || 'Download failed')
      }
      // Success state is handled by the update-downloaded event
    } catch (err) {
      setUpdateState('error')
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const installUpdate = () => {
    if (!window.electronAPI) return
    window.electronAPI.installUpdate()
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`
  }

  if (!isVisible && updateState === 'idle') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={checkForUpdates}
        className="text-xs"
      >
        <RefreshCw className="h-4 w-4 mr-1" />
        Check for Updates
      </Button>
    )
  }

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 w-96">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">App Updates</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Current Version */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current Version:</span>
            <Badge variant="outline">{currentVersion}</Badge>
          </div>

          {/* Update Status */}
          {updateState === 'checking' && (
            <Alert>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertTitle>Checking for Updates</AlertTitle>
              <AlertDescription>
                Please wait while we check for the latest version...
              </AlertDescription>
            </Alert>
          )}

          {updateState === 'available' && updateInfo && (
            <Alert>
              <Download className="h-4 w-4" />
              <AlertTitle>Update Available</AlertTitle>
              <AlertDescription>
                Version {updateInfo.version} is available.
                {updateInfo.releaseDate && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Released: {new Date(updateInfo.releaseDate).toLocaleDateString()}
                  </div>
                )}
              </AlertDescription>
              <div className="mt-3 flex gap-2">
                <Button onClick={downloadUpdate} size="sm">
                  <Download className="h-4 w-4 mr-1" />
                  Download Update
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsVisible(false)}
                >
                  Later
                </Button>
              </div>
            </Alert>
          )}

          {updateState === 'not-available' && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Up to Date</AlertTitle>
              <AlertDescription>
                You're running the latest version of vendai POS.
              </AlertDescription>
            </Alert>
          )}

          {updateState === 'downloading' && (
            <Alert>
              <Download className="h-4 w-4" />
              <AlertTitle>Downloading Update</AlertTitle>
              <AlertDescription>
                {downloadProgress && (
                  <div className="space-y-2 mt-2">
                    <Progress value={downloadProgress.percent} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{downloadProgress.percent}% complete</span>
                      <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                    </div>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {updateState === 'downloaded' && updateInfo && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Update Ready</AlertTitle>
              <AlertDescription>
                Version {updateInfo.version} has been downloaded and is ready to install.
                The app will restart to complete the installation.
              </AlertDescription>
              <div className="mt-3 flex gap-2">
                <Button onClick={installUpdate} size="sm">
                  Install & Restart
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsVisible(false)}
                >
                  Install Later
                </Button>
              </div>
            </Alert>
          )}

          {updateState === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Update Error</AlertTitle>
              <AlertDescription>
                {error || 'An error occurred while checking for updates.'}
              </AlertDescription>
              <div className="mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={checkForUpdates}
                >
                  Try Again
                </Button>
              </div>
            </Alert>
          )}

          {/* Release Notes */}
          {updateInfo?.releaseNotes && (updateState === 'available' || updateState === 'downloaded') && (
            <div className="border-t pt-3">
              <h4 className="font-medium text-sm mb-2">What's New:</h4>
              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                {updateInfo.releaseNotes.split('\n').map((line, index) => (
                  <p key={index} className="mb-1">{line}</p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default UpdateManager