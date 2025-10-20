import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

console.log('PDFParse:', PDFParse);
console.log('typeof PDFParse:', typeof PDFParse);

// Test instantiation
try {
  const parser = new PDFParse({});
  console.log('✓ Can instantiate PDFParse');
  console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
} catch(e) {
  console.log('✗ Cannot instantiate:', e.message);
}
