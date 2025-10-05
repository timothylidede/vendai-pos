'use client'

import type { ReceiptArtifacts, ReceiptBuilderResult } from '@/lib/receipts'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ReceiptPreviewProps {
  data: ReceiptBuilderResult
  artifacts?: ReceiptArtifacts
  className?: string
  actions?: React.ReactNode
}

const formatterFor = (currency: string | undefined) =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency ?? 'KES',
  })

export function ReceiptPreview({ data, artifacts, className, actions }: ReceiptPreviewProps) {
  const currencyFormatter = formatterFor(data.org.currency)

  return (
    <Card className={cn('bg-slate-900/80 text-slate-100 shadow-xl', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-800/80">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-50">
            {data.header.orgName}
          </CardTitle>
          <p className="text-xs text-slate-400">Receipt #{data.receipt.receiptNumber}</p>
          <p className="text-xs text-slate-400">{new Date(data.receipt.issuedAt).toLocaleString()}</p>
        </div>
  {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[60vh] p-6">
          <section className="space-y-1 text-sm">
            {data.header.headerLines.map((line, idx) => (
              <p key={`header-${idx}`} className="text-xs text-slate-400">
                {line}
              </p>
            ))}
            {data.cashierName && (
              <p className="text-xs text-slate-300">
                Cashier: <span className="font-medium">{data.cashierName}</span>
              </p>
            )}
            {data.registerId && (
              <p className="text-xs text-slate-300">
                Register: <span className="font-medium">{data.registerId}</span>
              </p>
            )}
            {data.receipt.customer?.name && (
              <p className="text-xs text-slate-300">
                Customer: <span className="font-medium">{data.receipt.customer.name}</span>
              </p>
            )}
          </section>

          <section className="mt-4 rounded-lg border border-slate-800/70 bg-slate-900/40">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Item</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.items.map((item) => (
                  <tr key={`${item.id ?? item.name}`} className="text-slate-200">
                    <td className="px-4 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-100">{item.name}</span>
                        {item.sku && <span className="text-xs text-slate-500">SKU: {item.sku}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-sm">{item.quantity}</td>
                    <td className="px-4 py-2 text-right text-sm">
                      {currencyFormatter.format(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800/70 bg-slate-900/40 p-3 text-slate-200">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-right font-medium">
                {currencyFormatter.format(data.totals.subtotal)}
              </span>
              {data.totals.taxTotal > 0 && (
                <>
                  <span className="text-slate-400">Tax</span>
                  <span className="text-right font-medium">
                    {currencyFormatter.format(data.totals.taxTotal)}
                  </span>
                </>
              )}
              {data.totals.discountTotal > 0 && (
                <>
                  <span className="text-slate-400">Discounts</span>
                  <span className="text-right font-medium">
                    -{currencyFormatter.format(data.totals.discountTotal)}
                  </span>
                </>
              )}
              <span className="text-slate-300">Grand Total</span>
              <span className="text-right text-base font-semibold text-slate-50">
                {currencyFormatter.format(data.totals.grandTotal)}
              </span>
              {data.totals.changeDue > 0 && (
                <>
                  <span className="text-slate-400">Change Due</span>
                  <span className="text-right font-medium">
                    {currencyFormatter.format(data.totals.changeDue)}
                  </span>
                </>
              )}
            </div>

            {data.payments.length > 0 && (
              <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Payments</h4>
                <ul className="mt-2 space-y-1 text-sm text-slate-200">
                  {data.payments.map((payment) => (
                    <li key={`${payment.method}-${payment.amount}`} className="flex justify-between">
                      <span className="capitalize text-slate-300">{payment.method.replace(/_/g, ' ')}</span>
                      <span className="font-medium">
                        {currencyFormatter.format(payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {(data.footer.footerLines.length > 0 || data.footer.notes) && (
            <section className="mt-6 text-center text-xs text-slate-400">
              {data.footer.footerLines.map((line, idx) => (
                <p key={`footer-${idx}`}>{line}</p>
              ))}
              {data.footer.notes && <p className="mt-2 italic text-slate-500">{data.footer.notes}</p>}
            </section>
          )}

          {artifacts?.documentUrls && (
            <section className="mt-6 rounded-lg border border-slate-800/70 bg-slate-900/40 p-3 text-xs text-slate-400">
              <h4 className="font-semibold uppercase tracking-wide text-slate-500">Stored documents</h4>
              <ul className="mt-2 space-y-1">
                {artifacts.documentUrls.html && (
                  <li>
                    HTML copy:{' '}
                    <a
                      className="text-emerald-400 hover:underline"
                      href={artifacts.documentUrls.html}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {artifacts.documentUrls.html}
                    </a>
                  </li>
                )}
                {artifacts.documentUrls.pdf && (
                  <li>
                    PDF copy:{' '}
                    <a
                      className="text-emerald-400 hover:underline"
                      href={artifacts.documentUrls.pdf}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {artifacts.documentUrls.pdf}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
