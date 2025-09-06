export interface Supplier {
  id: string
  name: string
  contact: {
    phone: string
    email: string
    address: string
  }
  paymentTerms: string
  creditLimit: number
  currentCredit: number
  status: 'active' | 'inactive'
  products: Product[]
  accountBalance: number
}

export interface Product {
  id: string
  name: string
  sku: string
  unitPrice: number
  category: string
  minOrderQuantity: number
  leadTime: string // e.g., "2-3 days"
  inStock: boolean
}

export interface Invoice {
  id: string
  supplierId: string
  supplierName: string
  invoiceDate: string
  dueDate: string
  status: 'draft' | 'posted' | 'paid' | 'overdue' | 'cancelled'
  items: InvoiceItem[]
  subTotal: number
  tax: number
  total: number
  paymentTerms: string
  paymentStatus: 'unpaid' | 'partial' | 'paid'
  payments: Payment[]
  notes: string
}

export interface InvoiceItem {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  tax: number
  total: number
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  date: string
  method: 'cash' | 'mpesa' | 'bank' | 'credit'
  reference: string
  status: 'pending' | 'completed' | 'failed'
}
