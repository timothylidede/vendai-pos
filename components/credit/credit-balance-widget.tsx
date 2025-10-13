"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getCreditFacility, getCreditAlerts, type CreditFacility as CreditFacilityType, type CreditAlert as CreditAlertType } from "@/lib/credit-operations";
import { 
  CreditCard, 
  AlertTriangle, 
  CheckCircle,
  Info,
  TrendingUp,
  Clock
} from "lucide-react";
import Link from "next/link";

const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return "KES 0"
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(value)
};

// Use types from credit-operations
type CreditFacility = CreditFacilityType;
type CreditAlert = CreditAlertType;

export function CreditBalanceWidget() {
  const { user } = useAuth();
  const [facility, setFacility] = useState<CreditFacility | null>(null);
  const [alerts, setAlerts] = useState<CreditAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCreditFacility() {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch credit facility (using uid as organizationId for now)
        const creditFacility = await getCreditFacility(
          user.uid,
          user.uid
        );

        if (!creditFacility) {
          setError("No active credit facility found");
          setFacility(null);
          setAlerts([]);
          return;
        }

        setFacility(creditFacility);

        // Generate alerts
        const creditAlerts = getCreditAlerts(creditFacility);
        setAlerts(creditAlerts);
      } catch (err) {
        console.error("Error loading credit facility:", err);
        setError(err instanceof Error ? err.message : "Failed to load credit facility");
        setFacility(null);
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    }

    loadCreditFacility();
  }, [user]);

  // Calculate utilization percentage
  const calculateUtilization = (facility: CreditFacility): number => {
    return facility.creditUtilization * 100;
  };

  // Get utilization color class
  const getUtilizationColor = (utilization: number): string => {
    if (utilization >= 85) return "bg-red-500";
    if (utilization >= 70) return "bg-yellow-500";
    return "bg-green-500";
  };

  // Get alert icon
  const getAlertIcon = (level: CreditAlert["level"]): React.ReactNode => {
    switch (level) {
      case "danger":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "info":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  // Get alert background color
  const getAlertBgColor = (level: CreditAlert["level"]): string => {
    switch (level) {
      case "danger":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-yellow-50 border-yellow-200";
      case "info":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Credit Not Available
            </h3>
            <p className="text-sm text-gray-600 mb-3">{error}</p>
            <Link
              href="/retailer/credit/apply"
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Apply for Credit
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No facility state
  if (!facility) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-center py-6">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            No Active Credit Facility
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Apply for credit to access flexible payment terms for supplier orders.
          </p>
          <Link
            href="/retailer/credit/apply"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Apply for Credit
          </Link>
        </div>
      </div>
    );
  }

  const utilization = calculateUtilization(facility);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <CreditCard className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Credit Facility</h3>
        </div>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            facility.status === "active"
              ? "bg-green-100 text-green-800"
              : facility.status === "suspended"
              ? "bg-yellow-100 text-yellow-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {facility.status.toUpperCase()}
        </span>
      </div>

      {/* Credit Limit and Available Balance */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Credit Limit
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(facility.approvedAmount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
            Available Credit
          </p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(facility.availableCredit)}
          </p>
        </div>
      </div>

      {/* Outstanding Balance */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
          Outstanding Balance
        </p>
        <p className="text-xl font-semibold text-red-600">
          {formatCurrency(facility.outstandingBalance)}
        </p>
      </div>

      {/* Utilization Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">
            Credit Utilization
          </p>
          <p className="text-xs font-semibold text-gray-700">
            {utilization.toFixed(1)}%
          </p>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getUtilizationColor(
              utilization
            )}`}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-start space-x-2 p-3 rounded-md border ${getAlertBgColor(
                alert.level
              )}`}
            >
              <div className="flex-shrink-0 mt-0.5">{getAlertIcon(alert.level)}</div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900">{alert.title}</h4>
                <p className="text-xs text-gray-600">{alert.message}</p>
                {alert.actionUrl && alert.action && (
                  <Link
                    href={alert.actionUrl}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-1 inline-block"
                  >
                    {alert.action} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Facility Details */}
      <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Interest Rate</p>
            <p className="text-sm font-semibold text-gray-900">
              {facility.interestRate}% p.a.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 text-gray-400" />
          <div>
            <p className="text-xs text-gray-500">Repayment Period</p>
            <p className="text-sm font-semibold text-gray-900">
              {facility.tenorDays} days
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/retailer/credit/details"
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          View Details
        </Link>
        <Link
          href="/retailer/credit/repayments"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Make Payment
        </Link>
      </div>

      {/* Last Update Timestamp */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Last updated: {facility.updatedAt.toDate().toLocaleString()}
        </p>
      </div>
    </div>
  );
}
