const fs = require('fs');
const path = require('path');

const jsxPath = path.join(__dirname, 'src', 'pages', 'CreateInvoice.jsx');
const layoutPath = path.join(__dirname, 'new_layout.txt');

const jsxText = fs.readFileSync(jsxPath, 'utf-8');
const layoutText = fs.readFileSync(layoutPath, 'utf-8');

// Find start of the old return block
let startIdx = jsxText.indexOf('  return (\n    <main className="min-h-screen');
if (startIdx === -1) {
    startIdx = jsxText.indexOf('  return (\n');
}

// Extract modal
const modalStart = jsxText.indexOf('{showCustomerModal ? (');
const modalEndStr = '            <div className="space-y-4 rounded-[1.75rem] border border-slate-700 bg-slate-950/95 p-5 shadow-sm shadow-black/10">';
let modalEnd = jsxText.indexOf(modalEndStr);
if (modalStart === -1 || modalEnd === -1) {
    console.error("Could not extract modal code.");
    process.exit(1);
}

// Rewind to capture the closing tags properly (back up to the </div> before it)
modalEnd = jsxText.lastIndexOf('</div>', modalEnd);

const modalCode = jsxText.substring(modalStart, modalEnd).trim();

// Replace placeholder
const finalLayout = layoutText.replace('__CUSTOMER_MODAL_PLACEHOLDER__', modalCode);

// Write output
const finalFile = jsxText.substring(0, startIdx) + finalLayout + '\n';
fs.writeFileSync(jsxPath, finalFile, 'utf-8');
console.log("Successfully rebuilt CreateInvoice.jsx");
