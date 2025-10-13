"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  CreditCard,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  DollarSign,
  Filter,
  Download,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow, isPast, isFuture, differenceInDays } from "date-fns";

// Format currency
const formatCurrency = (value: number): string => {
  if (!Number.isFinite(value)) return "KES 0";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: value >= 100000 ? 0 : 2,
  }).format(value);
};

interface RepaymentSchedule {
  id: string;
  facilityId: string;
  disbursementId: string;
  installmentNumber: number;
  principalAmount: number;
  interestAmount: number;
  totalAmount: number;
  dueDate: Date;
  status: "pending" | "paid" | "overdue" | "partially_paid";
  paidAmount: number;
  paidAt?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  lateDays?: number;
  penaltyAmount?: number;
  createdAt: Date;
}

type FilterType = "all" | "upcoming" | "overdue" | "paid";

export default function RepaymentsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<RepaymentSchedule[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<RepaymentSchedule | null>(null);

  // Fetch repayment schedules
  useEffect(() => {
    async function fetchSchedules() {
      if (!user?.uid || !db) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const schedulesRef = collection(db, "organizations", user.uid, "repayment_schedules");
        const q = query(schedulesRef, orderBy("dueDate", "asc"));
        const snapshot = await getDocs(q);

        const scheduleData: RepaymentSchedule[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            facilityId: data.facilityId || "",
            disbursementId: data.disbursementId || "",
            installmentNumber: data.installmentNumber || 1,
            principalAmount: data.principalAmount || 0,
            interestAmount: data.interestAmount || 0,
            totalAmount: data.totalAmount || 0,
            dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : new Date(data.dueDate),
            status: data.status || "pending",
            paidAmount: data.paidAmount || 0,
            paidAt: data.paidAt instanceof Timestamp ? data.paidAt.toDate() : data.paidAt ? new Date(data.paidAt) : undefined,
            paymentMethod: data.paymentMethod,
            paymentReference: data.paymentReference,
            lateDays: data.lateDays,
            penaltyAmount: data.penaltyAmount || 0,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          };
        });

        setSchedules(scheduleData);
      } catch (error) {
        console.error("Error fetching repayment schedules:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSchedules();
  }, [user]);

  // Filter schedules
  const filteredSchedules = schedules.filter((schedule) => {
    if (filter === "all") return true;
    if (filter === "upcoming") return schedule.status === "pending" && isFuture(schedule.dueDate);
    if (filter === "overdue") return schedule.status === "overdue" || (schedule.status === "pending" && isPast(schedule.dueDate));
    if (filter === "paid") return schedule.status === "paid";
    return true;
  });

  // Calculate summary metrics
  const totalDue = schedules
    .filter((s) => s.status === "pending" || s.status === "overdue" || s.status === "partially_paid")
    .reduce((sum, s) => sum + (s.totalAmount - s.paidAmount), 0);

  const overdueDue = schedules
    .filter((s) => (s.status === "overdue" || (s.status === "pending" && isPast(s.dueDate))))
    .reduce((sum, s) => sum + (s.totalAmount - s.paidAmount), 0);

  const nextPayment = schedules.find(
    (s) => (s.status === "pending" || s.status === "partially_paid") && isFuture(s.dueDate)
  );

  const totalPaid = schedules
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.paidAmount, 0);

  // Get status badge
  const getStatusBadge = (schedule: RepaymentSchedule) => {
    if (schedule.status === "paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3" />
          Paid
        </span>
      );
    }
    if (schedule.status === "overdue" || (schedule.status === "pending" && isPast(schedule.dueDate))) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="h-3 w-3" />
          Overdue
        </span>
      );
    }
    if (schedule.status === "partially_paid") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3" />
          Partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        <Calendar className="h-3 w-3" />
        Upcoming
      </span>
    );
  };

  // Get days until/overdue
  const getDaysInfo = (dueDate: Date) => {
    const days = differenceInDays(dueDate, new Date());
    if (days < 0) {
      return {
        text: `${Math.abs(days)} days overdue`,
        color: "text-red-600",
      };
    }
    if (days === 0) {
      return {
        text: "Due today",
        color: "text-orange-600",
      };
    }
    if (days <= 7) {
      return {
        text: `Due in ${days} days`,
        color: "text-yellow-600",
      };
    }
    return {
      text: `Due in ${days} days`,
      color: "text-gray-600",
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading repayment schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Repayment Schedule</h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage your credit repayments and payment history
              </p>
            </div>
            <Link
              href="/retailer/credit/details"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Credit Details
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Due</p>
                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {formatCurrency(totalDue)}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="mt-2 text-3xl font-bold text-red-600">
                  {formatCurrency(overdueDue)}
                </p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Next Payment</p>
                {nextPayment ? (
                  <>
                    <p className="mt-2 text-xl font-bold text-gray-900">
                      {formatCurrency(nextPayment.totalAmount - nextPayment.paidAmount)}
                    </p>
                    <p className={`mt-1 text-xs font-medium ${getDaysInfo(nextPayment.dueDate).color}`}>
                      {getDaysInfo(nextPayment.dueDate).text}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-lg text-gray-400">No upcoming</p>
                )}
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Paid</p>
                <p className="mt-2 text-3xl font-bold text-green-600">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              <div className="flex gap-2">
                {(["all", "upcoming", "overdue", "paid"] as FilterType[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      filter === f
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Repayment Schedule Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {filteredSchedules.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Repayments Found</h3>
              <p className="text-sm text-gray-500">
                {filter === "all"
                  ? "You don't have any repayment schedules yet."
                  : `No ${filter} repayments found.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Installment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Principal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interest
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSchedules.map((schedule) => (
                    <tr
                      key={schedule.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        schedule.status === "overdue" || (schedule.status === "pending" && isPast(schedule.dueDate))
                          ? "bg-red-50/30"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {format(schedule.dueDate, "MMM dd, yyyy")}
                          </div>
                          <div className={`text-xs ${getDaysInfo(schedule.dueDate).color}`}>
                            {getDaysInfo(schedule.dueDate).text}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">#{schedule.installmentNumber}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(schedule.principalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(schedule.interestAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {formatCurrency(schedule.totalAmount)}
                          </div>
                          {schedule.paidAmount > 0 && schedule.status !== "paid" && (
                            <div className="text-xs text-gray-500">
                              Paid: {formatCurrency(schedule.paidAmount)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(schedule)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {schedule.status === "paid" ? (
                          <span className="text-gray-400">Completed</span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSchedule(schedule);
                              setShowPaymentModal(true);
                            }}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            Make Payment
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment History Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Payment History</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {schedules.filter((s) => s.status === "paid").length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Payment History</h3>
                <p className="text-sm text-gray-500">Your completed payments will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {schedules
                  .filter((s) => s.status === "paid")
                  .slice(0, 5)
                  .map((schedule) => (
                    <div key={schedule.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="bg-green-100 rounded-full p-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Installment #{schedule.installmentNumber} - {formatCurrency(schedule.totalAmount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Paid on {schedule.paidAt ? format(schedule.paidAt, "MMM dd, yyyy") : "N/A"}
                            {schedule.paymentMethod && ` • ${schedule.paymentMethod}`}
                            {schedule.paymentReference && ` • Ref: ${schedule.paymentReference}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-green-600">
                          {formatCurrency(schedule.paidAmount)}
                        </div>
                        {schedule.lateDays && schedule.lateDays > 0 && (
                          <div className="text-xs text-red-600">
                            Late by {schedule.lateDays} days
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal Placeholder */}
      {showPaymentModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setShowPaymentModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Make Payment</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Amount Due</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(selectedSchedule.totalAmount - selectedSchedule.paidAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p className="text-sm font-medium text-gray-900">
                    {format(selectedSchedule.dueDate, "MMMM dd, yyyy")}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    M-Pesa STK push integration coming soon. Please contact support to process your payment.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-500 rounded-md text-sm font-medium cursor-not-allowed"
                  >
                    Pay with M-Pesa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
