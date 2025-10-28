'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Store, 
  Truck, 
  User, 
  Users,
  ChevronRight,
  Building2,
  Mail,
  MapPin,
  Clock,
  Package,
  DollarSign,
  Bell,
  FileText,
  CreditCard,
  CheckCircle2,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import localFont from 'next/font/local';

const neueHaas = localFont({
  src: [
    {
      path: '../../../public/fonts/Neue Haas Grotesk Display Pro 55 Roman.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../public/fonts/Neue Haas Grotesk Display Pro 65 Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../../public/fonts/Neue Haas Grotesk Display Pro 75 Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-neue-haas'
});

type SettingsTab = 'shop' | 'shipping' | 'account' | 'team';

export default function DistributorSettings() {
  const router = useRouter();
  const { userData } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('shop');
  const [isExpanded, setIsExpanded] = useState(true);

  // Shop Settings State
  const [companyName, setCompanyName] = useState(userData?.organizationDisplayName || userData?.organizationName || '');
  const [fulfillmentEmail, setFulfillmentEmail] = useState((userData as any)?.fulfillmentEmail || '');
  const [primaryCategory, setPrimaryCategory] = useState((userData as any)?.primaryCategory || '');
  const [leadTimeAuto, setLeadTimeAuto] = useState(true);
  const [scheduledOrders, setScheduledOrders] = useState(true);
  const [sellOnlineOnly, setSellOnlineOnly] = useState(true);
  const [sellSocialSellers, setSellSocialSellers] = useState(true);
  const [sellPreorders, setSellPreorders] = useState(true);
  const [firstOrderMin, setFirstOrderMin] = useState('');
  const [reorderMin, setReorderMin] = useState('');
  
  // Shipping Settings State
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false);
  const [insureShipments, setInsureShipments] = useState(false);
  const [handlingFee, setHandlingFee] = useState(false);

  // Account Settings State
  const [orderReminders, setOrderReminders] = useState('individual');
  const [exclusivityUpdates, setExclusivityUpdates] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const [productSort, setProductSort] = useState('name');
  const [orderAcceptance, setOrderAcceptance] = useState('manual');
  const [includeProductImages, setIncludeProductImages] = useState(false);
  const [includeQRCode, setIncludeQRCode] = useState(true);

  const categories = [
    'General Trade', 'Food & Beverage', 'Electrical', 'Construction', 
    'FMCG', 'Cosmetics', 'Furniture', 'Electronics', 'Chemical',
    'Packaging', 'Textile', 'Agricultural', 'Pharmaceutical', 
    'Stationery', 'Automotive', 'Plumbing', 'Industrial', 'Cleaning', 'Alcohol'
  ];

  const renderShopSettings = () => (
    <div className="space-y-6">
      {/* Shop Information */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Shop information</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm text-slate-300">Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">
              Fulfillment email <span className="text-slate-500">ⓘ</span>
            </label>
            <input
              type="email"
              value={fulfillmentEmail}
              onChange={(e) => setFulfillmentEmail(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-300">Primary category</label>
            <select
              value={primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
            >
              <option value="">Select category</option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Shop Lead Time */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Shop lead time</h3>
        <p className="mb-4 text-sm text-slate-400">
          Tell customers how long it takes you to prepare an order before shipping. We recommend keeping your lead time accurate and up-to-date to drive reorders and ensure customer satisfaction.
        </p>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked={leadTimeAuto}
              onChange={() => setLeadTimeAuto(true)}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-200">
                Automatically adjusted <span className="text-slate-500">ⓘ</span>
              </div>
              <div className="text-xs text-slate-400">
                Your lead time will be determined by your shipment activity over the past 90 days to ensure accuracy and prevent late shipments.
              </div>
            </div>
          </label>
          
          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked={!leadTimeAuto}
              onChange={() => setLeadTimeAuto(false)}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-200">Manually set</div>
              <div className="text-xs text-slate-400">
                This is a fixed lead time that you can adjust at anytime.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Fulfillment Options */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Fulfillment options</h3>
        
        <div className="flex items-center justify-between border-b border-white/5 py-4">
          <div>
            <div className="text-sm font-medium text-slate-200">Scheduled orders</div>
            <div className="text-xs text-slate-400">
              Allow retailers to schedule orders up to 6 months in advance. Orders will be paid based off ship date.
            </div>
          </div>
          <button
            onClick={() => setScheduledOrders(!scheduledOrders)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              scheduledOrders ? 'bg-sky-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                scheduledOrders ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Retailer Options */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Retailer options</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">Sell to online-only retailers</div>
            </div>
            <button
              onClick={() => setSellOnlineOnly(!sellOnlineOnly)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                sellOnlineOnly ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  sellOnlineOnly ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">Sell to social sellers</div>
              <div className="text-xs text-slate-400">
                These are sellers who exclusively sell on social media platforms like Facebook or Instagram.
              </div>
            </div>
            <button
              onClick={() => setSellSocialSellers(!sellSocialSellers)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                sellSocialSellers ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  sellSocialSellers ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">Sell preorders to qualified retailers only</div>
              <div className="text-xs text-slate-400">
                Qualified retailers are those who have met our buying requirements or are in your customer list.
              </div>
            </div>
            <button
              onClick={() => setSellPreorders(!sellPreorders)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                sellPreorders ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  sellPreorders ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Order Minimums */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Order minimums</h3>
        <p className="mb-4 text-sm text-slate-400">
          We recommend between KES 10,000 and KES 15,000 for first orders and between KES 10,000 and KES 15,000 for reorders.
        </p>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-300">First order minimum</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-slate-400">KES</span>
              <input
                type="text"
                value={firstOrderMin}
                onChange={(e) => setFirstOrderMin(e.target.value)}
                placeholder="-"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 pl-14 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>
          
          <div>
            <label className="mb-2 block text-sm text-slate-300">Reorder minimum</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-slate-400">KES</span>
              <input
                type="text"
                value={reorderMin}
                onChange={(e) => setReorderMin(e.target.value)}
                placeholder="-"
                className="w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 pl-14 text-sm text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
              />
            </div>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" className="rounded" />
          Apply default order minimums to all countries
          <div className="text-xs">We'll update these automatically using the daily exchange rate</div>
        </label>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button className="rounded-lg bg-slate-800 px-6 py-2 text-white hover:bg-slate-700">
          Save
        </Button>
      </div>
    </div>
  );

  const renderShippingSettings = () => (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-sky-500/10 to-indigo-500/10 p-8">
        <div className="flex items-center justify-between">
          <div className="max-w-xl">
            <h2 className="mb-2 text-2xl font-bold text-slate-100">
              Offer free and predictable shipping to retailers across Kenya
            </h2>
            <p className="mb-4 text-sm text-slate-300">
              Simplify checkout with predictable flat rate shipping prices and by offering free shipping on larger orders.
            </p>
            <div className="flex gap-3">
              <Button className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">
                Set up free shipping
              </Button>
              <Button variant="outline" className="rounded-lg border-white/20 px-4 py-2 text-slate-200 hover:bg-white/5">
                Configure flat rates
              </Button>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="rounded-xl bg-white/5 p-4">
              <div className="mb-2 text-xs text-slate-400">Checkout</div>
              <div className="mb-1 text-sm font-medium text-slate-200">Shipping</div>
              <div className="text-lg font-bold text-green-400">KES 2,400</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="flex gap-6">
          <button className="border-b-2 border-sky-500 pb-2 text-sm font-medium text-sky-400">
            Your shipping zones
          </button>
          <button className="pb-2 text-sm text-slate-400 hover:text-slate-200">
            Preferences
          </button>
        </div>
      </div>

      {/* Shipping Zones */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Your shipping zones</h3>
        <p className="mb-4 text-sm text-slate-400">
          Customize your shipping rates for the counties/regions you sell to.
        </p>
        
        <Button variant="outline" className="rounded-lg border-white/20 px-4 py-2 text-slate-200 hover:bg-white/5">
          + Create a shipping zone
        </Button>
      </div>

      {/* Shipping Origins */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Shipping origins</h3>
        <p className="mb-4 text-sm text-slate-400">
          Add the locations that you ship products from to simplify order fulfillment and improve shipping cost accuracy.
        </p>
        
        <Button variant="outline" className="rounded-lg border-white/20 px-4 py-2 text-slate-200 hover:bg-white/5">
          Add shipping origin
        </Button>
      </div>

      {/* Carrier Rates */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Carrier rates and preferences</h3>
        <p className="mb-4 text-sm text-slate-400">
          Select the carriers you prefer to ship products with to simplify order fulfillment.
        </p>
        
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-4">
          <Truck className="h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <div className="text-sm font-medium text-slate-200">Preferred carriers</div>
            <div className="text-xs text-slate-400">None</div>
          </div>
          <Button variant="ghost" className="text-sky-400 hover:text-sky-300">
            Edit
          </Button>
        </div>
      </div>

      {/* Shipping Packages */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Shipping packages</h3>
        <p className="mb-4 text-sm text-slate-400">
          Add measurements for your most commonly used boxes or mailers to simplify order fulfillment.
        </p>
        
        <Button variant="outline" className="rounded-lg border-white/20 px-4 py-2 text-slate-200 hover:bg-white/5">
          Add package
        </Button>
      </div>

      {/* Shipping Insurance */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Shipping insurance</h3>
        <p className="mb-4 text-sm text-slate-400">
          Protect your shipments with shipping insurance provided by local carriers.
        </p>
        
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Insure all shipments</span>
            </div>
            <p className="text-xs text-slate-400">
              Auto-select shipping insurance for future orders when you ship—you can deselect the option at any time.
            </p>
          </div>
          <button
            onClick={() => setInsureShipments(!insureShipments)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              insureShipments ? 'bg-sky-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                insureShipments ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Packing and Handling Fee */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Packing and handling fee</h3>
        <p className="mb-4 text-sm text-slate-400">
          Charge an additional fee on your orders to cover the costs of handling or extra packing materials.
        </p>
        
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">Charge a handling fee</span>
            </div>
            <p className="text-xs text-slate-400">
              You will be able to add a handling fee to each order when shipping or on your own.
            </p>
            {handlingFee && (
              <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                <p className="text-xs text-amber-300">
                  ⓘ Adding handling fee increases shipping cost and can impact Insider free shipping coverage. Note that handling fee will not be applied on orders with flat rate or free shipping.
                </p>
              </div>
            )}
          </div>
          <button
            onClick={() => setHandlingFee(!handlingFee)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              handlingFee ? 'bg-sky-500' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                handlingFee ? 'translate-x-5' : ''
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );

  const renderAccountSettings = () => (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="flex gap-6">
          <button className="border-b-2 border-sky-500 pb-2 text-sm font-medium text-sky-400">
            Payout
          </button>
          <button className="pb-2 text-sm text-slate-400 hover:text-slate-200">
            Billing
          </button>
          <button className="pb-2 text-sm text-slate-400 hover:text-slate-200">
            Notifications
          </button>
          <button className="pb-2 text-sm text-slate-400 hover:text-slate-200">
            Orders
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Payment methods</h3>
        <p className="mb-4 text-sm text-slate-400">
          Keep a payment method on file to use for recurring services like advertising on Vendai.
        </p>
        
        <Button className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">
          Add M-PESA account
        </Button>
      </div>

      {/* Billing History */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-100">Billing history</h3>
        
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Invoice date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                  <div className="text-sm font-medium text-slate-300">No invoices yet</div>
                  <div className="text-xs text-slate-500">
                    When you receive invoices from Vendai, they'll appear here.
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Reminders */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Order reminders</h3>
        <p className="mb-4 text-sm text-slate-400">
          Choose how you'd like to get reminder emails about your open orders.
        </p>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked={orderReminders === 'individual'}
              onChange={() => setOrderReminders('individual')}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-200">Individual reminders</div>
              <div className="text-xs text-slate-400">
                Get separate emails for each open order that needs to be accepted or shipped.
              </div>
            </div>
          </label>
          
          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked={orderReminders === 'daily'}
              onChange={() => setOrderReminders('daily')}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-200">Daily digest</div>
              <div className="text-xs text-slate-400">
                Get one daily email with a roundup of all open orders that need to be accepted or shipped.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Exclusivity Requests */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Exclusivity requests</h3>
        <p className="mb-4 text-sm text-slate-400">
          Choose how you'd like to be notified of retailers requesting that you offer exclusivity.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">Updates on Vendai Home</div>
              <div className="text-xs text-slate-400">
                Get a notification in Updates whenever one or more retailers request exclusivity with you.
              </div>
            </div>
            <button
              onClick={() => setExclusivityUpdates(!exclusivityUpdates)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                exclusivityUpdates ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  exclusivityUpdates ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">Weekly digest</div>
              <div className="text-xs text-slate-400">
                Get a weekly roundup email whenever one or more retailers request exclusivity with you.
              </div>
            </div>
            <button
              onClick={() => setWeeklyDigest(!weeklyDigest)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                weeklyDigest ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  weeklyDigest ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Product Sorting */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Product sorting</h3>
        <p className="mb-4 text-sm text-slate-400">
          Specify how the products in an order should be displayed.
        </p>
        
        <div className="space-y-2">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={productSort === 'name'}
              onChange={() => setProductSort('name')}
            />
            <span className="text-sm text-slate-200">Alphabetically by product name</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={productSort === 'sku'}
              onChange={() => setProductSort('sku')}
            />
            <span className="text-sm text-slate-200">Alphabetically by SKU</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={productSort === 'category-sku'}
              onChange={() => setProductSort('category-sku')}
            />
            <span className="text-sm text-slate-200">By category and then alphabetically by SKU</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="radio"
              checked={productSort === 'category-name'}
              onChange={() => setProductSort('category-name')}
            />
            <span className="text-sm text-slate-200">By category and then alphabetically by product name</span>
          </label>
        </div>
      </div>

      {/* Order Acceptance */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Order acceptance</h3>
        <p className="mb-4 text-sm text-slate-400">
          Choose when you want to accept orders on Vendai. For any orders accepted automatically, the estimated ship date will be set according to your brand lead time of 3 business days.
        </p>
        
        <div className="space-y-3">
          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked={orderAcceptance === 'manual'}
              onChange={() => setOrderAcceptance('manual')}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-200">Manually accept</div>
              <div className="text-xs text-slate-400">
                Individually review and accept every order you receive.
              </div>
            </div>
          </label>
          
          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked={orderAcceptance === 'auto-reorders'}
              onChange={() => setOrderAcceptance('auto-reorders')}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-200">Automatically accept reorders only</div>
              <div className="text-xs text-slate-400">
                Manually review and accept first-time orders, while reorders from customers are automatically accepted.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="radio"
              checked={orderAcceptance === 'auto-all'}
              onChange={() => setOrderAcceptance('auto-all')}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium text-slate-200">Automatically accept all orders</div>
              <div className="text-xs text-slate-400">
                Automatically accept all orders you receive on Vendai.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Packing Slips */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Packing slips</h3>
        <p className="mb-4 text-sm text-slate-400">
          Tailor your packing slips to your needs.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-200">Include product images</span>
            <button
              onClick={() => setIncludeProductImages(!includeProductImages)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                includeProductImages ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  includeProductImages ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-200">Include a QR code for retailers to leave a review</div>
            </div>
            <button
              onClick={() => setIncludeQRCode(!includeQRCode)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                includeQRCode ? 'bg-sky-500' : 'bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  includeQRCode ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTeamSettings = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center">
        <Users className="mx-auto mb-4 h-12 w-12 text-slate-400" />
        <h3 className="mb-2 text-lg font-semibold text-slate-100">Invite team members</h3>
        <p className="mb-6 text-sm text-slate-400">
          Collaborate with your team by inviting members to help manage your shop, orders, and products.
        </p>
        <Button className="rounded-lg bg-sky-500 px-6 py-2 text-white hover:bg-sky-600">
          Invite team member
        </Button>
      </div>
    </div>
  );

  return (
    <div className={`flex min-h-screen bg-slate-950 ${neueHaas.className}`}>
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-white/10 bg-slate-900/50 backdrop-blur-xl">
        {/* Back Button */}
        <div className="flex h-16 items-center px-6">
          <button
            onClick={() => router.push('/distributor-dashboard')}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"
          >
            ← Back to Home
          </button>
        </div>

        {/* Settings Header */}
        <div className="border-b border-white/10 px-6 py-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-lg font-semibold text-slate-100">Settings</span>
            <ChevronRight
              className={`h-5 w-5 text-slate-400 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>
        </div>

        {/* Settings Menu */}
        {isExpanded && (
          <nav className="p-3">
            <button
              onClick={() => setActiveTab('shop')}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                activeTab === 'shop'
                  ? 'bg-white/10 text-sky-300 font-medium'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              Shop settings
            </button>
            <button
              onClick={() => setActiveTab('shipping')}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                activeTab === 'shipping'
                  ? 'bg-white/10 text-sky-300 font-medium'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              Shipping tools
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                activeTab === 'account'
                  ? 'bg-white/10 text-sky-300 font-medium'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              Account settings
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-all ${
                activeTab === 'team'
                  ? 'bg-white/10 text-sky-300 font-medium'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              Team
            </button>
          </nav>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-8 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-100">
                {activeTab === 'shop' && 'Shop settings'}
                {activeTab === 'shipping' && 'Shipping tools'}
                {activeTab === 'account' && 'Account settings'}
                {activeTab === 'team' && 'Team'}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {activeTab === 'shop' && 'Edit your shop information, order options, and more.'}
                {activeTab === 'shipping' && 'Configure shipping rates, zones, and preferences.'}
                {activeTab === 'account' && 'Your account information, payment details, and settings.'}
                {activeTab === 'team' && 'Manage team members and permissions.'}
              </p>
            </div>
            {activeTab === 'shop' && (
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-lg border-white/20 text-slate-200 hover:bg-white/5">
                  View shop
                </Button>
                <Button className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">
                  Save
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          {activeTab === 'shop' && renderShopSettings()}
          {activeTab === 'shipping' && renderShippingSettings()}
          {activeTab === 'account' && renderAccountSettings()}
          {activeTab === 'team' && renderTeamSettings()}
        </div>
      </div>
    </div>
  );
}
