import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'

export default function TransferPartModal({ part, branches = [], currentStaff, onClose, onTransferComplete }) {
  const { t } = useTranslation()
  const [branchId, setBranchId] = useState('')
  const [transferring, setTransferring] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setBranchId('')
    setTransferring(false)
    setMessage('')
  }, [part?.id])

  if (!part) return null

  const confirmTransfer = async () => {
    if (!part || !branchId) {
      setMessage(t('parts.chooseDestination'))
      return
    }

    setTransferring(true)
    setMessage('')

    const { error: transferError } = await supabase.from('transfers').insert([
      {
        company_id: currentStaff?.company_id,
        from_branch_id: part.branch_id,
        to_branch_id: branchId,
        part_id: part.id,
        transferred_by: currentStaff?.id,
      },
    ])

    if (transferError) {
      setMessage(transferError.message)
      setTransferring(false)
      return
    }

    const { data: updateData, error: updateError } = await supabase
      .from('parts')
      .update({ branch_id: branchId })
      .eq('id', part.id)
      .select('id')

    if (updateError) {
      setMessage(updateError.message)
      setTransferring(false)
      return
    }

    if (!updateData || updateData.length === 0) {
      setMessage(t('parts.updateFailedPermission'))
      setTransferring(false)
      return
    }

    onTransferComplete?.(branchId)
    setTransferring(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/30">
        <h3 className="text-xl font-semibold">{t('parts.transferPart')}</h3>
        <p className="mt-2 text-sm text-slate-400">
          {t('parts.movePartTo', { partName: part.part_name })}
        </p>
        <label className="mt-4 block text-sm text-slate-300">
          {t('parts.destinationBranch')}
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
          >
            <option value="">{t('parts.selectDestinationBranch')}</option>
            {branches
              .filter((branch) => String(branch.id) !== String(part.branch_id))
              .map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
          </select>
        </label>
        {message ? <p className="mt-4 text-sm text-red-400">{message}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
          >
            {t('parts.cancel')}
          </button>
          <button
            type="button"
            onClick={confirmTransfer}
            disabled={transferring}
            className="rounded-lg bg-cyan-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {transferring ? t('parts.transferring') : t('parts.confirmTransfer')}
          </button>
        </div>
      </div>
    </div>
  )
}
