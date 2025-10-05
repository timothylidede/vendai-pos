"use client"

import { type ReactNode } from "react"
import { RefreshCw, Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type DashboardSearchAccent = "cyan" | "orange" | "purple"

export interface DashboardFilterOption {
  value: string
  label: string
}

export interface DashboardFilterConfig {
  id: string
  value: string
  placeholder?: string
  options: DashboardFilterOption[]
  onValueChange: (value: string) => void
  triggerClassName?: string
  contentClassName?: string
}

interface DashboardSearchControlsProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  accent?: DashboardSearchAccent
  onRefresh?: () => void
  refreshLabel?: string
  isRefreshing?: boolean
  filters?: DashboardFilterConfig[]
  actions?: ReactNode
  className?: string
}

const ACCENT_STYLES: Record<DashboardSearchAccent, { inputFocus: string; refreshFocus: string }> = {
  cyan: {
    inputFocus: "focus-visible:ring-cyan-400/30 focus-visible:border-cyan-400/60",
    refreshFocus: "hover:border-cyan-400/40",
  },
  orange: {
    inputFocus: "focus-visible:ring-orange-400/30 focus-visible:border-orange-400/60",
    refreshFocus: "hover:border-orange-400/40",
  },
  purple: {
    inputFocus: "focus-visible:ring-purple-400/30 focus-visible:border-purple-400/60",
    refreshFocus: "hover:border-purple-400/40",
  },
}

export function DashboardSearchControls({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  accent = "cyan",
  onRefresh,
  refreshLabel = "Refresh",
  isRefreshing = false,
  filters,
  actions,
  className,
}: DashboardSearchControlsProps) {
  const accentStyles = ACCENT_STYLES[accent]

  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className={cn(
              "h-11 rounded-lg border border-slate-700/60 bg-slate-900/50 pl-10 pr-4 text-base text-slate-100 placeholder:text-slate-400",
              "focus-visible:ring-[3px]",
              accentStyles.inputFocus,
            )}
          />
        </div>
        {onRefresh && (
          <Button
            type="button"
            onClick={onRefresh}
            variant="secondary"
            disabled={isRefreshing}
            className={cn(
              "h-11 rounded-lg border border-slate-700/60 bg-slate-900/40 px-4 text-slate-200 transition hover:text-white",
              accentStyles.refreshFocus,
            )}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
            {refreshLabel}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {filters?.map((filter) => (
          <Select key={filter.id} value={filter.value} onValueChange={filter.onValueChange}>
            <SelectTrigger
              className={cn(
                "h-11 w-[160px] rounded-lg border border-slate-700/60 bg-slate-900/40 text-slate-200",
                filter.triggerClassName,
              )}
            >
              <SelectValue placeholder={filter.placeholder} />
            </SelectTrigger>
            <SelectContent
              className={cn(
                "border border-slate-800 bg-slate-950/95 text-slate-200",
                filter.contentClassName,
              )}
            >
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {actions}
      </div>
    </div>
  )
}
