import { createElement } from 'react'
import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 36,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 14,
  },
  companyName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  generatedDate: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'right',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0f172a',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cellBase: {
    fontSize: 10,
    color: '#0f172a',
    // default flex removed here; applied per-column using column.width
    paddingRight: 8, // small gap between columns
    flexShrink: 1,
  },
  alignRight: {
    textAlign: 'right',
  },
  footer: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  pageNumber: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
  },
})

function ReportDocument({ companyName, reportTitle, generatedDate, columns, rows }) {
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
          createElement(Text, { style: styles.companyName }, companyName || 'Auto Parts Inventory'),
          createElement(Text, { style: styles.reportTitle }, reportTitle || 'Report'),
        ),
        createElement(Text, { style: styles.generatedDate }, `Generated: ${generatedDate}`),
      ),
      createElement(
        View,
        { style: styles.table },
        createElement(
          View,
          { style: styles.tableHeader },
          ...columns.map((column) =>
            createElement(
              Text,
              {
                key: `header-${column.key}`,
                // header cell styles include flex derived from column.width
                style: [
                  styles.tableHeaderText,
                  { flex: column.width || 1, paddingRight: 8 },
                  column.align === 'right' ? styles.alignRight : null,
                ],
              },
              column.label,
            ),
          ),
        ),
        ...rows.map((row, rowIndex) =>
          createElement(
            View,
            {
              key: `row-${rowIndex}`,
              wrap: false,
              style: [
                styles.tableRow,
                rowIndex % 2 === 1 ? { backgroundColor: '#f8fafc' } : null,
              ],
            },
            ...columns.map((column) => {
              const rawValue = row[column.key]
              let rendered = null

              if (typeof column.render === 'function') {
                try {
                  const result = column.render(rawValue, row)
                  if (typeof result === 'string') {
                    rendered = { text: result }
                  } else if (result && typeof result === 'object') {
                    rendered = { text: String(result.text ?? ''), color: result.color ?? null }
                  } else {
                    rendered = { text: String(result ?? '') }
                  }
                } catch (e) {
                  rendered = { text: String(rawValue ?? '') }
                }
              } else {
                rendered = { text: String(rawValue ?? '') }
              }

              const cellStyles = [
                styles.cellBase,
                { flex: column.width || 1 },
                column.align === 'right' ? styles.alignRight : null,
                rendered.color ? { color: rendered.color } : null,
              ]

              return createElement(
                Text,
                {
                  key: `${column.key}-${rowIndex}`,
                  style: cellStyles,
                },
                rendered.text,
              )
            }),
          ),
        ),
      ),
      createElement(
        View,
        { style: styles.footer },
        createElement(Text, { style: styles.pageNumber }, ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`),
      ),
    ),
  )
}

export async function generateReportPdf({ companyName, reportTitle, columns, rows }) {
  const date = new Date().toISOString().slice(0, 10)
  const generatedDate = new Date().toLocaleDateString()
  const fileName = `${(reportTitle || 'report').replace(/\s+/g, '-').toLowerCase()}-${date}.pdf`
  const reportElement = createElement(ReportDocument, {
    companyName,
    reportTitle,
    generatedDate,
    columns,
    rows,
  })
  const blob = await pdf(reportElement).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
