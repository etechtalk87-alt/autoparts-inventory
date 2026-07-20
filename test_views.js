import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kvxjguebdudqukjkkyyr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGpndWViZHVkcXVramtreXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxOTM1MzMsImV4cCI6MjA5OTc2OTUzM30.wh30Kgopo0lB0W0hMbHI5ii4oaI2INxO-8KKjQVRkw4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkViews() {
  const views = [
    'dashboard_total_invoices',
    'dashboard_donor_vehicles_this_month',
    'dashboard_parts_by_branch',
    'dashboard_branch_breakdown',
    'dashboard_sales_daily',
    'dashboard_outstanding_receivables'
  ];

  for (const view of views) {
    console.log(`\n--- ${view} ---`);
    const { data, error } = await supabase.from(view).select('*').limit(1);
    if (error) {
      console.error('Error:', error.message);
    } else {
      console.log('Columns:', data && data.length > 0 ? Object.keys(data[0]) : 'Empty data, but view exists');
      if (data && data.length > 0) console.log('Data:', data[0]);
    }
  }
}

checkViews();
