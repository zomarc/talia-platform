import {
  buildPrintMastheadHtml,
  ensurePrintDocumentChrome,
  formatPrintTimestamp,
} from './printDocumentChrome.js';

const when = formatPrintTimestamp(new Date('2026-11-03T13:40:00'));
if (!when.includes('2026')) throw new Error('timestamp should include year');

const mast = buildPrintMastheadHtml({ generatedAt: when, documentTitle: 'Demo' });
if (!mast.includes('talia-print-masthead')) throw new Error('masthead missing class');
if (!mast.includes('TALIA')) throw new Error('masthead missing brand word');
if (!mast.includes('Demo')) throw new Error('masthead missing doc title');

const raw = `<!doctype html><html><head><title>x</title></head><body><h1>Hello</h1></body></html>`;
const withChrome = ensurePrintDocumentChrome(raw, { generatedAt: when, documentTitle: 'Hello' });
if (!withChrome.includes('talia-print-masthead')) throw new Error('chrome not injected');
if (!withChrome.includes('talia-print-brand')) throw new Error('brand svg missing');
const headerCount = (html) => (html.match(/<header class="talia-print-masthead"/g) || []).length;
if (headerCount(withChrome) !== 1) throw new Error('chrome should inject one header');

const again = ensurePrintDocumentChrome(withChrome, { generatedAt: when });
if (headerCount(again) !== 1) throw new Error('chrome inject must be idempotent');

const branded = ensurePrintDocumentChrome(
  '<!doctype html><html><body><svg class="talia-brand-mark"></svg><h1>PS</h1></body></html>',
);
if (branded.includes('talia-print-masthead')) {
  throw new Error('should not double-brand documents that already have talia-brand-mark');
}

console.log('printDocumentChrome.test.mjs ok');
