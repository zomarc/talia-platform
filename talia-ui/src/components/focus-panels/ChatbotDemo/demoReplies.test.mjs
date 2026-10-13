import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseQuotes, randomQuote } from './quotePicker.js';

const text = fs.readFileSync(new URL('./art-of-war-quotes.txt', import.meta.url), 'utf8');
const quotes = parseQuotes(text);

assert.ok(quotes.length >= 20, 'expected a local list of quotes');
assert.equal(quotes.some((line) => line.startsWith('#')), false);
assert.equal(randomQuote(quotes, { random: () => 0 }), quotes[0]);
assert.equal(randomQuote(quotes, { random: () => 0.999 }), quotes[quotes.length - 1]);
assert.notEqual(randomQuote(quotes, { random: () => 0, avoid: quotes[0] }), quotes[0]);

console.log(`demoReplies.test.mjs ok (${quotes.length} quotes)`);
