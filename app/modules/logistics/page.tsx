'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import Link from 'next/link'
import {
  Truck,
  Package,
  MapPin,
  Clock,
  Users,
  ArrowLeft,
  Plus,
  Filter,
  Navigation,
  Route,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Phone,
  BadgeCheck,
  ShieldCheck,
} from 'lucide-react'
import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/loading-spinner'
import { useToast } from '@/hooks/use-toast'
import { db } from '@/lib/firebase'
import { DashboardSearchControls } from '@/components/modules/dashboard-search-controls'

type LogisticsTab = 'deliveries' | 'routes' | 'drivers'

interface DeliveryRecord {
  id: string
  customer: string
  location: string
  itemCount: number
  totalValue: number
  status: string
  driver: string
  etaLabel: string
  coordinates?: { lat: number; lng: number }
}

interface RouteRecord {
  id: string
  name: string
  status: string
  driver: string
  vehicle: string
  stopsCount: number
  nextStop?: string
  etaLabel?: string
  lastUpdatedLabel?: string
}

interface DriverRecord {
  id: string
  name: string
  phone?: string
  status: string
  activeDeliveries: number
  completedDeliveries: number
  currentRoute?: string
}

const LOGISTICS_TABS: Array<{ key: LogisticsTab; label: string; icon: typeof Truck }> = [
  { key: 'deliveries', label: 'Active Deliveries', icon: Truck },
  { key: 'routes', label: 'Route Planning', icon: Route },
  { key: 'drivers', label: 'Driver Management', icon: Users },
]

const DELIVERY_STATUS_STYLES: Record<string, string> = {
  delivered: 'text-green-400 bg-green-400/10 border-green-400/20',
  'in-transit': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  enroute: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  enroute_to_customer: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  queued: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  delayed: 'text-red-400 bg-red-400/10 border-red-400/20',
  issue: 'text-red-400 bg-red-400/10 border-red-400/20',
  failed: 'text-red-400 bg-red-400/10 border-red-400/20',
  cancelled: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

const ROUTE_STATUS_STYLES: Record<string, string> = {
  active: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  planned: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  completed: 'text-green-400 bg-green-500/10 border-green-500/20',
  delayed: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const DRIVER_STATUS_STYLES: Record<string, string> = {
  available: 'text-green-400',
  'on-route': 'text-orange-400',
  'off-duty': 'text-slate-400',
  suspended: 'text-red-400',
}

const pickNestedString = (source: unknown, key: string): string | undefined => {
  if (!source || typeof source !== 'object') return undefined
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : undefined
}

const parseCoordinates = (value: unknown): { lat: number; lng: number } | undefined => {
  if (!value) return undefined

  if (Array.isArray(value) && value.length === 2) {
    const [maybeLat, maybeLng] = value
    const lat = Number(maybeLat)
    const lng = Number(maybeLng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
  }

  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => Number(part.trim()))
    if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
      return { lat: parts[0], lng: parts[1] }
    }
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const lat = Number(source.lat ?? source.latitude ?? source._lat)
    const lng = Number(source.lng ?? source.longitude ?? source._long)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
  }

  return undefined
}

const toDateSafe = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return new Date(value)
  }
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    try {
      return (value as { toDate: () => Date }).toDate()
    } catch (error) {
      console.warn('Failed to convert Firestore timestamp', error)
    }
  }
  return null
}

const formatRelativeDate = (value?: Date | null): string | undefined => {
  if (!value) return undefined
  const now = new Date().getTime()
  const diff = value.getTime() - now
  const absDiff = Math.abs(diff)
  const hours = Math.round(absDiff / (1000 * 60 * 60))
  if (hours < 1) {
    const minutes = Math.round(absDiff / (1000 * 60))
    if (minutes <= 1) return diff >= 0 ? 'due now' : 'just completed'
    return diff >= 0 ? `in ${minutes} min` : `${minutes} min ago`
  }
  if (hours < 24) {
    return diff >= 0 ? `in ${hours} hr` : `${hours} hr ago`
  }
  const days = Math.round(hours / 24)
  return diff >= 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'} ago`
}

const formatDateTime = (value?: Date | null): string | undefined => {
  if (!value) return undefined
  return value.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeStatus = (value: string | undefined | null): string => {
  if (!value) return 'pending'
  return value.toString().trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-')
}

const LogisticsMap = ({ deliveries, isLoading }: { deliveries: DeliveryRecord[]; isLoading: boolean }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapLoading, setMapLoading] = useState(false)

  useEffect(() => {
    const mapContainer = containerRef.current
    if (!mapContainer) return

    if (isLoading) {
      setMapLoading(true)
      setMapError(null)
      return
    }

    if (!deliveries.length) {
      setMapLoading(false)
      setMapError('No deliveries matching your current filters yet.')
      return
    }

    const coordinates = deliveries
      .map((delivery) => delivery.coordinates)
      .filter((value): value is { lat: number; lng: number } => Boolean(value))

    if (!coordinates.length) {
      setMapLoading(false)
      setMapError('We could not find GPS coordinates for these drops yet.')
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      setMapLoading(false)
      setMapError('Google Maps API key missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable routing.')
      return
    }

    setMapLoading(true)
    setMapError(null)
    const loader = new Loader({ apiKey, version: 'weekly' })
    let cancelled = false

    loader
      .load()
      .then((google) => {
        if (cancelled || !containerRef.current) return

        const initialCenter = coordinates[0]
        const map = new google.maps.Map(containerRef.current, {
          zoom: 11,
          center: initialCenter,
          disableDefaultUI: true,
          gestureHandling: 'cooperative',
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1e3a8a' }] },
          ],
        })

        const bounds = new google.maps.LatLngBounds()
        coordinates.forEach((coordinate, index) => {
          bounds.extend(coordinate)
          new google.maps.Marker({
            position: coordinate,
            map,
            label: String(index + 1),
          })
        })

        if (coordinates.length > 1) {
          map.fitBounds(bounds, 48)
        }

        setMapLoading(false)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to initialise Google Maps', error)
        setMapLoading(false)
        setMapError('Unable to load maps right now. Please retry shortly.')
      })

    return () => {
      cancelled = true
    }
  }, [deliveries, isLoading])

  return (
    <div className="relative h-64 rounded-lg overflow-hidden border border-slate-700/40 bg-slate-900/40">
      <div ref={containerRef} className="absolute inset-0" />
      {mapLoading && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
          <LoadingSpinner size="sm" />
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300 bg-slate-900/80 px-6 text-center">
          {mapError}
        </div>
      )}
    </div>
  )
}

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState<LogisticsTab>('deliveries')
  const [searchTerm, setSearchTerm] = useState('')
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([])
  const [routes, setRoutes] = useState<RouteRecord[]>([])
  const [drivers, setDrivers] = useState<DriverRecord[]>([])
  const [deliveriesLoading, setDeliveriesLoading] = useState(true)
  const [routesLoading, setRoutesLoading] = useState(true)
  const [driversLoading, setDriversLoading] = useState(true)

  const [deliveriesError, setDeliveriesError] = useState<string | null>(null)
  const [routesError, setRoutesError] = useState<string | null>(null)
  const [driversError, setDriversError] = useState<string | null>(null)

  const { toast } = useToast()

  const loadDeliveries = useCallback(async () => {
    setDeliveriesLoading(true)
    setDeliveriesError(null)
    try {
      const deliveriesQuery = query(
        collection(db, 'sales_orders'),
        orderBy('createdAt', 'desc'),
        limit(50),
      )
      const snapshot = await getDocs(deliveriesQuery)
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const items = Array.isArray(data.items) ? data.items : []
        const itemCountFromArray = items.reduce((sum, item) => {
          if (!item || typeof item !== 'object') return sum
          const quantity = Number((item as Record<string, unknown>).quantity ?? 0)
          return Number.isFinite(quantity) ? sum + quantity : sum
        }, 0)

        const rawEta = data.eta ?? data.estimatedDelivery ?? data.expectedDeliveryDate ?? data.deliveryEta
        const etaDate = toDateSafe(rawEta)

        const totalValue = Number(
          data.totalValue ?? data.orderTotal ?? data.totalAmount ?? data.amount ?? 0,
        )

        const coordinateCandidates: unknown[] = [
          data.destinationCoordinates,
          data.coordinates,
          data.locationCoordinates,
          data.dropoffCoordinates,
          data.geo,
          data.deliveryCoordinate,
        ]

        const destinationObj = data.destination as unknown
        if (destinationObj && typeof destinationObj === 'object') {
          coordinateCandidates.push((destinationObj as Record<string, unknown>).coordinates)
        }

        const locationObj = data.location as unknown
        if (locationObj && typeof locationObj === 'object') {
          coordinateCandidates.push((locationObj as Record<string, unknown>).coordinates)
        }

        let coordinates: { lat: number; lng: number } | undefined
        for (const candidate of coordinateCandidates) {
          const parsed = parseCoordinates(candidate)
          if (parsed) {
            coordinates = parsed
            break
          }
        }

        const driverName =
          (typeof data.driverName === 'string' && data.driverName) ||
          (typeof data.assignedDriverName === 'string' && data.assignedDriverName) ||
          pickNestedString(data.driver, 'name') ||
          'Unassigned'

        return {
          id: docSnap.id,
          customer:
            (data.customerName as string) ||
            (data.retailerName as string) ||
            (data.destinationName as string) ||
            (data.receiverName as string) ||
            'Unnamed Outlet',
          location:
            (data.destination as string) ||
            (data.deliveryAddress as string) ||
            (data.routeStop as string) ||
            'Unknown location',
          itemCount:
            Number(data.itemCount) && Number.isFinite(Number(data.itemCount))
              ? Number(data.itemCount)
              : itemCountFromArray,
          totalValue: Number.isFinite(totalValue) ? totalValue : 0,
          status: normalizeStatus(data.status as string),
          driver: driverName,
          etaLabel: formatRelativeDate(etaDate) ?? 'No ETA',
          coordinates,
        }
      })
      setDeliveries(mapped)
    } catch (error) {
      console.error('Failed to load deliveries', error)
      setDeliveriesError('We could not load active deliveries from Firestore.')
      setDeliveries([])
      toast({
        title: 'Failed to load deliveries',
        description: 'Please refresh again in a few moments.',
        variant: 'destructive',
      })
    } finally {
      setDeliveriesLoading(false)
    }
  }, [toast])

  const loadRoutes = useCallback(async () => {
    setRoutesLoading(true)
    setRoutesError(null)
    try {
      const routesQuery = query(collection(db, 'routes'), orderBy('updatedAt', 'desc'), limit(25))
      const snapshot = await getDocs(routesQuery)
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        const stops = Array.isArray(data.stops) ? data.stops : []
        const nextStopCandidate = stops.find((stop) => {
          if (!stop || typeof stop !== 'object') return false
          return !(stop as Record<string, unknown>).completed
        }) as Record<string, unknown> | undefined

        const etaDate = toDateSafe(data.eta ?? data.nextEta ?? nextStopCandidate?.eta)
        const lastUpdated = toDateSafe(data.updatedAt ?? data.lastUpdated ?? data.createdAt)

        const driverName =
          (typeof data.driverName === 'string' && data.driverName) ||
          (typeof data.assignedDriverName === 'string' && data.assignedDriverName) ||
          pickNestedString(data.driver, 'name') ||
          'Unassigned'

        return {
          id: docSnap.id,
          name: (data.name as string) || `Route ${docSnap.id.slice(-6)}`,
          status: normalizeStatus(data.status as string),
          driver: driverName,
          vehicle: (data.vehicleLabel as string) || (data.vehicle as string) || 'Pending assignment',
          stopsCount: stops.length,
          nextStop: (nextStopCandidate?.name as string) || (nextStopCandidate?.location as string),
          etaLabel: formatRelativeDate(etaDate),
          lastUpdatedLabel: formatDateTime(lastUpdated),
        }
      })
      setRoutes(mapped)
    } catch (error) {
      console.error('Failed to load routes', error)
      setRoutesError('Unable to fetch delivery routes right now.')
      setRoutes([])
      toast({
        title: 'Failed to load routes',
        description: 'Please try refreshing the routes list.',
        variant: 'destructive',
      })
    } finally {
      setRoutesLoading(false)
    }
  }, [toast])

  const loadDrivers = useCallback(async () => {
    setDriversLoading(true)
    setDriversError(null)
    try {
      const driversQuery = query(collection(db, 'drivers'), orderBy('lastActive', 'desc'), limit(50))
      const snapshot = await getDocs(driversQuery)
      const mapped = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>
        return {
          id: docSnap.id,
          name: (data.name as string) || (data.fullName as string) || 'Driver',
          phone: (data.phone as string) || (data.phoneNumber as string) || undefined,
          status: normalizeStatus((data.status as string) || (data.availability as string) || 'available'),
          activeDeliveries: Number(data.activeDeliveries ?? data.currentAssignments ?? 0) || 0,
          completedDeliveries: Number(data.completedDeliveries ?? data.completedTrips ?? 0) || 0,
          currentRoute: (data.currentRouteName as string) || (data.currentRoute as string) || undefined,
        }
      })
      setDrivers(mapped)
    } catch (error) {
      console.error('Failed to load drivers', error)
      setDriversError('Unable to fetch driver records right now.')
      setDrivers([])
      toast({
        title: 'Failed to load drivers',
        description: 'Please try refreshing the driver list.',
        variant: 'destructive',
      })
    } finally {
      setDriversLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadDeliveries()
    loadRoutes()
    loadDrivers()
  }, [loadDeliveries, loadRoutes, loadDrivers])

  const filteredDeliveries = useMemo(() => {
    if (!searchTerm.trim()) return deliveries
    const lower = searchTerm.toLowerCase()
    return deliveries.filter((delivery) =>
      [delivery.customer, delivery.location, delivery.driver, delivery.status]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(lower)),
    )
  }, [deliveries, searchTerm])

  const deliveryStats = useMemo(() => {
    const active = deliveries.filter((delivery) => {
      const status = delivery.status
      return !['delivered', 'completed', 'cancelled', 'failed'].includes(status)
    }).length

    const completed = deliveries.filter((delivery) => delivery.status === 'delivered').length
    const pending = deliveries.filter((delivery) => ['pending', 'queued'].includes(delivery.status)).length
    const issues = deliveries.filter((delivery) => ['delayed', 'issue', 'failed'].includes(delivery.status)).length

    return {
      active,
      completed,
      pending,
      issues,
    }
  }, [deliveries])

  return (
    <div className="module-background flex min-h-[calc(100vh-2.5rem)] flex-col overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/modules">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Modules
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center">
                <Truck className="w-8 h-8 mr-3 text-orange-400" />
                Logistics Management
              </h1>
              <p className="text-slate-400">Manage deliveries, routes, and drivers</p>
            </div>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700">
            <Plus className="w-4 h-4 mr-2" />
            Schedule Delivery
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="p-6">
        <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg w-fit">
          {LOGISTICS_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                activeTab === key
                  ? 'bg-orange-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 pb-8">
        {activeTab === 'deliveries' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'Active Deliveries', value: deliveryStats.active, icon: Truck, color: 'text-orange-400' },
                { label: 'Completed', value: deliveryStats.completed, icon: CheckCircle, color: 'text-green-400' },
                { label: 'Pending Dispatch', value: deliveryStats.pending, icon: Clock, color: 'text-yellow-400' },
                { label: 'Issues / Delays', value: deliveryStats.issues, icon: AlertTriangle, color: 'text-red-400' }
              ].map((stat) => (
                <Card key={stat.label} className="p-6 bg-slate-800/60 border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">{stat.label}</p>
                      <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    </div>
                    <stat.icon className={`w-8 h-8 ${stat.color}`} />
                  </div>
                </Card>
              ))}
            </div>

            <DashboardSearchControls
              accent="orange"
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search by retailer, driver, or status..."
              onRefresh={loadDeliveries}
              actions={(
                <Button variant="outline" className="h-11 border-slate-700/70 text-slate-300">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              )}
            />

            {!deliveriesError && (
              <Card className="p-0 bg-slate-900/40 border-slate-700/50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Route &amp; ETA visualisation</h3>
                    <p className="text-xs text-slate-400">Powered by Google Maps</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={loadDeliveries}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync
                  </Button>
                </div>
                <div className="p-4">
                  <LogisticsMap deliveries={filteredDeliveries} isLoading={deliveriesLoading} />
                </div>
              </Card>
            )}

            {deliveriesError && (
              <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200" role="alert">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{deliveriesError}</span>
                  <Button size="sm" variant="secondary" className="bg-red-500/20 border border-red-400/40 text-red-100 hover:text-white" onClick={loadDeliveries}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </Card>
            )}

            {deliveriesLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner showMessage message="Loading deliveries" />
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <Card className="p-10 text-center bg-slate-800/60 border-slate-700/50">
                <Truck className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-1">No deliveries to show</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  We didn’t find any deliveries matching your filters. Once orders are dispatched they’ll appear here in real time.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredDeliveries.map((delivery) => (
                  <Card key={delivery.id} className="p-6 bg-slate-800/60 border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                          <Package className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{delivery.customer}</h3>
                          <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-slate-400">
                            <span className="flex items-center">
                              <MapPin className="w-3 h-3 mr-2" />
                              {delivery.location}
                            </span>
                            <span>{delivery.itemCount} items</span>
                            <span>KSh {delivery.totalValue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-slate-300 text-sm font-medium">{delivery.driver}</p>
                          <p className="text-slate-400 text-xs">{delivery.etaLabel}</p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            DELIVERY_STATUS_STYLES[delivery.status] ?? 'text-slate-300 border-slate-600 bg-slate-700/40'
                          }`}
                        >
                          {delivery.status.replace(/[-_]/g, ' ').toUpperCase()}
                        </span>
                        <Button size="sm" variant="outline" className="border-slate-700 text-slate-300">
                          <Navigation className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Route Planning</h3>
                <p className="text-slate-400">Optimise daily drops and monitor progress across every route</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="border-slate-700 text-slate-300">
                  <Plus className="w-4 h-4 mr-2" />
                  Plan New Route
                </Button>
                <Button onClick={loadRoutes} variant="secondary" className="bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:text-white">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {routesError && (
              <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200" role="alert">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{routesError}</span>
                  <Button size="sm" variant="secondary" className="bg-red-500/20 border border-red-400/40 text-red-100 hover:text-white" onClick={loadRoutes}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </Card>
            )}

            {routesLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner showMessage message="Loading routes" />
              </div>
            ) : routes.length === 0 ? (
              <Card className="p-10 text-center bg-slate-800/60 border-slate-700/50">
                <Route className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-1">No active routes</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  Create a delivery route to start tracking driver progress, stop ETAs, and proof-of-delivery updates.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {routes.map((routeRecord) => (
                  <Card key={routeRecord.id} className="p-6 bg-slate-800/60 border-slate-700/50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Route className="w-4 h-4 text-orange-400" />
                          <h4 className="text-lg font-semibold text-white">{routeRecord.name}</h4>
                        </div>
                        <div className="text-sm text-slate-300 space-y-1">
                          <p className="flex items-center gap-2">
                            <Truck className="w-3 h-3 text-slate-400" />
                            <span>{routeRecord.driver}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{routeRecord.nextStop ?? 'Awaiting dispatch'}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{routeRecord.etaLabel ?? 'ETA pending'}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <BadgeCheck className="w-3 h-3 text-slate-400" />
                            <span>{routeRecord.stopsCount} stops scheduled</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <ShieldCheck className="w-3 h-3 text-slate-400" />
                            <span>{routeRecord.vehicle}</span>
                          </p>
                          {routeRecord.lastUpdatedLabel && (
                            <p className="text-xs text-slate-500">Updated {routeRecord.lastUpdatedLabel}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${
                          ROUTE_STATUS_STYLES[routeRecord.status] ?? 'text-slate-300 border-slate-600 bg-slate-700/40'
                        }`}
                      >
                        {routeRecord.status.replace(/[-_]/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Driver Management</h3>
                <p className="text-slate-400">Track availability, assignments, and performance metrics</p>
              </div>
              <div className="flex items-center gap-3">
                <Button className="bg-orange-600 hover:bg-orange-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Driver
                </Button>
                <Button onClick={loadDrivers} variant="secondary" className="bg-slate-800/60 border border-slate-700/60 text-slate-200 hover:text-white">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            {driversError && (
              <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200" role="alert">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{driversError}</span>
                  <Button size="sm" variant="secondary" className="bg-red-500/20 border border-red-400/40 text-red-100 hover:text-white" onClick={loadDrivers}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </Card>
            )}

            {driversLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner showMessage message="Loading drivers" />
              </div>
            ) : drivers.length === 0 ? (
              <Card className="p-10 text-center bg-slate-800/60 border-slate-700/50">
                <Users className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-1">No drivers on record</h3>
                <p className="text-slate-400 max-w-md mx-auto">
                  Add your delivery team to assign drops, track proof-of-delivery, and monitor utilization.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {drivers.map((driver) => (
                  <Card key={driver.id} className="p-6 bg-slate-800/60 border-slate-700/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h4 className="text-lg font-semibold text-white">{driver.name}</h4>
                        {driver.phone && (
                          <p className="flex items-center gap-2 text-sm text-slate-300">
                            <Phone className="w-3 h-3" /> {driver.phone}
                          </p>
                        )}
                        {driver.currentRoute && (
                          <p className="text-sm text-slate-400">Current route: {driver.currentRoute}</p>
                        )}
                        <div className="flex gap-4 text-sm text-slate-300">
                          <span>{driver.activeDeliveries} active</span>
                          <span>{driver.completedDeliveries} completed</span>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${DRIVER_STATUS_STYLES[driver.status] ?? 'text-slate-300'}`}>
                        {driver.status.replace(/[-_]/g, ' ').toUpperCase()}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}