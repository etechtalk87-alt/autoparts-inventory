import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabaseClient'

export default function RefundModal({ sale, currentStaff, onClose, onRefundComplete }) {
  const { t } = useTranslation()
  const [refundAmount, setRefundAmount] = useState('')
  const [reason, setReason] = useState('')
  const [partCondition, setPartCondition] = useState('resellable')
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')

  const alreadyRefunded = Number(sale?.refunded_amount || 0)
  const salePrice = Number(sale?.sale_price || 0)
  const maxRefundable = Math.max(0, salePrice - alreadyRefunded)
  const displayCurrency = sale?.currency || 'AED'

  useEffect(() => {
    if (!sale) return
    setRefundAmount(maxRefundable > 0 ? maxRefundable.toFixed(2) : '')
    setReason('')
    setPartCondition('resellable')
    setMessage('')
  }, [sale?.id])

  if (!sale) return null

  const handleConfirm = async () => {
    const amount = Number(refundAmount)

    if (!amount || amount <= 0) {
      setMessage(t('sales.enterValidRefundAmount'))
      return
    }
    if (amount > maxRefundable) {
      setMessage(
        t('sales.refundExceedsMax', {
          currency: displayCurrency,
          max: maxRefundable.toFixed(2),
        })
      )
      return
    }

    setProcessing(true)
    setMessage('')

    const { error: refundError } = await supabase.from('refunds').insert([{
      company_id: currentStaff.company_id,
      sale_id: sale.id,
      part_id: sale.part_id,
      amount,
      currency: sale.currency || sale.parts?.currency || 'AED',
      reason: reason.trim() || null,
      part_condition_on_return: partCondition,
      processed_by: currentStaff.id,
    }])

    if (refundError) {
      setMessage(refundError.message)
      setProcessing(false)
      return
    }

    const newRefundedTotal = alreadyRefunded + amount

    const { error: saleUpdateError } = await supabase
      .from('sales')
      .update({ refunded_amount: newRefundedTotal })
      .eq('id', sale.id)

    if (saleUpdateError) {
      setMessage(
        t('sales.refundRecordedButFailed', {
          error: saleUpdateError.message,
        })
      )
      setProcessing(false)
      return
    }

    if (sale.part_id) {
      const newPartStatus = partCondition === 'resellable' ? 'in_stock' : 'scrapped'
      const { error: partUpdateError } = await supabase
        .from('parts')
        .update({ status: newPartStatus })
        .eq('id', sale.part_id)

      if (partUpdateError) {
        console.error('Failed to update part status after refund:', partUpdateError)
      }
    }

    setProcessing(false)
    onRefundComplete?.({ saleId: sale.id, newRefundedTotal, partCondition })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/30">
        <h3 className="text-xl font-semibold">{t('sales.processReturn')}</h3>
        <p className="mt-2 text-sm text-slate-400">
          {t('sales.refundOriginalSale')} {displayCurrency} {salePrice.toFixed(2)}
          {alreadyRefunded > 0 ? (
            <> {t('sales.refundAlreadyRefunded')} {displayCurrency} {alreadyRefunded.toFixed(2)}</>
          ) : null}
        </p>

        {maxRefundable <= 0 ? (
          <p className="mt-4 text-sm text-amber-400">{t('sales.refundFullyRefundedNote')}</p>
        ) : (
          <>
            <label className="mt-4 block text-sm text-slate-300">
              {t('sales.refundAmountLabel', { currency: displayCurrency, max: maxRefundable.toFixed(2) })}
              <input
                type="number"
                min="0"
                max={maxRefundable}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              />
            </label>

            <label className="mt-4 block text-sm text-slate-300">
              {t('sales.refundReasonLabel')}
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('sales.refundReasonPlaceholder')}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none"
              />
            </label>

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-slate-300">{t('sales.partConditionOnReturn')}</legend>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="partCondition"
                    value="resellable"
                    checked={partCondition === 'resellable'}
                    onChange={(e) => setPartCondition(e.target.value)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-300">{t('sales.conditionResellable')}</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="partCondition"
                    value="damaged"
                    checked={partCondition === 'damaged'}
                    onChange={(e) => setPartCondition(e.target.value)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-300">{t('sales.conditionDamaged')}</span>
                </label>
              </div>
            </fieldset>
          </>
        )}

        {message ? <p className="mt-4 text-sm text-red-400">{message}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition hover:bg-slate-600"
          >
            {t('sales.cancel')}
          </button>
          {maxRefundable > 0 && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={processing}
              className="rounded-lg bg-rose-500 px-4 py-2 font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {processing ? t('sales.processing') : t('sales.confirmRefund')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}