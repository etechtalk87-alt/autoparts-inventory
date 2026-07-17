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
        createElement(Text, { style: styles.muted }, invoice.customerContact),
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
        createElement(
          View,
          { style: styles.tableRow },
          createElement(Text, { style: styles.col1 }, invoice.partName),
          createElement(Text, { style: styles.col2 }, detailLine.join(' • ')),
          createElement(Text, { style: styles.col3 }, `${invoice.currency} ${invoice.salePrice}`),
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
    salePrice: Number(sale?.sale_price ?? 0).toFixed(2),
    currency: partData?.currency || sale?.currency || 'AED',
    customerName: sale?.customer_name || 'Walk-in Customer',
    customerContact: sale?.customer_contact || '—',
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
