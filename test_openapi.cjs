const https = require('https');

const options = {
  hostname: 'kvxjguebdudqukjkkyyr.supabase.co',
  path: '/rest/v1/',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2eGpndWViZHVkcXVramtreXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxOTM1MzMsImV4cCI6MjA5OTc2OTUzM30.wh30Kgopo0lB0W0hMbHI5ii4oaI2INxO-8KKjQVRkw4'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const json = JSON.parse(data);
    const schema = json.components ? json.components.schemas || {} : json.definitions || {};
    const view = schema['dashboard_outstanding_receivables'];
    if (view) {
      console.log(view.properties);
    } else {
      console.log(Object.keys(schema).filter(k => k.includes('outstanding') || k.includes('receivable')));
    }
  });
});

req.end();
