import { createElement } from 'react'
import { Document, Page, StyleSheet, Text, View, Image, Svg, Path, Circle, pdf } from '@react-pdf/renderer'

const COLORS = {
  charcoal: '#1A1410',
  gold: '#C9A057',
  goldBorder: '#D8B07A',
  cream: '#F9F7F3',
  white: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  emerald: '#059669',
  rose: '#DC2626',
  amber: '#D97706',
  purple: '#7C3AED',
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: COLORS.cream,
    fontFamily: 'Helvetica',
  },
  headerBand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: COLORS.charcoal,
    paddingHorizontal: 40,
    paddingVertical: 28,
    borderBottomWidth: 3,
    borderBottomColor: COLORS.gold,
    borderBottomRightRadius: 70,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.gold,
    marginHorizontal: 16,
    opacity: 0.5,
  },
  logo: { width: 46, height: 46, borderRadius: 8, marginRight: 14, backgroundColor: COLORS.white },
  company: { fontSize: 17, fontWeight: '700', color: COLORS.white, letterSpacing: 0.3 },
  headerInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
  headerInfoText: { fontSize: 8.5, color: '#D6D0C4' },
  headerInfoLine: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
  headerRight: { alignItems: 'flex-end' },
  title: { fontSize: 13, fontWeight: '700', color: COLORS.gold, textTransform: 'uppercase', letterSpacing: 2.5 },
  originalPill: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  originalPillText: { fontSize: 8, color: COLORS.gold, letterSpacing: 1.5, textTransform: 'uppercase' },
  body: { paddingHorizontal: 40, paddingVertical: 30 },
  detailsRow: { flexDirection: 'row', gap: 14, marginBottom: 22, alignItems: 'flex-start' },
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: 16,
    padding: 14,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.charcoal,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  cardLabel: { fontSize: 9, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  cardValue: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  cardSub: { fontSize: 9.5, color: COLORS.textSecondary, marginBottom: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 9.5, color: COLORS.textSecondary },
  detailValue: { fontSize: 9.5, fontWeight: '700', color: COLORS.textPrimary },
  statusBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statusBadgeText: { fontSize: 9, fontWeight: '700', color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 5 },
  table: { borderWidth: 1, borderColor: COLORS.goldBorder, borderRadius: 14, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: COLORS.charcoal, paddingVertical: 11, paddingHorizontal: 16 },
  tableHeaderText: { fontSize: 9, fontWeight: '700', color: COLORS.gold, textTransform: 'uppercase', letterSpacing: 0.8 },
  tableRow: { flexDirection: 'row', paddingVertical: 13, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#EFE9DD', backgroundColor: COLORS.white },
  tableRowAlt: { backgroundColor: '#FAF7F0' },
  colIndex: { width: 24, fontSize: 9.5, color: COLORS.textSecondary },
  col1: { flex: 2, fontSize: 10.5, color: COLORS.textPrimary, fontWeight: '600' },
  col2: { flex: 2, fontSize: 9.5, color: COLORS.textSecondary },
  col3: { flex: 1, fontSize: 10.5, textAlign: 'right', color: COLORS.textPrimary, fontWeight: '700' },
  totalsRow: { flexDirection: 'row', gap: 14, marginTop: 22, alignItems: 'flex-start' },
  statusCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: 16,
    padding: 16,
  },
  statusCardTitle: { fontSize: 9, fontWeight: '700', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  statusCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusCardValue: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
  statusCardNote: { fontSize: 9, color: COLORS.textSecondary },
  summaryCard: {
    flex: 1.1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.goldBorder,
    borderRadius: 16,
    padding: 18,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 9.5, color: COLORS.textSecondary },
  summaryValue: { fontSize: 9.5, color: COLORS.textPrimary, fontWeight: '600' },
  totalDivider: { marginTop: 4, marginBottom: 8, borderTopWidth: 1, borderTopColor: '#EFE9DD' },
  grandTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  grandTotalLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary, textTransform: 'uppercase', letterSpacing: 0.5 },
  grandTotalValue: { fontSize: 18, fontWeight: '700', color: COLORS.gold },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
  barDark: { backgroundColor: COLORS.charcoal },
  barLabelDark: { fontSize: 9, fontWeight: '700', color: COLORS.white, textTransform: 'uppercase', letterSpacing: 0.5 },
  barValueGreen: { fontSize: 11, fontWeight: '700', color: '#34D399' },
  featuresRow: { flexDirection: 'row', marginTop: 26, borderWidth: 1, borderColor: COLORS.goldBorder, borderRadius: 16, backgroundColor: COLORS.white },
  featureCol: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  featureColBorder: { borderLeftWidth: 1, borderLeftColor: '#EFE9DD' },
  featureTitle: { fontSize: 9, fontWeight: '700', color: COLORS.textPrimary, marginTop: 6, textAlign: 'center' },
  featureDesc: { fontSize: 7.5, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  footerBottom: { marginTop: 20, alignItems: 'center' },
  footerTagline: { fontSize: 10, color: COLORS.gold, fontStyle: 'italic', marginBottom: 4 },
  footerDisclaimer: { fontSize: 8, color: COLORS.textSecondary },
})

// Small hand-built icon primitives (lucide-react is web-only, not usable in react-pdf)
function IconCheck({ color = COLORS.white, size = 11 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, { d: 'M20 6L9 17l-5-5', stroke: color, strokeWidth: 3, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }),
  )
}
function IconUser({ color = COLORS.white, size = 12 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Circle, { cx: 12, cy: 8, r: 4, stroke: color, strokeWidth: 2, fill: 'none' }),
    createElement(Path, { d: 'M4 20c0-4 4-6 8-6s8 2 8 6', stroke: color, strokeWidth: 2, fill: 'none', strokeLinecap: 'round' }),
  )
}
function IconDocument({ color = COLORS.white, size = 12 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, { d: 'M6 2h9l5 5v15H6z', stroke: color, strokeWidth: 2, fill: 'none', strokeLinejoin: 'round' }),
    createElement(Path, { d: 'M9 12h6M9 16h6', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' }),
  )
}
function IconShield({ color = COLORS.charcoal, size = 18 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, { d: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinejoin: 'round' }),
    createElement(Path, { d: 'M9 12l2 2 4-4', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }),
  )
}
function IconHeadset({ color = COLORS.charcoal, size = 18 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, { d: 'M4 13a8 8 0 0116 0', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round' }),
    createElement(Path, { d: 'M4 13v4a2 2 0 002 2h1v-6H5a1 1 0 00-1 1z', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinejoin: 'round' }),
    createElement(Path, { d: 'M20 13v4a2 2 0 01-2 2h-1v-6h2a1 1 0 011 1z', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinejoin: 'round' }),
  )
}
function IconClock({ color = COLORS.charcoal, size = 18 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Circle, { cx: 12, cy: 12, r: 9, stroke: color, strokeWidth: 1.8, fill: 'none' }),
    createElement(Path, { d: 'M12 7v5l3 3', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }),
  )
}
function IconLocation({ color = COLORS.gold, size = 9 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, { d: 'M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z', stroke: color, strokeWidth: 2, fill: 'none', strokeLinejoin: 'round' }),
    createElement(Circle, { cx: 12, cy: 10, r: 2.5, stroke: color, strokeWidth: 2, fill: 'none' }),
  )
}
function IconPhone({ color = COLORS.gold, size = 9 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, {
      d: 'M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c0.3-0.3 0.7-0.4 1-0.2 1.1 0.4 2.3 0.6 3.6 0.6 0.6 0 1 0.4 1 1V20c0 0.6-0.4 1-1 1C10.9 21 3 13.1 3 3.4c0-0.6 0.4-1 1-1h3.4c0.6 0 1 0.4 1 1 0 1.3 0.2 2.5 0.6 3.6 0.1 0.3 0.1 0.7-0.2 1L6.6 10.8z',
      stroke: color, strokeWidth: 1.6, fill: 'none', strokeLinejoin: 'round',
    }),
  )
}
function IconIdCard({ color = COLORS.gold, size = 9 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, { d: 'M3 5h18v14H3z', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinejoin: 'round' }),
    createElement(Circle, { cx: 8, cy: 12, r: 2, stroke: color, strokeWidth: 1.6, fill: 'none' }),
    createElement(Path, { d: 'M14 10h5M14 14h5', stroke: color, strokeWidth: 1.6, strokeLinecap: 'round' }),
  )
}
function IconMail({ color = COLORS.gold, size = 9 }) {
  return createElement(
    Svg, { width: size, height: size, viewBox: '0 0 24 24' },
    createElement(Path, { d: 'M3 5h18v14H3z', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinejoin: 'round' }),
    createElement(Path, { d: 'M3 6l9 7 9-7', stroke: color, strokeWidth: 1.8, fill: 'none', strokeLinejoin: 'round' }),
  )
}

const STATUS_COLORS = {
  'Paid in Full': COLORS.emerald,
  'Partial Payment': COLORS.amber,
  'On Credit': COLORS.purple,
  'Unpaid': COLORS.rose,
}

function InvoiceDocument({ invoice }) {
  const branchLine = [invoice.branchName, invoice.branchLocation].filter(Boolean).join(' • ')
  const statusColor = STATUS_COLORS[invoice.paymentStatusLabel] || COLORS.rose
  const balanceDueNum = Number(invoice.balanceDue || 0)

  const items = invoice.items || [
    { partName: invoice.partName, condition: invoice.condition, donorVehicle: invoice.donorVehicle, salePrice: invoice.salePrice },
  ]

  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },

      // Header
      createElement(
        View,
        { style: styles.headerBand },
        createElement(
          View,
          { style: styles.headerLeft },
          ...(invoice.logoUrl ? [createElement(Image, { key: 'logo', style: styles.logo, src: invoice.logoUrl })] : []),
          ...(invoice.logoUrl ? [createElement(View, { key: 'divider', style: styles.headerDivider })] : []),
          createElement(
            View,
            null,
            createElement(Text, { style: styles.company }, invoice.companyName || 'Auto Parts Inventory'),
            createElement(
              View,
              { style: [styles.headerInfoLine, { marginTop: 6 }] },
              createElement(IconLocation, {}),
              createElement(Text, { style: styles.headerInfoText }, branchLine || 'Branch'),
            ),
            ...(invoice.contactPhone ? [createElement(
              View,
              { key: 'phone', style: styles.headerInfoLine },
              createElement(IconPhone, {}),
              createElement(Text, { style: styles.headerInfoText }, invoice.contactPhone),
            )] : []),
            ...(invoice.trnNumber ? [createElement(
              View,
              { key: 'trn', style: styles.headerInfoLine },
              createElement(IconIdCard, {}),
              createElement(Text, { style: styles.headerInfoText }, `TRN: ${invoice.trnNumber}`),
            )] : []),
            ...(invoice.contactEmail ? [createElement(
              View,
              { key: 'email', style: styles.headerInfoLine },
              createElement(IconMail, {}),
              createElement(Text, { style: styles.headerInfoText }, invoice.contactEmail),
            )] : []),
          ),
        ),
        createElement(
          View,
          { style: styles.headerRight },
          createElement(Text, { style: styles.title }, Number(invoice.vatAmount) > 0 ? 'Tax Invoice' : 'Invoice'),
          createElement(View, { style: styles.originalPill }, createElement(Text, { style: styles.originalPillText }, 'Original')),
        ),
      ),

      createElement(
        View,
        { style: styles.body },

        // Bill To + Invoice Details
        createElement(
          View,
          { style: styles.detailsRow },
          createElement(
            View,
            { style: styles.card },
            createElement(
              View,
              { style: styles.cardHeaderRow },
              createElement(View, { style: styles.iconCircle }, createElement(IconUser, {})),
              createElement(Text, { style: styles.cardLabel }, 'Bill To'),
            ),
            createElement(Text, { style: styles.cardValue }, invoice.customerName),
            ...(invoice.customerContact ? [createElement(Text, { key: 'c', style: styles.cardSub }, invoice.customerContact)] : []),
          ),
          createElement(
            View,
            { style: styles.card },
            createElement(
              View,
              { style: styles.cardHeaderRow },
              createElement(View, { style: styles.iconCircle }, createElement(IconDocument, {})),
              createElement(Text, { style: styles.cardLabel }, 'Invoice Details'),
            ),
            createElement(View, { style: styles.detailRow }, createElement(Text, { style: styles.detailLabel }, 'Invoice No.'), createElement(Text, { style: styles.detailValue }, invoice.invoiceNumber)),
            createElement(View, { style: styles.detailRow }, createElement(Text, { style: styles.detailLabel }, 'Date'), createElement(Text, { style: styles.detailValue }, invoice.saleDate)),
            createElement(
              View,
              { style: [styles.statusBadge, { backgroundColor: statusColor }] },
              createElement(IconCheck, { size: 9 }),
              createElement(Text, { style: styles.statusBadgeText }, invoice.paymentStatusLabel || 'Unpaid'),
            ),
          ),
        ),

        // Items table
        createElement(
          View,
          { style: styles.table },
          createElement(
            View,
            { style: styles.tableHeader },
            createElement(Text, { style: [styles.colIndex, styles.tableHeaderText] }, '#'),
            createElement(Text, { style: [styles.col1, styles.tableHeaderText] }, 'Item'),
            createElement(Text, { style: [styles.col2, styles.tableHeaderText] }, 'Details'),
            createElement(Text, { style: [styles.col3, styles.tableHeaderText] }, 'Amount'),
          ),
          ...items.map((item, index) => {
            const lineDetails = [
              item.condition ? `Condition: ${item.condition}` : null,
              item.donorVehicle ? `Vehicle: ${item.donorVehicle}` : null,
            ].filter(Boolean)
            return createElement(
              View,
              { key: `${item.partName}-${index}`, wrap: false, style: [styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : null] },
              createElement(Text, { style: styles.colIndex }, String(index + 1)),
              createElement(Text, { style: styles.col1 }, item.partName),
              createElement(Text, { style: styles.col2 }, lineDetails.join('  •  ')),
              createElement(Text, { style: styles.col3 }, `${invoice.currency} ${item.salePrice}`),
            )
          }),
        ),

        // Payment status + Financial summary
        createElement(
          View,
          { style: styles.totalsRow },
          createElement(
            View,
            { style: styles.statusCard },
            createElement(Text, { style: styles.statusCardTitle }, 'Payment Status'),
            createElement(
              View,
              { style: styles.statusCardRow },
              createElement(View, { style: [styles.iconCircle, { backgroundColor: statusColor, width: 20, height: 20, borderRadius: 10, marginRight: 0 }] }, createElement(IconCheck, { size: 10 })),
              createElement(Text, { style: [styles.statusCardValue, { color: statusColor }] }, invoice.paymentStatusLabel || 'Unpaid'),
            ),
            createElement(Text, { style: styles.statusCardNote }, 'Thank you for your business.'),
          ),
          createElement(
            View,
            { style: styles.summaryCard },
            ...(Number(invoice.vatAmount) > 0
              ? [
                  createElement(View, { key: 'sub', style: styles.summaryRow }, createElement(Text, { style: styles.summaryLabel }, 'Subtotal'), createElement(Text, { style: styles.summaryValue }, `${invoice.currency} ${invoice.subtotal}`)),
                  createElement(View, { key: 'vat', style: styles.summaryRow }, createElement(Text, { style: styles.summaryLabel }, `VAT (${invoice.vatRatePercent ?? 5}%)`), createElement(Text, { style: styles.summaryValue }, `${invoice.currency} ${invoice.vatAmount}`)),
                ]
              : []),
            createElement(View, { style: styles.totalDivider }),
            createElement(View, { style: styles.grandTotalRow }, createElement(Text, { style: styles.grandTotalLabel }, 'Grand Total'), createElement(Text, { style: styles.grandTotalValue }, `${invoice.currency} ${invoice.totalAmount ?? invoice.salePrice}`)),
            createElement(
              View,
              { style: [styles.bar, styles.barDark] },
              createElement(Text, { style: styles.barLabelDark }, 'Amount Paid'),
              createElement(Text, { style: styles.barValueGreen }, `${invoice.currency} ${(Number(invoice.totalAmount ?? invoice.salePrice ?? 0) - balanceDueNum).toFixed(2)}`),
            ),
            createElement(
              View,
              { style: [styles.bar, { backgroundColor: balanceDueNum > 0 ? '#FEE2E2' : '#D1FAE5' }] },
              createElement(Text, { style: [styles.barLabelDark, { color: balanceDueNum > 0 ? COLORS.rose : COLORS.emerald }] }, 'Balance Due'),
              createElement(Text, { style: [styles.barValueGreen, { color: balanceDueNum > 0 ? COLORS.rose : COLORS.emerald }] }, `${invoice.currency} ${balanceDueNum.toFixed(2)}`),
            ),
          ),
        ),

        // Feature footer
        createElement(
          View,
          { style: styles.featuresRow },
          createElement(
            View,
            { style: styles.featureCol },
            createElement(IconShield, {}),
            createElement(Text, { style: styles.featureTitle }, '100% Original Parts'),
            createElement(Text, { style: styles.featureDesc }, 'Quality checked & tested'),
          ),
          createElement(
            View,
            { style: [styles.featureCol, styles.featureColBorder] },
            createElement(IconShield, {}),
            createElement(Text, { style: styles.featureTitle }, 'Warranty Assured'),
            createElement(Text, { style: styles.featureDesc }, 'Peace of mind guaranteed'),
          ),
          createElement(
            View,
            { style: [styles.featureCol, styles.featureColBorder] },
            createElement(IconHeadset, {}),
            createElement(Text, { style: styles.featureTitle }, 'Customer Support'),
            createElement(Text, { style: styles.featureDesc }, "We're here to help"),
          ),
          createElement(
            View,
            { style: [styles.featureCol, styles.featureColBorder] },
            createElement(IconClock, {}),
            createElement(Text, { style: styles.featureTitle }, 'Thank You'),
            createElement(Text, { style: styles.featureDesc }, 'For your trust & support'),
          ),
        ),

        createElement(
          View,
          { style: styles.footerBottom },
          createElement(Text, { style: styles.footerTagline }, 'Driven by Quality, Trusted for Reliability.'),
          createElement(Text, { style: styles.footerDisclaimer }, 'This is a computer generated invoice and does not require a signature.'),
        ),
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
      .select('invoice_number, payment_status, amount_paid, currency, total_amount, subtotal, vat_amount, created_at')
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
      ? supabaseClient.from('companies').select('name, trn_number, contact_phone, contact_email, logo_url').eq('id', companyId).maybeSingle()
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
      subtotal: invoiceRow?.subtotal != null ? Number(invoiceRow.subtotal).toFixed(2) : null,
      vatAmount: Number(invoiceRow?.vat_amount || 0).toFixed(2),
      currency: itemCurrency,
      customerName,
      customerContact: customerPhone ? `Phone: ${customerPhone}` : '',
      contactPhone: companyData?.contact_phone || null,
      contactEmail: companyData?.contact_email || null,
      logoUrl: companyData?.logo_url || null,
      paymentStatus: invoiceRow?.payment_status || 'unpaid',
      paymentStatusLabel:
        invoiceRow?.payment_status === 'paid' || invoiceRow?.payment_status === 'paid_in_full'
          ? 'Paid in Full'
          : invoiceRow?.payment_status === 'partial'
          ? 'Partial Payment'
          : invoiceRow?.payment_status === 'credit'
          ? 'On Credit'
          : 'Unpaid',
      trnNumber: companyData?.trn_number || null,
      balanceDue: (Number(invoiceRow?.total_amount ?? 0) - Number(invoiceRow?.amount_paid ?? 0)).toFixed(2),
      vatRatePercent: (() => {
        const sub = Number(invoiceRow?.subtotal || 0)
        const vat = Number(invoiceRow?.vat_amount || 0)
        return sub > 0 ? Math.round((vat / sub) * 1000) / 10 : 5
      })(),
    }
  }

  const companyPromise = companyId && supabaseClient
    ? supabaseClient.from('companies').select('name, contact_phone, contact_email, trn_number, vat_enabled, vat_rate, logo_url').eq('id', companyId).maybeSingle()
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

  // Fetch the authoritative sale record directly, so the PDF always 
  // reflects real, saved amounts regardless of which screen triggered it
  let authoritativeSale = sale
  if (sale?.id && supabaseClient) {
    const { data: freshSale } = await supabaseClient
      .from('sales')
      .select('sale_price, vat_amount, total_amount, amount_paid, payment_status')
      .eq('id', sale.id)
      .maybeSingle()
    if (freshSale) {
      authoritativeSale = { ...sale, ...freshSale }
    }
  }

  // Calculate payment status label and balance due
  const salePrice = Number(authoritativeSale?.sale_price ?? 0)
  const amountPaid = Number(authoritativeSale?.amount_paid ?? 0)
  const paymentStatus = authoritativeSale?.payment_status || 'unpaid'
  const vatAmountCalc = Number(authoritativeSale?.vat_amount ?? 0)
  const totalWithVat = Number(authoritativeSale?.total_amount ?? salePrice)
  const vatRateValue = salePrice > 0 ? Math.round((vatAmountCalc / salePrice) * 1000) / 10 : Number(companyData?.vat_rate ?? 5)
  let paymentStatusLabel = 'Unpaid'
  let balanceDue = totalWithVat
  switch (paymentStatus) {
    case 'paid':
    case 'paid_in_full':
      paymentStatusLabel = 'Paid in Full'
      balanceDue = 0
      break
    case 'partial':
      paymentStatusLabel = 'Partial Payment'
      balanceDue = totalWithVat - amountPaid
      break
    case 'credit':
      paymentStatusLabel = 'On Credit'
      balanceDue = totalWithVat
      break
    case 'unpaid':
      paymentStatusLabel = 'Unpaid'
      balanceDue = totalWithVat
      break
    default:
      paymentStatusLabel = 'Unpaid'
      balanceDue = totalWithVat
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
    salePrice: totalWithVat.toFixed(2),
    currency: partData?.currency || sale?.currency || 'AED',
    customerName,
    customerContact: sale?.customer_contact || '',
    contactPhone: companyData?.contact_phone || null,
    contactEmail: companyData?.contact_email || null,
    logoUrl: companyData?.logo_url || null,
    subtotal: salePrice.toFixed(2),
    vatAmount: vatAmountCalc.toFixed(2),
    totalAmount: totalWithVat.toFixed(2),
    vatRatePercent: vatRateValue,
    trnNumber: companyData?.trn_number || null,
    paymentStatus,
    paymentStatusLabel,
    balanceDue: balanceDue.toFixed(2),
  }
}

export async function buildInvoicePdfBlob({ supabaseClient, companyId, branchId, partId, sale }) {
  const invoice = await fetchInvoicePayload({ supabaseClient, companyId, branchId, partId, sale })
  const pdfBlob = await pdf(createElement(InvoiceDocument, { invoice })).toBlob()
  return { blob: pdfBlob, invoiceNumber: invoice.invoiceNumber, totalAmount: invoice.totalAmount, currency: invoice.currency, customerName: invoice.customerName }
}

export async function downloadInvoicePdf({ supabaseClient, companyId, branchId, partId, sale }) {
  const { blob, invoiceNumber } = await buildInvoicePdfBlob({ supabaseClient, companyId, branchId, partId, sale })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoiceNumber || 'invoice'}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function shareInvoicePdf({ supabaseClient, companyId, branchId, partId, sale }) {
  const { blob, invoiceNumber, totalAmount, currency, customerName } = await buildInvoicePdfBlob({ supabaseClient, companyId, branchId, partId, sale })

  const fileName = `${invoiceNumber || 'invoice'}.pdf`
  const file = new File([blob], fileName, { type: 'application/pdf' })

  // Try native share (works on mobile, includes WhatsApp in the picker, attaches the actual file)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `Invoice ${invoiceNumber}`,
        text: `Invoice ${invoiceNumber} for ${customerName} — ${currency} ${totalAmount}`,
      })
      return { method: 'native' }
    } catch (err) {
      // User cancelled the share sheet — not an error, just stop here
      if (err.name === 'AbortError') return { method: 'cancelled' }
      // Any other failure — fall through to the WhatsApp text fallback below
    }
  }

  // Fallback: desktop or unsupported browsers — open WhatsApp with pre-filled text,
  // and separately trigger a normal download so the PDF can be attached manually
  const message = encodeURIComponent(
    `Invoice ${invoiceNumber} for ${customerName} — Total: ${currency} ${totalAmount}. (PDF downloading now, please attach it to this chat.)`
  )
  window.open(`https://wa.me/?text=${message}`, '_blank')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return { method: 'fallback' }
}
