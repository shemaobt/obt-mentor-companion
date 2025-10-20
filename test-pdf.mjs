import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
console.log('Type:', typeof pdfParse);
console.log('Keys:', Object.keys(pdfParse));
console.log('Is function?:', typeof pdfParse === 'function');
if (typeof pdfParse === 'function') {
  console.log('✓ pdfParse is a function');
} else {
  console.log('✗ pdfParse is NOT a function');
}
