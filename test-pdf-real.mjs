import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);

// Try different ways to use pdf-parse
console.log('=== Testing pdf-parse ===');

const pdfParseModule = require('pdf-parse');
console.log('\n1. Module exports:', Object.keys(pdfParseModule));
console.log('2. Default export type:', typeof pdfParseModule);
console.log('3. PDFParse type:', typeof pdfParseModule.PDFParse);

// Check if the module has a README or docs
const pkgDir = require.resolve('pdf-parse').replace(/\/dist\/.*$/, '');
console.log('\n4. Package directory:', pkgDir);

// Try to find usage example
try {
  const readmePath = pkgDir + '/README.md';
  const readme = readFileSync(readmePath, 'utf8');
  const usageMatch = readme.match(/## Usage[\s\S]{0,500}/);
  if (usageMatch) {
    console.log('\n5. Usage from README:\n', usageMatch[0]);
  }
} catch(e) {
  console.log('No README found');
}
