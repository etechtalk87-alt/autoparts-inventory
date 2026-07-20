-- Create payments table for tracking standalone payments not tied to a specific sale
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AED' CHECK (currency IN ('AED', 'USD')),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  recorded_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON payments(recorded_by);

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: company_admin and branch_staff can select payments for their company
CREATE POLICY "Select payments for own company" ON payments
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM staff WHERE id = auth.uid()
  ));

-- RLS Policy: company_admin and branch_staff can insert payments for their company
CREATE POLICY "Insert payments for own company" ON payments
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM staff WHERE id = auth.uid()
  ));

-- RLS Policy: company_admin can update payments for their company
CREATE POLICY "Update payments for own company" ON payments
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM staff WHERE id = auth.uid() AND role = 'company_admin'
  ));
