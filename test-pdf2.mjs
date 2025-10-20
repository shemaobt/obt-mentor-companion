import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

// Test if it's a function
console.log('Main export type:', typeof pdf);
console.log('Has default?:', 'default' in pdf);

// Check if there's a default export
if (pdf.default) {
  console.log('Default type:', typeof pdf.default);
}

// List first-level function exports
Object.keys(pdf).forEach(key => {
  if (typeof pdf[key] === 'function') {
    console.log(`${key}: function`);
  }
});
