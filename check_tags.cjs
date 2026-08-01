const fs = require('fs');
const text = fs.readFileSync('src/pages/CreateInvoice.jsx', 'utf-8');

const openTags = [];
const regex = /<\/?([A-Za-z0-9_]+)[^>]*?(\/?)>/g;
let match;
while ((match = regex.exec(text)) !== null) {
    const isClosing = match[0].startsWith('</');
    const isSelfClosing = match[2] === '/';
    const tagName = match[1];

    if (!isClosing && !isSelfClosing && tagName !== 'input' && tagName !== 'img' && tagName !== 'br' && tagName !== 'hr' && tagName !== 'circle' && tagName !== 'path') {
        openTags.push({ name: tagName, line: text.substring(0, match.index).split('\n').length });
    } else if (isClosing) {
        if (openTags.length > 0 && openTags[openTags.length - 1].name === tagName) {
            openTags.pop();
        } else {
            console.log(`Mismatch: closing </${tagName}> at line ${text.substring(0, match.index).split('\n').length}, expected </${openTags.length > 0 ? openTags[openTags.length - 1].name : 'nothing'}>`);
        }
    }
}

if (openTags.length > 0) {
    console.log("Unclosed tags:", openTags);
} else {
    console.log("All tags closed!");
}
