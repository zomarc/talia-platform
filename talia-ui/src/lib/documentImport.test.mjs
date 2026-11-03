import assert from 'node:assert/strict';
import { importDocumentFile, importTextFile, textToMarkdown } from './documentImport.js';

const PR_PASTE = `Group & Allotment PR%
Historical Calculation & Fallback Methodology
Objective
Talia should recommend an appropriate PR% for each individual new or existing Group/Allotment ID, using historical
materialisation performance and actual cabin production.
The calculation should start with the most comparable historical business available. When insufficient observations
exist, Talia should progressively broaden the matching criteria using a defined fallback sequence.
Historical Data Requirements
Historical period
• Use the latest three full rolling years of historical data (a trailing 36-month period). If the data is not available
then as far back as is feasible.
• For each historical Group matching the defined criteria, Talia should retrieve the number of cabins blocked at the
relevant historical DTD, together with the final number of cabins actually materialised.
Minimum Required historical fields
Group/Allotment ID; Account ID and name
Market; Booking Type (Group or Allotment); Group Type
Matching Variable Bands
Days to Departure (DTD)
Band DTD range
1 0–29
2 30–59
3 60–89
10 540–719
11 720+
Departure period
Band Departure period
1 16 November – end February
2 March – April
Group size
Band Allocated cabins
1 0–8
2 9–20
3 21–40
Example — New Group
Assume the Inventory Controller requests an initial PR recommendation for the following Group:
Variable Value
Account Expedition Travel
Market USA
Booking Type Group
Group Type Religious
Product Iconic 4-night
Sailing date 1 November 2027
Departure month November
Group size 30 cabins
Booking status OF (quote accepted, deposit not received)
Calculation date 30 October 2026
DTD 367 days
Historical Matching & Fallback Decision Tree
Decision at every level
1. Filter qualifying historical Group/Allotment IDs using the criteria at the current level and the trailing 36-month
historical window.
2. Count unique IDs with usable point-in-time observations and known final outcomes.
3. If the sample meets the minimum reliability requirements, calculate the historical PR recommendation and
record the matching level.
4. Otherwise, proceed to the next fallback level.
Proposed fallback sequence
Level Matching logic / action
1 · Full match Account + Market + Booking Type + Group Type + Product + Exact departure month + Exact Group Size
+ OF/BK Status + DTD Band
2 · Broaden month Replace exact departure month with Departure Period Band; retain all other criteria.
3 · Broaden size Replace exact Group Size with Group Size Band; retain all other criteria.
Illustrative matching outcome
Level Unique historical IDs Decision
1 · Full match 2 Insufficient → Level 2
2 · Broaden month 3 Insufficient → Level 3
3 · Broaden size 5 Sufficient → Calculate PR
4–8 Not evaluated Stop at Level 3
Historical PR Calculation
Step A — Historical materialisation percentage
Calculate the historical PR% for the matched records.
Step B — Historical actual production
Analyse the actual number of cabins materialised.
Step C — Recency weighting
Give more weight to recent historical records across three rolling 12-month intervals. One illustrative weighting
scenario to back-test:
Rolling 12-month interval Illustrative weight
Oldest 12 months 20%
Middle 12 months 30%
Most recent 12 months 50%
Conversion into the Seaware PR%
Seaware assigns 100% materialisation to named cabins and applies the assigned PR% to the remaining unnamed
allocated cabins.
Testing approach
• These are the criteria we think will work however, this needs to be avalidated by back playing against historic
data and tuned accordingly.
`;

const result = textToMarkdown(PR_PASTE);
assert.equal(result.title, 'Group & Allotment PR%');
assert.match(result.body, /^# Group & Allotment PR%/m);
assert.match(result.body, /\*\*Historical Calculation & Fallback Methodology\*\*/);
assert.match(result.body, /^## Objective/m);
assert.match(result.body, /^## Historical Data Requirements/m);
assert.match(result.body, /^## Matching Variable Bands/m);
assert.match(result.body, /^## Example — New Group/m);
assert.match(result.body, /^## Historical PR Calculation/m);
assert.match(result.body, /^### Step A — Historical materialisation percentage/m);
assert.match(result.body, /^### Step B — Historical actual production/m);
assert.match(result.body, /- Use the latest three full rolling years/);
assert.match(result.body, /- Group\/Allotment ID/);
assert.match(result.body, /\| Band \| DTD range \|/);
assert.match(result.body, /\| 1 \| 0–29 \|/);
assert.match(result.body, /\| 11 \| 720\+ \|/);
assert.match(result.body, /\| Band \| Departure period \|/);
assert.match(result.body, /\| Band \| Allocated cabins \|/);
assert.match(result.body, /\| Variable \| Value \|/);
assert.match(result.body, /\| Account \| Expedition Travel \|/);
assert.match(result.body, /\| DTD \| 367 days \|/);
assert.match(result.body, /\| Level \| Matching logic \/ action \|/);
assert.match(result.body, /\| 1 · Full match \|/);
assert.match(result.body, /\| Level \| Unique historical IDs \| Decision \|/);
assert.match(result.body, /\| 3 · Broaden size \| 5 \| Sufficient/);
assert.match(result.body, /\| Rolling 12-month interval \| Illustrative weight \|/);
assert.match(result.body, /\| Most recent 12 months \| 50% \|/);
assert.match(result.body, /^1\. Filter qualifying historical/m);
assert.match(result.body, /^2\. Count unique IDs/m);
assert.match(result.body, /^3\. If the sample meets/m);
assert.match(result.body, /^4\. Otherwise, proceed/m);
assert.match(result.body, /materialisation performance and actual cabin production/);
assert.doesNotMatch(result.body, /historical\nmaterialisation/);

const empty = textToMarkdown('   ');
assert.equal(empty.title, 'Imported document');
assert.equal(empty.body, '');

const mdPassthrough = textToMarkdown('# Already MD\n\n## Section\n\n- one\n', { suggestedTitle: 'Override' });
assert.equal(mdPassthrough.title, 'Override');
assert.match(mdPassthrough.body, /^# Already MD/m);

const fakeTxt = {
  name: 'notes.txt',
  type: 'text/plain',
  text: async () => 'Simple Title\n\nA short paragraph that should stay a paragraph.',
};
const fromTxt = await importTextFile(fakeTxt);
assert.equal(fromTxt.title, 'Simple Title');
assert.match(fromTxt.body, /# Simple Title/);

const routed = await importDocumentFile({
  name: 'brief.md',
  type: 'text/markdown',
  text: async () => '# Brief\n\nHello.',
});
assert.equal(routed.title, 'brief');
assert.match(routed.body, /# Brief/);

console.log('documentImport.test.mjs: ok');
