import {
  PRINT_DIAGRAM_CSS,
  printDiagramBand,
  printDiagramCard,
  printDiagramHFlow,
  printStatusLabel,
} from './printDiagramHtml.js';

if (printStatusLabel('blocked') !== 'BLOCKED') throw new Error('blocked label');
if (printStatusLabel('ok') !== 'OK') throw new Error('ok label');

const card = printDiagramCard({
  title: 'GraphQL',
  blurb: 'Control plane',
  address: 'localhost',
  state: 'ok',
  badge: 'COMMON',
});
if (!card.includes('pd-card__title')) throw new Error('card title');
if (!card.includes('pd-card__status')) throw new Error('card status row');
if (!card.includes('COMMON')) throw new Error('card badge');
if (!card.includes('OK')) throw new Error('card OK');

const band = printDiagramBand('Access', card);
if (!band.includes('pd-band__title')) throw new Error('band title');

const flow = printDiagramHFlow([
  { title: 'A', state: 'ok' },
  { title: 'B', state: 'warn' },
]);
if (!flow.includes('pd-hflow__arrow')) throw new Error('flow arrow');
if (!PRINT_DIAGRAM_CSS.includes('.pd-card')) throw new Error('css missing');

console.log('printDiagramHtml.test.mjs ok');
