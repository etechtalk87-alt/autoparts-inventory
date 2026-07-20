-- Outstanding receivables for the dashboard.
-- One row per company/branch/currency. The Dashboard expects:
--   company_id, branch_id, currency, total_outstanding
--
-- Source of truth is sales.amount_paid. Payments linked to a sale update
-- sales.amount_paid in the app, so this view avoids double-counting payments.
CREATE OR REPLACE VIEW dashboard_outstanding_receivables AS
SELECT
  s.company_id,
  s.branch_id,
  COALESCE(p.currency, 'AED') AS currency,
  SUM(
    GREATEST(
      COALESCE(s.sale_price, 0) - COALESCE(s.amount_paid, 0),
      0
    )
  ) AS total_outstanding
FROM sales s
LEFT JOIN parts p ON p.id = s.part_id
WHERE s.payment_status IN ('partial', 'credit', 'unpaid')
GROUP BY s.company_id, s.branch_id, COALESCE(p.currency, 'AED');
