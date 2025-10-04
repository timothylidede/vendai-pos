import { z } from 'zod'

// Common validation schemas
export const baseEntitySchema = {
  id: z.string().min(1, 'ID is required'),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
}

// User validation schemas
export const userSchema = z.object({
  uid: z.string().min(1, 'User ID is required'),
  email: z.string().email('Invalid email format'),
  displayName: z.string().min(1, 'Display name is required'),
  role: z.enum(['distributor', 'retailer', 'admin'], {
    errorMap: () => ({ message: 'Role must be distributor, retailer, or admin' })
  }),
  organizationName: z.string().min(1, 'Organization name is required'),
  contactNumber: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone number format'),
  location: z.string().min(1, 'Location is required'),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180)
  }).optional(),
  onboardingCompleted: z.boolean().default(false),
  ...baseEntitySchema
})

// Product validation schemas
export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(100, 'Product name too long'),
  brand: z.string().max(50, 'Brand name too long').optional(),
  category: z.string().min(1, 'Category is required').max(50, 'Category name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  image: z.string().url('Invalid image URL').optional(),
  distributorId: z.string().min(1, 'Distributor ID is required'),
  
  // Pricing
  piecePrice: z.number().positive('Piece price must be positive'),
  wholesalePrice: z.number().positive('Wholesale price must be positive').optional(),
  
  // Units
  baseUom: z.string().min(1, 'Base unit of measure is required'),
  retailUom: z.string().min(1, 'Retail unit of measure is required'),
  unitsPerBase: z.number().int().positive('Units per base must be a positive integer'),
  
  // Barcodes
  pieceBarcode: z.string().optional(),
  cartonBarcode: z.string().optional(),
  
  // Status
  isActive: z.boolean().default(true),
  
  ...baseEntitySchema
})

// Order validation schemas
export const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitPrice: z.number().positive('Unit price must be positive'),
  total: z.number().positive('Total must be positive')
})

export const orderSchema = z.object({
  retailerId: z.string().min(1, 'Retailer ID is required'),
  retailerName: z.string().min(1, 'Retailer name is required'),
  distributorId: z.string().min(1, 'Distributor ID is required'),
  distributorName: z.string().min(1, 'Distributor name is required'),
  
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  
  subTotal: z.number().nonnegative('Subtotal cannot be negative'),
  tax: z.number().nonnegative('Tax cannot be negative'),
  total: z.number().positive('Total must be positive'),
  
  paymentMethod: z.enum(['cash', 'credit', 'mpesa'], {
    errorMap: () => ({ message: 'Payment method must be cash, credit, or mpesa' })
  }),
  paymentStatus: z.enum(['pending', 'paid', 'partial'], {
    errorMap: () => ({ message: 'Payment status must be pending, paid, or partial' })
  }),
  
  deliveryAddress: z.string().min(1, 'Delivery address is required'),
  notes: z.string().max(500, 'Notes too long').optional(),
  
  status: z.enum(['pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid order status' })
  }).default('pending'),
  
  ...baseEntitySchema
})

// B2B purchase order schema
export const moneyBreakdownSchema = z.object({
  subtotal: z.number().nonnegative('Subtotal cannot be negative'),
  tax: z.number().nonnegative('Tax cannot be negative'),
  total: z.number().positive('Total must be positive'),
  currency: z.string().min(3).max(3, 'Currency must be ISO 4217 code'),
})

export const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  sku: z.string().max(64).optional(),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitPrice: z.number().positive('Unit price must be positive'),
  unit: z.string().max(16).optional(),
  vatRate: z.number().min(0).max(1).optional(),
  notes: z.string().max(200).optional(),
})

export const deliveryCheckpointSchema = z.object({
  label: z.string().min(1, 'Checkpoint label is required').max(60),
  completed: z.boolean().default(false),
  timestamp: z.union([z.string(), z.date()]).optional(),
  notes: z.string().max(200).optional(),
})

export const purchaseOrderCreateSchema = z.object({
  retailerOrgId: z.string().min(1, 'Retailer org ID is required'),
  supplierOrgId: z.string().min(1).optional(),
  retailerId: z.string().min(1, 'Retailer ID is required'),
  retailerName: z.string().min(1, 'Retailer name is required'),
  retailerUserId: z.string().min(1).optional(),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  supplierName: z.string().min(1, 'Supplier name is required'),
  supplierUserId: z.string().min(1).optional(),
  createdByUserId: z.string().min(1, 'Created by user ID is required'),
  createdByName: z.string().min(1).optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'fulfilled', 'cancelled']).default('submitted'),
  paymentTerms: z.enum(['cod', 'net7', 'net14', 'net30', 'net60']),
  expectedDeliveryDate: z.union([z.string(), z.date()]).optional(),
  deliveryAddress: z.string().min(1, 'Delivery address is required').max(200),
  notes: z.string().max(500).optional(),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required'),
  amount: moneyBreakdownSchema,
  deliveryCheckpoints: z.array(deliveryCheckpointSchema).optional(),
  statusNote: z.string().max(200).optional(),
})

export const purchaseOrderUpdateSchema = z
  .object({
    status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'fulfilled', 'cancelled']).optional(),
    statusNote: z.string().max(200).optional(),
    updatedByUserId: z.string().min(1).optional(),
    updatedByName: z.string().min(1).optional(),
    paymentTerms: z.enum(['cod', 'net7', 'net14', 'net30', 'net60']).optional(),
    expectedDeliveryDate: z.union([z.string(), z.date(), z.null()]).optional(),
    deliveryAddress: z.string().min(1, 'Delivery address cannot be empty').max(200).optional(),
    notes: z.string().max(500).optional(),
    items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required when updating items').optional(),
    amount: moneyBreakdownSchema.optional(),
    deliveryCheckpoints: z.array(deliveryCheckpointSchema).optional().nullable(),
    relatedInvoiceId: z.string().min(1, 'Related invoice ID cannot be empty').nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const providedFields = [
      data.status,
      data.statusNote,
      data.updatedByUserId,
      data.updatedByName,
      data.paymentTerms,
      data.expectedDeliveryDate,
      data.deliveryAddress,
      data.notes,
      data.items,
      data.amount,
      data.deliveryCheckpoints,
      data.relatedInvoiceId,
    ]

    const hasUpdate = providedFields.some((value) => value !== undefined)
    if (!hasUpdate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided to update the purchase order',
      })
    }

    if ((data.items !== undefined) !== (data.amount !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Updating items requires providing the amount breakdown and vice versa',
        path: data.items === undefined ? ['items'] : ['amount'],
      })
    }
  })

// B2B Invoice schemas
export const invoiceItemSchema = purchaseOrderItemSchema.extend({
  lineTotal: z.number().nonnegative('Line total cannot be negative'),
})

export const invoiceCreateSchema = z.object({
  retailerOrgId: z.string().min(1, 'Retailer organization ID is required'),
  supplierOrgId: z.string().min(1).optional(),
  purchaseOrderId: z.string().min(1, 'Purchase order ID is required'),
  salesOrderId: z.string().min(1).optional(),
  retailerId: z.string().min(1, 'Retailer ID is required'),
  retailerName: z.string().min(1, 'Retailer name is required'),
  retailerUserId: z.string().min(1).optional(),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  supplierName: z.string().min(1, 'Supplier name is required'),
  supplierUserId: z.string().min(1).optional(),
  number: z.string().min(1, 'Invoice number is required'),
  issueDate: z.union([z.string(), z.date()]),
  dueDate: z.union([z.string(), z.date()]),
  status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled']).default('issued'),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
  amount: moneyBreakdownSchema,
  paymentTerms: z.enum(['cod', 'net7', 'net14', 'net30', 'net60']),
  createdByUserId: z.string().min(1).optional(),
  createdByName: z.string().min(1).optional(),
})

export const invoiceUpdateSchema = z
  .object({
    status: z.enum(['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled']).optional(),
    paymentStatus: z.enum(['pending', 'processing', 'partial', 'paid', 'failed', 'refunded']).optional(),
    paymentTerms: z.enum(['cod', 'net7', 'net14', 'net30', 'net60']).optional(),
    paymentIds: z.array(z.string().min(1)).optional(),
    amount: moneyBreakdownSchema.optional(),
  issueDate: z.union([z.string(), z.date()]).optional(),
  dueDate: z.union([z.string(), z.date()]).optional(),
    statusNote: z.string().max(200).optional(),
    updatedByUserId: z.string().min(1).optional(),
    updatedByName: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    const provided = [
      data.status,
      data.paymentStatus,
      data.paymentTerms,
      data.paymentIds,
      data.amount,
      data.issueDate,
      data.dueDate,
      data.statusNote,
    ]

    if (!provided.some((value) => value !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided to update the invoice',
      })
    }

    if ((data.status !== undefined || data.paymentStatus !== undefined) && !data.updatedByUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Updating status requires the updatedByUserId field',
        path: ['updatedByUserId'],
      })
    }
  })

// Settlement validation schemas
export const settlementSchema = z.object({
  distributorId: z.string().min(1, 'Distributor ID is required'),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  gmv: z.number().nonnegative('GMV cannot be negative'),
  settlement: z.number().nonnegative('Settlement amount cannot be negative'),
  status: z.enum(['pending', 'paid', 'overdue'], {
    errorMap: () => ({ message: 'Status must be pending, paid, or overdue' })
  }),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Paid date must be in YYYY-MM-DD format').optional(),
  paidAmount: z.number().positive('Paid amount must be positive').optional(),
  notes: z.string().max(500, 'Notes too long').optional(),
  orderCount: z.number().int().nonnegative('Order count cannot be negative').optional(),
  ...baseEntitySchema
})

// Invoice validation schemas
export const invoiceSchema = z.object({
  distributorId: z.string().min(1, 'Distributor ID is required'),
  retailerId: z.string().min(1, 'Retailer ID is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  
  subTotal: z.number().nonnegative('Subtotal cannot be negative'),
  tax: z.number().nonnegative('Tax cannot be negative'),
  total: z.number().positive('Total must be positive'),
  
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format'),
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Paid date must be in YYYY-MM-DD format').optional(),
  paidAmount: z.number().nonnegative('Paid amount cannot be negative').optional(),
  
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid invoice status' })
  }).default('draft'),
  
  notes: z.string().max(500, 'Notes too long').optional(),
  
  ...baseEntitySchema
})

export const creditEngineOptionsSchema = z.object({
  baseLimit: z.number().positive('Base limit must be positive').optional(),
  maxLimit: z.number().positive('Max limit must be positive').optional(),
  volumeTarget: z.number().positive('Volume target must be positive').optional(),
  targetRepaymentLag: z.number().nonnegative('Target repayment lag cannot be negative').optional(),
  volumeToCreditRatio: z.number().positive('Volume to credit ratio must be positive').optional(),
  scoreMultiplier: z.number().positive('Score multiplier must be positive').optional(),
  outstandingWeight: z.number().nonnegative('Outstanding weight cannot be negative').optional(),
  utilizationComfortThreshold: z
    .number()
    .min(0, 'Utilization threshold cannot be negative')
    .max(1, 'Utilization threshold cannot exceed 1')
    .optional(),
})

export const creditAssessmentInputSchema = z.object({
  retailerId: z.string().min(1, 'Retailer ID is required'),
  trailingVolume90d: z.number().nonnegative('Trailing volume cannot be negative'),
  trailingGrowthRate: z.number(),
  orders90d: z.number().int().nonnegative('Orders must be non-negative'),
  averageOrderValue: z.number().nonnegative('Average order value cannot be negative'),
  onTimePaymentRate: z.number().min(0, 'On-time payment rate cannot be negative').max(1, 'On-time payment rate cannot exceed 1'),
  disputeRate: z.number().min(0, 'Dispute rate cannot be negative'),
  repaymentLagDays: z.number().nonnegative('Repayment lag cannot be negative'),
  creditUtilization: z.number().min(0, 'Credit utilization cannot be negative'),
  currentOutstanding: z.number().nonnegative('Current outstanding cannot be negative'),
  existingCreditLimit: z.number().nonnegative('Existing credit limit cannot be negative'),
  consecutiveOnTimePayments: z.number().int().nonnegative('Consecutive payments cannot be negative'),
  daysSinceSignup: z.number().nonnegative('Days since signup cannot be negative'),
  sectorRisk: z.enum(['low', 'medium', 'high']),
  manualAdjustment: z.number().optional(),
  options: creditEngineOptionsSchema.optional(),
})

export const creditHistoryQuerySchema = z.object({
  retailerId: z.string().min(1, 'Retailer ID is required'),
  limit: z
    .number()
    .int('Limit must be an integer')
    .positive('Limit must be positive')
    .max(200, 'Limit cannot exceed 200')
    .default(25)
    .optional(),
})

export const creditLimitUpdateSchema = z.object({
  retailerId: z.string().min(1, 'Retailer ID is required'),
  newLimit: z.number().nonnegative('New limit cannot be negative'),
  manualAdjustment: z.number().optional(),
  reason: z.string().max(300, 'Reason too long').optional(),
  updatedByUserId: z.string().min(1, 'Updated by user ID is required'),
  updatedByName: z.string().min(1, 'Updated by name is required').optional(),
})

// Inventory validation schemas
export const inventorySchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  orgId: z.string().min(1, 'Organization ID is required'),
  
  qtyBase: z.number().int().nonnegative('Base quantity cannot be negative'),
  qtyLoose: z.number().int().nonnegative('Loose quantity cannot be negative'),
  unitsPerBase: z.number().int().positive('Units per base must be positive'),
  
  reorderLevel: z.number().int().nonnegative('Reorder level cannot be negative').optional(),
  maxStock: z.number().int().positive('Max stock must be positive').optional(),
  
  lastRestocked: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Last restocked must be in YYYY-MM-DD format').optional(),
  updatedBy: z.string().min(1, 'Updated by is required').optional(),
  
  ...baseEntitySchema
})

// API query parameter validation
export const paginationSchema = z.object({
  page: z.number().int().positive('Page must be a positive integer').default(1),
  limit: z.number().int().positive('Limit must be a positive integer').max(100, 'Limit cannot exceed 100').default(20)
})

export const dateRangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format')
}).refine(
  data => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'Start date must be before or equal to end date' }
)

export const searchSchema = z.object({
  query: z.string().min(1, 'Search query cannot be empty').max(100, 'Search query too long'),
  category: z.string().max(50, 'Category filter too long').optional(),
  status: z.string().max(20, 'Status filter too long').optional()
})

// Sanitization functions
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function sanitizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except + at the start
  return phone.replace(/(?!^\+)\D/g, '')
}

// Custom validation functions
export function validateKenyanPhoneNumber(phone: string): boolean {
  // Kenyan phone numbers: +254XXXXXXXXX or 07XXXXXXXX or 01XXXXXXXX
  const patterns = [
    /^\+254[17]\d{8}$/, // +254 format
    /^0[17]\d{8}$/      // Local format starting with 07 or 01
  ]
  return patterns.some(pattern => pattern.test(phone))
}

export function validateMpesaNumber(phone: string): boolean {
  // M-Pesa numbers are typically mobile numbers starting with 07
  const mpesaPattern = /^(\+254|0)?7\d{8}$/
  return mpesaPattern.test(phone)
}

export function validateBusinessName(name: string): boolean {
  // Basic business name validation
  const minLength = 2
  const maxLength = 100
  const validCharacters = /^[a-zA-Z0-9\s\-\.\'&]+$/
  
  return name.length >= minLength && 
         name.length <= maxLength && 
         validCharacters.test(name)
}

// Input sanitization middleware
export function sanitizeInput<T>(data: T, schema: z.ZodSchema<T>): T {
  // First sanitize string fields
  const sanitized = sanitizeObject(data)
  
  // Then validate with schema
  const result = schema.parse(sanitized)
  
  return result
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  
  return obj
}

// Form validation helpers for frontend
export const formValidation = {
  email: (email: string) => z.string().email().safeParse(email),
  phone: (phone: string) => validateKenyanPhoneNumber(phone),
  businessName: (name: string) => validateBusinessName(name),
  mpesaNumber: (phone: string) => validateMpesaNumber(phone),
  required: (value: any) => value !== null && value !== undefined && value !== '',
  minLength: (value: string, min: number) => value.length >= min,
  maxLength: (value: string, max: number) => value.length <= max,
  positiveNumber: (value: number) => typeof value === 'number' && value > 0,
  nonNegativeNumber: (value: number) => typeof value === 'number' && value >= 0
}

// Export all schemas for use in API routes
export const schemas = {
  user: userSchema,
  product: productSchema,
  order: orderSchema,
  orderItem: orderItemSchema,
  settlement: settlementSchema,
  invoice: invoiceSchema,
  inventory: inventorySchema,
  pagination: paginationSchema,
  dateRange: dateRangeSchema,
  search: searchSchema,
  purchaseOrderCreate: purchaseOrderCreateSchema,
  purchaseOrderItem: purchaseOrderItemSchema,
  deliveryCheckpoint: deliveryCheckpointSchema,
  moneyBreakdown: moneyBreakdownSchema,
  purchaseOrderUpdate: purchaseOrderUpdateSchema,
  invoiceCreate: invoiceCreateSchema,
  invoiceItem: invoiceItemSchema,
  invoiceUpdate: invoiceUpdateSchema,
  creditAssessmentInput: creditAssessmentInputSchema,
  creditHistoryQuery: creditHistoryQuerySchema,
  creditLimitUpdate: creditLimitUpdateSchema,
  creditEngineOptions: creditEngineOptionsSchema,
}