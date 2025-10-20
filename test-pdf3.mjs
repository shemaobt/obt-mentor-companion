import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const pdfParseModule = require('pdf-parse');

console.log('typeof PDFParse:', typeof pdfParseModule.PDFParse);
console.log('PDFParse.toString():', pdfParseModule.PDFParse.toString().substring(0, 100));

// Test if it's the main export function
const mainExport = pdfParseModule;
console.log('\nTesting if module itself is callable...');
console.log('typeof pdfParseModule:', typeof pdfParseModule);

// Check npm package.json or readme for usage
try {
  const pkgPath = require.resolve('pdf-parse/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  console.log('\nPackage main:', pkg.main);
} catch(e) {
  console.log('Could not read package.json');
}
