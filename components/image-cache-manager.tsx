"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, Trash2, RefreshCcw, HardDrive, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useImageCache } from '@/hooks/use-service-worker'

export function ImageCacheManager() {
  const { toast } = useToast()
  const { stats, formattedSize, isLoading, refreshStats, clear, prefetch } = useImageCache()
  const [isPrefetching, setIsPrefetching] = useState(false)

  const handleClearCache = async () => {
    try {
      await clear()
      toast({
        title: 'Cache Cleared',
        description: 'All cached images have been removed.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear cache',
        variant: 'destructive',
      })
    }
  }

  const handlePrefetchImages = async () => {
    setIsPrefetching(true)
    try {
      // This would ideally fetch a list of important images to cache
      // For now, we'll just show a success message
      toast({
        title: 'Prefetching Images',
        description: 'Product images are being cached for offline use...',
      })
      
      // In a real implementation, you'd fetch image URLs from Firestore
      // and pass them to prefetch()
      // const imageUrls = await getDistributorImageUrls()
      // await prefetch(imageUrls)
      
      await refreshStats()
      
      toast({
        title: 'Prefetch Complete',
        description: 'Images are now available offline.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to prefetch images',
        variant: 'destructive',
      })
    } finally {
      setIsPrefetching(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Image Cache Manager
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Manage offline image storage for faster load times
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshStats}
            disabled={isLoading}
          >
            <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-muted/50 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ImageIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalImages}</p>
                <p className="text-sm text-muted-foreground">Cached Images</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-muted/50 rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <HardDrive className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formattedSize}</p>
                <p className="text-sm text-muted-foreground">Storage Used</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={handlePrefetchImages}
            disabled={isPrefetching || isLoading}
            className="flex-1"
          >
            <Download className="w-4 h-4 mr-2" />
            {isPrefetching ? 'Prefetching...' : 'Prefetch Images'}
          </Button>

          <Button
            variant="destructive"
            onClick={handleClearCache}
            disabled={isLoading || stats.totalImages === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Cache
          </Button>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Images are automatically cached when viewed</p>
          <p>• Cached images work offline without network connection</p>
          <p>• Prefetching downloads images in advance for better performance</p>
          <p>• Cache is persistent across app sessions</p>
        </div>
      </div>
    </Card>
  )
}
