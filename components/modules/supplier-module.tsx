"use client"

import { useState } from "react"
import { DollarSign, FileText, Package, Wallet, AlertCircle, Plus, Search, Filter, ChevronDown, Clock, MoreVertical } from "lucide-react"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs"
import type { Supplier, Invoice, Product, Payment } from "@/types/supplier"

// Sample data
const suppliers: Supplier[] = [
  {
    id: "SUP001",
    name: "Beverage Distributors Ltd",
    contact: {
      phone: "+254 712 345 678",
      email: "orders@bevdist.co.ke",
      address: "Industrial Area, Nairobi"
    },
    paymentTerms: "Net 7",
    creditLimit: 100000,
    currentCredit: 25000,
    status: "active",
    products: [
      {
        id: "PRD001",
        name: "Soda Carton (500ml x 24)",
        sku: "BEV-SOD-001",
        unitPrice: 960,
        category: "Beverages",
        minOrderQuantity: 5,
        leadTime: "1-2 days",
        inStock: true
      }
    ],
    accountBalance: -25000
  }
]

const invoices: Invoice[] = [
  {
    id: "INV001",
    supplierId: "SUP001",
    supplierName: "Beverage Distributors Ltd",
    invoiceDate: "2025-09-06",
    dueDate: "2025-09-13",
    status: "posted",
    items: [
      {
        productId: "PRD001",
        productName: "Soda Carton (500ml x 24)",
        quantity: 10,
        unitPrice: 960,
        tax: 153.60,
        total: 11136
      }
    ],
    subTotal: 9600,
    tax: 1536,
    total: 11136,
    paymentTerms: "Net 7",
    paymentStatus: "unpaid",
    payments: [],
    notes: "Regular weekly supply"
  },
  {
    id: "INV002",
    supplierId: "SUP001",
    supplierName: "Beverage Distributors Ltd",
    invoiceDate: "2025-09-05",
    dueDate: "2025-09-12",
    status: "posted",
    items: [
      {
        productId: "PRD001",
        productName: "Soda Carton (500ml x 24)",
        quantity: 15,
        unitPrice: 960,
        tax: 230.40,
        total: 16704
      }
    ],
    subTotal: 14400,
    tax: 2304,
    total: 16704,
    paymentTerms: "Net 7",
    paymentStatus: "partial",
    payments: [
      {
        id: "PAY001",
        invoiceId: "INV002",
        amount: 10000,
        date: "2025-09-06",
        method: "mpesa",
        reference: "PDQ123456",
        status: "completed"
      }
    ],
    notes: "Bulk order for weekend"
  },
  {
    id: "INV003",
    supplierId: "SUP001",
    supplierName: "Beverage Distributors Ltd",
    invoiceDate: "2025-08-28",
    dueDate: "2025-09-04",
    status: "overdue",
    items: [
      {
        productId: "PRD001",
        productName: "Soda Carton (500ml x 24)",
        quantity: 8,
        unitPrice: 960,
        tax: 122.88,
        total: 8908.80
      }
    ],
    subTotal: 7680,
    tax: 1228.80,
    total: 8908.80,
    paymentTerms: "Net 7",
    paymentStatus: "unpaid",
    payments: [],
    notes: "Emergency stock replenishment"
  }
]

const getStatusColor = (status: string) => {
  switch (status) {
    case "paid":
      return "text-green-400 bg-green-500/20 border-green-500/30"
    case "pending":
      return "text-orange-400 bg-orange-500/20 border-orange-500/30"
    case "overdue":
      return "text-red-400 bg-red-500/20 border-red-500/30"
    default:
      return "text-slate-400 bg-slate-500/20 border-slate-500/30"
  }
}

export function SupplierModule() {
  const [activeView, setActiveView] = useState('invoices')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
  
  const totalPayable = invoices
    .filter(inv => inv.paymentStatus !== 'paid')
    .reduce((sum, inv) => sum + inv.total, 0)
  
  const overdueAmount = invoices
    .filter(inv => inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0)

  return (
    <div className="">

  {/* Main Content */}
  
        <Tabs value={activeView} onValueChange={setActiveView}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-slate-800/50">
              <TabsTrigger value="invoices">Invoices & Bills</TabsTrigger>
              <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
              <TabsTrigger value="products">Product Catalog</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder={`Search ${activeView}...`}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
              <Button onClick={() => setShowInvoiceDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                New {activeView === 'invoices' ? 'Invoice' : activeView === 'suppliers' ? 'Supplier' : 'Product'}
              </Button>
            </div>
          </div>

          <TabsContent value="invoices" className="mt-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Invoice #</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Supplier</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Due Date</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Amount</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Payment</th>
                    <th className="w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr 
                      key={invoice.id} 
                      className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-slate-200">{invoice.id}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-200">{invoice.supplierName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-300">{invoice.invoiceDate}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-300">{invoice.dueDate}</div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="text-sm font-mono text-green-400">
                          {invoice.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </div>
                        {invoice.paymentStatus === 'partial' && (
                          <div className="text-xs text-slate-400">
                            Paid: {invoice.payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(invoice.status)}`}>
                          <span className="capitalize">{invoice.status}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(invoice.paymentStatus)}`}>
                          <span className="capitalize">{invoice.paymentStatus}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon">
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="suppliers" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {suppliers.map((supplier) => (
                <Card key={supplier.id} className="p-4 hover:bg-slate-800/50 transition-colors cursor-pointer">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-medium text-slate-200">{supplier.name}</h3>
                      <p className="text-sm text-slate-400">{supplier.contact.phone}</p>
                    </div>
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(supplier.status)}`}>
                      <span className="capitalize">{supplier.status}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Credit Limit</span>
                      <span className="text-slate-200 font-mono">
                        {supplier.creditLimit.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Current Credit</span>
                      <span className="text-orange-400 font-mono">
                        {supplier.currentCredit.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Account Balance</span>
                      <span className={`font-mono ${supplier.accountBalance < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {supplier.accountBalance.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-700/50 pt-3 mt-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">{supplier.products.length} Products</span>
                      <Button variant="ghost" size="sm">View Catalog</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="products" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {suppliers.flatMap(supplier => 
                supplier.products.map(product => (
                  <Card key={product.id} className="p-4">
                    <div className="w-full h-32 bg-slate-700/30 rounded flex items-center justify-center mb-3">
                      <Package className="w-10 h-10 text-slate-500" />
                    </div>
                    <h4 className="font-medium text-slate-200">{product.name}</h4>
                    <p className="text-xs text-slate-400 mb-2">{product.sku}</p>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-green-400 font-mono">KSh {product.unitPrice.toFixed(2)}</span>
                      <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${
                        product.inStock ? 'text-green-400 bg-green-500/20 border-green-500/30' : 'text-red-400 bg-red-500/20 border-red-500/30'
                      }`}>
                        <span>{product.inStock ? 'In Stock' : 'Out of Stock'}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400">
                      <p>Min. Order: {product.minOrderQuantity} units</p>
                      <p>Lead Time: {product.leadTime}</p>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      

      {/* Invoice Creation Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>
              Create a new supplier invoice or bill. Fill in the details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="supplier" className="text-right text-slate-400">
                Supplier
              </label>
              <div className="col-span-3">
                <select
                  id="supplier"
                  className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="date" className="text-right text-slate-400">
                Invoice Date
              </label>
              <Input
                id="date"
                type="date"
                className="col-span-3"
                defaultValue={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="terms" className="text-right text-slate-400">
                Payment Terms
              </label>
              <select
                id="terms"
                className="col-span-3 flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
              >
                <option value="cod">Cash on Delivery</option>
                <option value="net7">Net 7</option>
                <option value="net14">Net 14</option>
                <option value="net30">Net 30</option>
              </select>
            </div>

            {/* Products Section */}
            <div className="col-span-4 mt-4">
              <h4 className="font-medium mb-2">Products</h4>
              <div className="border border-slate-700 rounded-md p-4 space-y-4">
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-5">Product</div>
                  <div className="col-span-2">Quantity</div>
                  <div className="col-span-2">Unit Price</div>
                  <div className="col-span-2">Total</div>
                  <div className="col-span-1"></div>
                </div>
                {/* Product rows would be mapped here */}
                <Button variant="outline" size="sm" className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Add Product
                </Button>
              </div>
            </div>

            <div className="col-span-4">
              <div className="flex justify-between items-center text-sm">
                <span>Subtotal</span>
                <span className="font-mono">KSh 0.00</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-1">
                <span>VAT (16%)</span>
                <span className="font-mono">KSh 0.00</span>
              </div>
              <div className="flex justify-between items-center font-medium mt-2 pt-2 border-t border-slate-700">
                <span>Total</span>
                <span className="font-mono text-green-400">KSh 0.00</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>Cancel</Button>
            <Button>Create Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">{selectedInvoice.supplierName}</h3>
                  <p className="text-sm text-slate-400">Invoice #{selectedInvoice.id}</p>
                </div>
                <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getStatusColor(selectedInvoice.status)}`}>
                  <span className="capitalize">{selectedInvoice.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-400">Invoice Date</p>
                  <p className="font-medium">{selectedInvoice.invoiceDate}</p>
                </div>
                <div>
                  <p className="text-slate-400">Due Date</p>
                  <p className="font-medium">{selectedInvoice.dueDate}</p>
                </div>
                <div>
                  <p className="text-slate-400">Payment Terms</p>
                  <p className="font-medium">{selectedInvoice.paymentTerms}</p>
                </div>
                <div>
                  <p className="text-slate-400">Payment Status</p>
                  <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border mt-1 ${getStatusColor(selectedInvoice.paymentStatus)}`}>
                    <span className="capitalize">{selectedInvoice.paymentStatus}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Items</h4>
                <div className="border border-slate-700 rounded-md divide-y divide-slate-700">
                  {selectedInvoice.items.map((item, index) => (
                    <div key={index} className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-slate-400">
                            {item.quantity} x KSh {item.unitPrice.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <p className="font-mono">
                          KSh {item.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="font-mono">
                    KSh {selectedInvoice.subTotal.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">VAT (16%)</span>
                  <span className="font-mono">
                    KSh {selectedInvoice.tax.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-slate-700">
                  <span>Total</span>
                  <span className="font-mono text-green-400">
                    KSh {selectedInvoice.total.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {selectedInvoice.payments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Payments</h4>
                  <div className="border border-slate-700 rounded-md divide-y divide-slate-700">
                    {selectedInvoice.payments.map((payment) => (
                      <div key={payment.id} className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium capitalize">{payment.method}</p>
                            <p className="text-sm text-slate-400">{payment.date}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono">
                              KSh {payment.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-slate-400">Ref: {payment.reference}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInvoice.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-slate-400">{selectedInvoice.notes}</p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedInvoice(null)}>Close</Button>
                {selectedInvoice.paymentStatus !== 'paid' && (
                  <Button>Record Payment</Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
