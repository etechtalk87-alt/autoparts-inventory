-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  country TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for company_id
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: company_admin and branch_staff can select customers for their company
CREATE POLICY "Select customers for own company" ON customers
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM staff WHERE id = auth.uid()
  ));

-- RLS Policy: company_admin and branch_staff can insert customers for their company
CREATE POLICY "Insert customers for own company" ON customers
  FOR INSERT WITH CHECK (company_id IN (
    SELECT company_id FROM staff WHERE id = auth.uid()
  ));

-- RLS Policy: company_admin can update customers for their company
CREATE POLICY "Update customers for own company" ON customers
  FOR UPDATE USING (company_id IN (
    SELECT company_id FROM staff WHERE id = auth.uid() AND role = 'company_admin'
  ));
