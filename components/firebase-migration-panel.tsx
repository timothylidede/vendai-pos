"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, Clock, Database, Loader2, Play, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  checkMigrationStatus, 
  migrateOrganization, 
  testOptimizedStructure,
  type MigrationStatus 
} from '@/lib/firebase-migration-utils'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

export function FirebaseMigrationPanel() {
  const { userData } = useAuth()
  const { toast } = useToast()
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState<{ step: string; progress: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userData?.organizationName) {
      loadMigrationStatus()
    }
  }, [userData])

  const loadMigrationStatus = async () => {
    if (!userData?.organizationName) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const status = await checkMigrationStatus(userData.organizationName)
      setMigrationStatus(status)
    } catch (err) {
      console.error('Error loading migration status:', err)
      setError('Failed to load migration status')
      toast({
        title: 'Unable to load migration status',
        description: 'Please try refreshing the panel.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const startMigration = async () => {
    if (!userData?.organizationName || !migrationStatus) return
    
    setIsMigrating(true)
    setError(null)
    setMigrationProgress({ step: 'Starting migration...', progress: 0 })
    
    try {
      const orgData = {
        name: userData.organizationName,
        type: 'retailer' as const, // Default to retailer, could be made configurable
        contactInfo: {
          email: userData.email,
          // Add more contact info as needed
        },
        settings: {
          currency: 'KES', // Default currency
          timezone: 'Africa/Nairobi'
        }
      }
      
      const success = await migrateOrganization(
        userData.organizationName,
        orgData,
        (progress) => setMigrationProgress(progress)
      )
      
      if (success) {
        // Reload status to show completion
        await loadMigrationStatus()
        setMigrationProgress({ step: 'Migration completed successfully!', progress: 100 })
        toast({
          title: 'Migration complete',
          description: 'Your organization data has been moved to the optimized structure.',
        })
      } else {
        throw new Error('Migration failed')
      }
      
    } catch (err) {
      console.error('Migration error:', err)
      setError(err instanceof Error ? err.message : 'Migration failed')
      setMigrationProgress(null)
      toast({
        title: 'Migration failed',
        description: err instanceof Error ? err.message : 'Please try again or contact support.',
        variant: 'destructive',
      })
    } finally {
      setIsMigrating(false)
    }
  }

  const testStructure = async () => {
    if (!userData?.organizationName) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const success = await testOptimizedStructure(userData.organizationName)
      if (success) {
        toast({
          title: 'Structure test passed',
          description: 'Optimized hierarchy is working as expected.',
        })
      } else {
        throw new Error('Structure test failed')
      }
    } catch (err) {
      console.error('Structure test error:', err)
      setError('Structure test failed')
      toast({
        title: 'Structure test failed',
        description: err instanceof Error ? err.message : 'Please retry in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'in_progress':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>
      case 'not_started':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Not Started</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getStatusDescription = (status: MigrationStatus) => {
    switch (status.status) {
      case 'completed':
        return 'Your organization has been successfully migrated to the optimized Firebase architecture. You\'re getting better performance and reduced costs!'
      case 'in_progress':
        return 'Migration is currently in progress. Please wait for it to complete.'
      case 'error':
        return `Migration encountered an error: ${status.error || 'Unknown error'}`
      case 'not_started':
        return `Ready to migrate ${status.totalProducts} products and ${status.totalOrders} orders to the optimized structure.`
      default:
        return 'Unknown migration status'
    }
  }

  if (!userData?.organizationName) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Firebase Migration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please log in to view migration status.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Firebase Architecture Migration
        </CardTitle>
        <CardDescription>
          Migrate to optimized hierarchical structure for better performance and cost efficiency
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading migration status...</span>
          </div>
        )}

        {migrationStatus && (
          <div className="space-y-4">
            {/* Status Overview */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Migration Status</h3>
                <p className="text-sm text-muted-foreground">
                  Organization: {userData.organizationName}
                </p>
              </div>
              {getStatusBadge(migrationStatus.status)}
            </div>

            {/* Status Description */}
            <p className="text-sm text-muted-foreground">
              {getStatusDescription(migrationStatus)}
            </p>

            {/* Migration Progress */}
            {isMigrating && migrationProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{migrationProgress.step}</span>
                  <span>{migrationProgress.progress}%</span>
                </div>
                <Progress value={migrationProgress.progress} className="w-full" />
              </div>
            )}

            {/* Migration Stats */}
            {(migrationStatus.totalProducts > 0 || migrationStatus.totalOrders > 0) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-2xl font-bold">
                    {migrationStatus.migratedProducts}/{migrationStatus.totalProducts}
                  </div>
                  <div className="text-sm text-muted-foreground">Products Migrated</div>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-2xl font-bold">
                    {migrationStatus.migratedOrders}/{migrationStatus.totalOrders}
                  </div>
                  <div className="text-sm text-muted-foreground">Orders Migrated</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {migrationStatus.status === 'not_started' && (
                <Button 
                  onClick={startMigration}
                  disabled={isMigrating || isLoading}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isMigrating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Migration
                    </>
                  )}
                </Button>
              )}

              {migrationStatus.status === 'completed' && (
                <Button 
                  onClick={testStructure}
                  disabled={isLoading}
                  variant="outline"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Test Structure
                </Button>
              )}

              <Button 
                onClick={loadMigrationStatus}
                disabled={isLoading || isMigrating}
                variant="outline"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </Button>
            </div>
          </div>
        )}

        {/* Benefits Section */}
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Migration Benefits</h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• <strong>Faster queries:</strong> Hierarchical structure reduces read operations by up to 80%</li>
            <li>• <strong>Lower costs:</strong> Optimized data structure means fewer Firestore operations</li>
            <li>• <strong>Better performance:</strong> In-memory caching reduces response times</li>
            <li>• <strong>Improved scalability:</strong> Subcollections handle growth more efficiently</li>
            <li>• <strong>Enhanced security:</strong> Granular security rules at organization level</li>
          </ul>
        </div>

        {/* Technical Details */}
        <details className="border-t pt-4">
          <summary className="font-semibold cursor-pointer">Technical Details</summary>
          <div className="mt-2 text-sm text-muted-foreground space-y-2">
            <p><strong>Current Structure:</strong> Flat collections (pos_products, inventory, pos_orders)</p>
            <p><strong>New Structure:</strong> organizations/{`{orgId}`}/products, organizations/{`{orgId}`}/pos_orders</p>
            <p><strong>Data Changes:</strong> Products now include embedded stock and structured pricing</p>
            <p><strong>Backward Compatibility:</strong> Old structure remains functional during transition</p>
            <p><strong>Migration Safety:</strong> Data is copied, not moved. Original data remains intact</p>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}