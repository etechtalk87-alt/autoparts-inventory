import { createElement } from 'react'
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 32,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  company: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#111827',
  },
  secondary: {
    fontSize: 11,
    color: '#4b5563',
    marginBottom: 2,
  },
  muted: {
    fontSize: 11,
    color: '#4b5563',
    marginBottom: 2,
  },
  meta: {
    alignItems: 'flex-end',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  col1: {
    flex: 2,
    fontSize: 11,
  },
  col2: {
    flex: 2,
    fontSize: 11,
  },
  col3: {
    flex: 1,
    fontSize: 11,
    textAlign: 'right',
  },
  paymentStatus: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  balanceDue: {
    marginTop: 8,
    fontWeight: 'bold',
    fontSize: 12,
    color: '#dc2626',
  },
  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 12,
    color: '#374151',
  },
})

function InvoiceDocument({ invoice }) {
  const detailLine = [
    invoice.partName,
    invoice.oemNumber ? `OEM: ${invoice.oemNumber}` : null,
    invoice.condition ? `Condition: ${invoice.condition}` : null,
    invoice.donorVehicle ? `Vehicle: ${invoice.donorVehicle}` : null,
  ].filter(Boolean)
  const branchLine = [invoice.branchName, invoice.branchLocation].filter(Boolean).join(' • ')

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(
        View,
        { style: styles.header },
        createElement(
          View,
          null,
          createElement(Text, { style: styles.title }, 'Invoice'),
          createElement(Text, { style: styles.company }, invoice.companyName || 'Auto Parts Inventory'),
          createElement(Text, { style: styles.secondary }, branchLine || 'Branch'),
        ),
        createElement(
          View,
          { style: styles.meta },
          createElement(Text, { style: styles.muted }, `Invoice #: ${invoice.invoiceNumber}`),
          createElement(Text, { style: styles.muted }, `Date: ${invoice.saleDate}`),
        ),
      ),
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 'Bill To'),
        createElement(Text, { style: styles.muted }, invoice.customerName),
        ...(invoice.customerContact
          ? [createElement(Text, { key: 'customer-contact', style: styles.muted }, invoice.customerContact)]
          : []),
      ),
      createElement(
        View,
        { style: styles.table },
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(Text, { style: styles.col1 }, 'Item'),
          createElement(Text, { style: styles.col2 }, 'Details'),
          createElement(Text, { style: styles.col3 }, 'Amount'),
        ),
        ...(invoice.items || [
          {
            partName: invoice.partName,
            oemNumber: invoice.oemNumber,
            condition: invoice.condition,
            donorVehicle: invoice.donorVehicle,
            salePrice: invoice.salePrice,
          },
        ]).map((item, index) => {
          const lineDetails = [
            item.oemNumber ? `OEM: ${item.oemNumber}` : null,
            item.condition ? `Condition: ${item.condition}` : null,
            item.donorVehicle ? `Vehicle: ${item.donorVehicle}` : null,
          ].filter(Boolean)
          return createElement(
            View,
            { key: `${item.partName}-${index}`, style: styles.tableRow },
            createElement(Text, { style: styles.col1 }, item.partName),
            createElement(Text, { style: styles.col2 }, lineDetails.join(' • ')),
            createElement(Text, { style: styles.col3 }, `${invoice.currency} ${item.salePrice}`),
          )
        }),
      ),
      createElement(
        View,
        { style: styles.paymentStatus },
        createElement(
          View,
          null,
          createElement(Text, { style: styles.muted }, 'Payment Status:'),
          createElement(Text, { style: styles.secondary }, invoice.paymentStatusLabel || 'Unpaid'),
        ),
        createElement(
          View,
          { style: { textAlign: 'right' } },
          invoice.balanceDue !== undefined && invoice.balanceDue > 0
            ? createElement(Text, { style: styles.balanceDue }, `Balance Due: ${invoice.currency} ${invoice.balanceDue}`)
            : createElement(Text, { style: styles.muted }, `Total: ${invoice.currency} ${invoice.totalAmount ?? invoice.salePrice}`),
        ),
      ),
      createElement(
        View,
        { style: styles.footer },
        createElement(Text, { style: styles.footerText }, 'Thank you for your business'),
      ),
    ),
  )
}

export function createInvoiceNumber(branchName, sequenceNumber) {
  const initials = (branchName || 'BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return `INV-${initials || 'BR'}-${String(sequenceNumber).padStart(4, '0')}`
}

export async function fetchInvoicePayload({ supabaseClient, companyId, branchId, partId, sale }) {
  const isInvoice = Boolean(sale?.invoice_id)
  let invoiceData = null
  let invoiceSales = []

  if (isInvoice && supabaseClient) {
    const invoicePromise = supabaseClient
      .from('invoices')
      .select('invoice_number, payment_status, amount_paid, currency, total_amount, created_at')
      .eq('id', sale.invoice_id)
      .maybeSingle()

    const salesPromise = supabaseClient
      .from('sales')
      .select('id, sale_price, amount_paid, payment_status, created_at, part_id, customer_id, invoice_number, branch_id, company_id, parts:part_id ( part_name, oem_number, condition, currency, donor_vehicle_id, donor_vehicles:donor_vehicle_id ( make, model, year ) ), customers:customer_id ( full_name, phone )')
      .eq('invoice_id', sale.invoice_id)

    const [{ data: invoiceRow, error: invoiceRowError }, { data: salesRows, error: salesRowsError }] = await Promise.all([invoicePromise, salesPromise])

    if (!invoiceRowError && !salesRowsError && Array.isArray(salesRows) && salesRows.length > 0) {
      invoiceData = { invoiceRow, salesRows }
    }
  }

  if (invoiceData) {
    const { invoiceRow, salesRows } = invoiceData
    const firstSale = salesRows[0]
    const companyPromise = companyId && supabaseClient
      ? supabaseClient.from('companies').select('name').eq('id', companyId).maybeSingle()
      : Promise.resolve({ data: null })

    const branchPromise = branchId && supabaseClient
      ? supabaseClient.from('branches').select('name, location').eq('id', branchId).maybeSingle()
      : Promise.resolve({ data: null })

    const [companyResult, branchResult] = await Promise.all([companyPromise, branchPromise])
    const companyData = !companyResult?.error ? companyResult?.data : null
    const branchData = !branchResult?.error ? branchResult?.data : null

    const items = salesRows.map((saleRow) => {
      const donorVehicle = saleRow.parts?.donor_vehicles
      const donorVehicleText = donorVehicle
        ? [donorVehicle.make, donorVehicle.model, donorVehicle.year].filter(Boolean).join(' ').trim() || '—'
        : '—'

      return {
        partName: saleRow.parts?.part_name || 'Part',
        oemNumber: saleRow.parts?.oem_number || '—',
        condition: saleRow.parts?.condition || '—',
        donorVehicle: donorVehicleText,
        salePrice: Number(saleRow.sale_price || 0).toFixed(2),
        currency: saleRow.parts?.currency || invoiceRow?.currency || 'AED',
      }
    })

    const itemCurrency = invoiceRow?.currency || items[0]?.currency || 'AED'
    const customerName = firstSale.customers?.full_name || sale.customer_name || 'Walk-in Customer'
    const customerPhone = firstSale.customers?.phone || sale.customer_phone || ''

    return {
      companyName: companyData?.name || 'Auto Parts Inventory',
      branchName: branchData?.name || 'Branch',
      branchLocation: branchData?.location || '—',
      invoiceNumber: invoiceRow?.invoice_number || firstSale.invoice_number || createInvoiceNumber(branchData?.name || 'Branch', firstSale.id || 1),
      saleDate: invoiceRow?.created_at ? new Date(invoiceRow.created_at).toLocaleDateString() : new Date(firstSale.created_at).toLocaleDateString(),
      items,
      totalAmount: Number(invoiceRow?.total_amount ?? items.reduce((sum, item) => sum + Number(item.salePrice || 0), 0)).toFixed(2),
      currency: itemCurrency,
      customerName,
      customerContact: customerPhone ? `Phone: ${customerPhone}` : '',
      paymentStatus: invoiceRow?.payment_status || 'unpaid',
      paymentStatusLabel:
        invoiceRow?.payment_status === 'paid' || invoiceRow?.payment_status === 'paid_in_full'
          ? 'Paid in Full'
          : invoiceRow?.payment_status === 'partial'
          ? 'Partial Payment'
          : invoiceRow?.payment_status === 'credit'
          ? 'On Credit'
          : 'Unpaid',
      balanceDue: (Number(invoiceRow?.total_amount ?? 0) - Number(invoiceRow?.amount_paid ?? 0)).toFixed(2),
    }
  }

  const companyPromise = companyId && supabaseClient
    ? supabaseClient.from('companies').select('name').eq('id', companyId).maybeSingle()
    : Promise.resolve({ data: null })

  const branchPromise = branchId && supabaseClient
    ? supabaseClient.from('branches').select('name, location').eq('id', branchId).maybeSingle()
    : Promise.resolve({ data: null })

  const partPromise = partId && supabaseClient
    ? supabaseClient.from('parts').select('part_name, oem_number, condition, currency, donor_vehicle_id').eq('id', partId).maybeSingle()
    : Promise.resolve({ data: null })

  const [companyResult, branchResult, partResult] = await Promise.all([companyPromise, branchPromise, partPromise])
  const companyData = !companyResult?.error ? companyResult?.data : null
  const branchData = !branchResult?.error ? branchResult?.data : null
  const partData = !partResult?.error ? partResult?.data : null

  let donorVehicleText = '—'
  if (partData?.donor_vehicle_id && supabaseClient) {
    const { data: donorVehicleData } = await supabaseClient
      .from('donor_vehicles')
      .select('make, model, year')
      .eq('id', partData.donor_vehicle_id)
      .maybeSingle()

    if (donorVehicleData) {
      donorVehicleText = `${donorVehicleData.make || ''} ${donorVehicleData.model || ''} (${donorVehicleData.year || 'N/A'})`.trim()
    }
  }

  // Fetch customer name from customers table if customer_id is present
  let customerName = sale?.customer_name || 'Walk-in Customer'
  if (sale?.customer_id && supabaseClient) {
    const { data: customerData } = await supabaseClient
      .from('customers')
      .select('full_name')
      .eq('id', sale.customer_id)
      .maybeSingle()

    if (customerData?.full_name) {
      customerName = customerData.full_name
    }
  }

  // Calculate payment status label and balance due
  const salePrice = Number(sale?.sale_price ?? 0)
  const amountPaid = Number(sale?.amount_paid ?? 0)
  const paymentStatus = sale?.payment_status || 'unpaid'

  let paymentStatusLabel = 'Unpaid'
  let balanceDue = salePrice

  switch (paymentStatus) {
    case 'paid':
    case 'paid_in_full':
      paymentStatusLabel = 'Paid in Full'
      balanceDue = 0
      break
    case 'partial':
      paymentStatusLabel = 'Partial Payment'
      balanceDue = salePrice - amountPaid
      break
    case 'credit':
      paymentStatusLabel = 'On Credit'
      balanceDue = salePrice
      break
    case 'unpaid':
      paymentStatusLabel = 'Unpaid'
      balanceDue = salePrice
      break
    default:
      paymentStatusLabel = 'Unpaid'
      balanceDue = salePrice
  }

  return {
    companyName: companyData?.name || 'Auto Parts Inventory',
    branchName: branchData?.name || 'Branch',
    branchLocation: branchData?.location || '—',
    invoiceNumber: sale?.invoice_number || createInvoiceNumber(branchData?.name || 'Branch', sale?.id || 1),
    saleDate: sale?.created_at ? new Date(sale.created_at).toLocaleDateString() : new Date().toLocaleDateString(),
    partName: partData?.part_name || sale?.part_name || 'Part',
    oemNumber: partData?.oem_number || '—',
    condition: partData?.condition || '—',
    donorVehicle: donorVehicleText,
    salePrice: salePrice.toFixed(2),
    currency: partData?.currency || sale?.currency || 'AED',
    customerName,
    customerContact: sale?.customer_contact || '—',
    paymentStatus,
    paymentStatusLabel,
    balanceDue: balanceDue.toFixed(2),
  }
}

export async function downloadInvoicePdf({ supabaseClient, companyId, branchId, partId, sale }) {
  const invoice = await fetchInvoicePayload({ supabaseClient, companyId, branchId, partId, sale })
  const pdfBlob = await pdf(createElement(InvoiceDocument, { invoice })).toBlob()
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoice.invoiceNumber || 'invoice'}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
