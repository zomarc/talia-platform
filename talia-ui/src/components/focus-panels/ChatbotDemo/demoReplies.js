/**
 * Local chatbot demo. Replies are random lines from a text file on this machine.
 * No network and no live booking data.
 */

import quotesText from './art-of-war-quotes.txt?raw';
import { parseQuotes, randomQuote } from './quotePicker.js';

export const DEMO_PROMPTS = [
  'What were the biggest movers last week?',
  'Show me the sailings that need the most attention in May?',
];

export const DEMO_WELCOME = 'This is a demonstration of a future assistant. For fun, every reply is a line from Sun Tzu, The Art of War. Nothing here is connected to bookings.';

const QUOTES = parseQuotes(quotesText);

export const demoChatReply = ({ avoid = '', random = Math.random } = {}) => (
  randomQuote(QUOTES, { avoid, random })
);
