const fs = require('fs');

const text = fs.readFileSync('src/pages/CreateInvoice.jsx', 'utf-8');
let braces = 0;
let parens = 0;
let tags = 0;

for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '{') braces++;
    if (c === '}') braces--;
    if (c === '(') parens++;
    if (c === ')') parens--;
}

console.log(`Braces: ${braces}, Parens: ${parens}`);
