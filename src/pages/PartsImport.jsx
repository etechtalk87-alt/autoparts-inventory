import { useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Papa from 'papaparse'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const validConditions = ['excellent', 'good', 'fair', 'for parts']
const validCurrencies = ['AED', 'USD']

function PartsImport() {
  const { currentStaff, loading } = useAuth()
  const [fileName, setFileName] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [rows, setRows] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [importSummary, setImportSummary] = useState(null)
  const [branches, setBranches] = useState([])

  const canManageBranches = currentStaff?.role === 'company_admin'

  const fileInputRef = useRef(null)

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const f = event.dataTransfer?.files?.[0]
    if (f) {
      setSelectedFile(f)
      setFileName(f.name)
      setRows([])
      setPreviewRows([])
      setImportSummary(null)
      setErrorMessage('')
    }
  }

  const handleBrowse = () => fileInputRef.current?.click()

  const isEmptyImportRow = (row) => {
    const relevantFields = [
      'part_name',
      'oem_number',
      'category',
      'condition',
      'cost',
      'currency',
      'asking_price',
      'donor_vehicle_make',
      'donor_vehicle_model',
      'donor_vehicle_year',
      ...(canManageBranches ? ['branch_name'] : []),
    ]

    return relevantFields.every((field) => {
      const value = row?.[field]
      return value === undefined || value === null || String(value).trim() === ''
    })
  }

  useMemo(() => {
    const loadBranches = async () => {
      if (!currentStaff?.company_id) {
        setBranches([])
        return
      }

      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('company_id', currentStaff.company_id)
        .order('name', { ascending: true })

      if (!error) {
        setBranches(data ?? [])
      }
    }

    loadBranches()
  }, [currentStaff?.company_id])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <p className="text-lg text-slate-300">Loading...</p>
      </main>
    )
  }

  if (currentStaff?.role !== 'company_admin' && currentStaff?.role !== 'branch_staff') {
    return <Navigate to="/" replace />
  }

  const downloadTemplate = () => {
    const header = [
      'part_name',
      'oem_number',
      'category',
      'condition',
      'cost',
      'currency',
      'asking_price',
      'donor_vehicle_make',
      'donor_vehicle_model',
      'donor_vehicle_year',
      ...(canManageBranches ? ['branch_name'] : []),
    ]

    const csv = [header.join(','), 'Headlight Assembly,123456,Body,excellent,120,AED,180,Acura,MDX,2020,Main Branch'].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'parts-import-template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = async (event) => {
    const selected = event.target.files?.[0]
    if (!selected) return

    setSelectedFile(selected)
    setFileName(selected.name)
    setRows([])
    setPreviewRows([])
    setImportSummary(null)
    setErrorMessage('')
  }

  const handleParseSelectedFile = (file) => {
    const toParse = file || selectedFile
    if (!toParse) {
      setErrorMessage('No file selected to preview.')
      return
    }

    setIsParsing(true)
    setRows([])
    setPreviewRows([])
    setImportSummary(null)
    setErrorMessage('')

    Papa.parse(toParse, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const normalizedRows = (result.data || [])
          .map((row, index) => ({
            rowNumber: index + 2,
            ...row,
          }))
          .filter((row) => !isEmptyImportRow(row))

        setRows(normalizedRows)
        setPreviewRows(normalizedRows.slice(0, 10))
        setIsParsing(false)
      },
      error: (parseError) => {
        setErrorMessage(parseError.message || 'Unable to parse the CSV file.')
        setIsParsing(false)
      },
    })
  }

  const handleImport = async () => {
    if (!rows.length) {
      setErrorMessage('Please upload a CSV file first.')
      return
    }

    setIsImporting(true)
    setErrorMessage('')
    setImportSummary(null)

    let addedCount = 0
    const errors = []

    for (const row of rows) {
      const rowErrors = []
      const partName = (row.part_name || '').toString().trim()
      const oemNumber = (row.oem_number || '').toString().trim() || null
      const category = (row.category || '').toString().trim()
      const condition = (row.condition || '').toString().trim().toLowerCase()
      const cost = Number(row.cost)
      const currency = (row.currency || 'AED').toString().trim().toUpperCase()
      const askingPrice = Number(row.asking_price)
      const donorMake = (row.donor_vehicle_make || '').toString().trim()
      const donorModel = (row.donor_vehicle_model || '').toString().trim()
      const donorYear = (row.donor_vehicle_year || '').toString().trim()
      const branchName = (row.branch_name || '').toString().trim()

      if (!partName) rowErrors.push('Missing required field: part_name')
      if (!category) rowErrors.push('Missing required field: category')
      if (!Number.isFinite(cost)) rowErrors.push('Invalid cost value')
      if (!validCurrencies.includes(currency)) rowErrors.push('Invalid currency value')
      if (!Number.isFinite(askingPrice)) rowErrors.push('Invalid asking_price value')
      if (!validConditions.includes(condition)) rowErrors.push('Invalid condition value')
      if (!donorMake || !donorModel || !donorYear) rowErrors.push('Missing donor vehicle details')

      if (canManageBranches && !branchName) rowErrors.push('Missing branch_name for company admin import')

      if (rowErrors.length) {
        errors.push({ rowNumber: row.rowNumber, message: rowErrors.join('; ') })
        continue
      }

      let targetBranchId = currentStaff.branch_id

      if (canManageBranches) {
        const branchMatch = branches.find((branch) => branch.name.toLowerCase() === branchName.toLowerCase())
        if (!branchMatch) {
          errors.push({ rowNumber: row.rowNumber, message: `Branch not found: ${branchName}` })
          continue
        }
        targetBranchId = branchMatch.id
      }

      const { data: existingVehicle, error: vehicleLookupError } = await supabase
        .from('donor_vehicles')
        .select('id')
        .eq('company_id', currentStaff.company_id)
        .eq('branch_id', targetBranchId)
        .eq('make', donorMake)
        .eq('model', donorModel)
        .eq('year', Number(donorYear))
        .is('deleted_at', null)
        .maybeSingle()

      if (vehicleLookupError) {
        errors.push({ rowNumber: row.rowNumber, message: vehicleLookupError.message })
        continue
      }

      let donorVehicleId = existingVehicle?.id

      if (!donorVehicleId) {
        const { data: newVehicle, error: vehicleInsertError } = await supabase
          .from('donor_vehicles')
          .insert([
            {
              company_id: currentStaff.company_id,
              branch_id: targetBranchId,
              make: donorMake,
              model: donorModel,
              year: Number(donorYear),
            },
          ])
          .select('id')
          .single()

        if (vehicleInsertError || !newVehicle?.id) {
          errors.push({ rowNumber: row.rowNumber, message: vehicleInsertError?.message || 'Unable to create donor vehicle' })
          continue
        }

        donorVehicleId = newVehicle.id
      }

      const { error: partInsertError } = await supabase.from('parts').insert([
        {
          company_id: currentStaff.company_id,
          branch_id: targetBranchId,
          part_name: partName,
          oem_number: oemNumber,
          category,
          condition,
          cost: Number(cost),
          currency,
          asking_price: Number(askingPrice),
          donor_vehicle_id: donorVehicleId,
          status: 'in_stock',
        },
      ])

      if (partInsertError) {
        errors.push({ rowNumber: row.rowNumber, message: partInsertError.message })
      } else {
        addedCount += 1
      }
    }

    setImportSummary({ addedCount, errors })
    setIsImporting(false)
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Bulk Import Parts</h1>
              <p className="mt-2 text-sm text-slate-400">
                Upload a CSV to create parts and donor vehicles in one step.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadTemplate} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400">
                Download Template
              </button>
              <Link to="/parts" className="rounded-lg border border-slate-700 px-4 py-2 font-semibold text-slate-200 transition hover:bg-slate-800">
                Back to Spare Parts
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Import steps</h2>
              <div className="mt-3 flex flex-wrap items-start gap-3 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-800 text-slate-200 grid place-items-center font-semibold">1</div>
                  <div>Download the template</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-800 text-slate-200 grid place-items-center font-semibold">2</div>
                  <div>Fill in your parts</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-800 text-slate-200 grid place-items-center font-semibold">3</div>
                  <div>Upload it below</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-800 text-slate-200 grid place-items-center font-semibold">4</div>
                  <div>Review the preview</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-6 w-6 rounded-full bg-slate-800 text-slate-200 grid place-items-center font-semibold">5</div>
                  <div>Confirm import</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 md:mt-6">
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={handleBrowse}
              className="cursor-pointer rounded-xl border-2 border-dashed border-slate-700 bg-slate-950/60 px-4 py-8 text-center text-slate-300 hover:bg-slate-900/70 transition"
            >
              {selectedFile ? (
                <div className="mx-auto flex items-center gap-4">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-emerald-400" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-emerald-400">✓ {fileName} selected</p>
                    <p className="text-xs text-slate-400">Click to change</p>
                  </div>
                </div>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="mx-auto h-8 w-8 text-cyan-400" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16v2a2 2 0 002 2h6a2 2 0 002-2v-2" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 12v6m0-6l3 3m-3-3L9 15" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7V5a3 3 0 00-3-3H11a3 3 0 00-3 3v2" />
                  </svg>
                  <p className="mt-3 text-sm font-semibold text-slate-200">Drag CSV here or click to browse</p>
                  <p className="mt-1 text-xs text-slate-500">Only .csv files — first row must be headers</p>
                </>
              )}
              <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </div>

            <div className="mt-3 flex items-center justify-end">
              <div className="flex gap-3">
                <button type="button" onClick={() => handleParseSelectedFile()} disabled={!selectedFile || isParsing} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed">
                  {isParsing ? 'Parsing...' : 'Preview Import'}
                </button>
              </div>
            </div>

            {isParsing ? <p className="mt-2 text-sm text-cyan-400">Parsing CSV preview...</p> : null}
            {errorMessage ? <p className="mt-2 text-sm text-red-400">{errorMessage}</p> : null}

            <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-400">
              <p className="font-semibold text-cyan-400">Template format</p>
              <p className="mt-1">Download the template above to see the required headers and one example row.</p>
            </div>
          </div>
        </div>

        {previewRows.length ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-semibold">Preview (first 10 rows)</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                <thead className="bg-slate-950/70 text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Row</th>
                    <th className="px-4 py-3 font-medium">Part</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Condition</th>
                    <th className="px-4 py-3 font-medium">Cost</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/70">
                  {previewRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-4 py-3">{row.rowNumber}</td>
                      <td className="px-4 py-3">{row.part_name || '—'}</td>
                      <td className="px-4 py-3">{row.category || '—'}</td>
                      <td className="px-4 py-3">{row.condition || '—'}</td>
                      <td className="px-4 py-3">{row.cost || '—'}</td>
                      <td className="px-4 py-3">{row.branch_name || (canManageBranches ? '—' : 'Your branch')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {rows.length ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Ready to import</h2>
                <p className="mt-1 text-sm text-slate-400">{rows.length} rows loaded from the CSV.</p>
              </div>
              <button type="button" onClick={handleImport} disabled={isImporting} className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
                {isImporting ? 'Importing...' : 'Confirm Import'}
              </button>
            </div>

            {importSummary ? (
              <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm text-emerald-400">{importSummary.addedCount} parts added, {importSummary.errors.length} errors</p>
                {importSummary.errors.length ? (
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {importSummary.errors.map((error) => (
                      <li key={`${error.rowNumber}-${error.message}`} className="rounded-lg border border-slate-800 px-3 py-2">
                        <span className="font-semibold text-white">Row {error.rowNumber}</span>: {error.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  )
}

export default PartsImport
