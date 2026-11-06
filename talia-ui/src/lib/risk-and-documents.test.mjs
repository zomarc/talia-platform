import assert from 'node:assert/strict';
import { assetIdsInMarkdown, parseMarkdown } from './markdownLite.js';
import { buildDocumentTree, buildProjectDocumentExport, nextDocumentReference } from './projectDocument.js';
import { buildRiskRegisterExport, nextRiskReference, riskBand } from './riskRegister.js';

assert.equal(riskBand(1, 1), 'low');
assert.equal(riskBand(2, 2), 'low');
assert.equal(riskBand(3, 2), 'medium');
assert.equal(riskBand(3, 4), 'high');
assert.equal(riskBand(4, 4), 'high');
assert.equal(riskBand(5, 4), 'critical');
assert.equal(riskBand(5, 5), 'critical');
assert.equal(riskBand(0, 3), 'low');

assert.equal(nextRiskReference([{ referenceCode: 'RK001' }, { referenceCode: 'RK009' }]), 'RK010');
assert.equal(nextDocumentReference([{ referenceCode: 'D002' }]), 'D003');
assert.equal(nextDocumentReference([{ referenceCode: 'D006' }, { referenceCode: 'D006-1' }]), 'D007');

const blocks = parseMarkdown('# Title\n\nSee <script> and **bold**.\n\n- one\n- two\n\n![](asset:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)\n\n[ok](https://example.com) [no](javascript:alert(1))');
assert.equal(blocks[0].type, 'h1');
assert.equal(blocks[0].inlines[0].text, 'Title');
assert.equal(blocks[1].type, 'p');
assert.equal(blocks[1].inlines[0].text.includes('<script>'), true);
assert.equal(blocks[1].inlines.some((token) => token.type === 'strong' && token.text === 'bold'), true);
assert.equal(blocks[2].type, 'ul');
assert.equal(blocks[2].items.length, 2);
assert.equal(blocks[3].inlines[0].type, 'image');
assert.equal(blocks[4].inlines.some((token) => token.type === 'link'), true);
assert.equal(blocks[4].inlines.some((token) => token.type === 'text' && token.text === 'no'), true);

const rich = parseMarkdown(`---
name: Plan
---

## Product intent

1. **Find** groups
2. Show impact

- parent
  - child

| Term | Meaning |
| --- | --- |
| **MR** | rate |

\`\`\`mermaid
flowchart TB
  A --> B
\`\`\`

---

See group_probability and \`useTable\`.
`);
assert.equal(rich[0].type, 'h2');
assert.equal(rich[0].inlines[0].text, 'Product intent');
assert.equal(rich[1].type, 'ol');
assert.equal(rich[1].items[0].inlines.some((token) => token.type === 'strong' && token.text === 'Find'), true);
assert.equal(rich[2].type, 'ul');
assert.equal(rich[2].items[0].children.type, 'ul');
assert.equal(rich[2].items[0].children.items[0].inlines[0].text, 'child');
assert.equal(rich[3].type, 'table');
assert.equal(rich[3].header.length, 2);
assert.equal(rich[3].rows[0][0].some((token) => token.type === 'strong'), true);
assert.equal(rich[4].type, 'code');
assert.equal(rich[4].lang, 'mermaid');
assert.equal(rich[4].text.includes('flowchart TB'), true);
assert.equal(rich[5].type, 'hr');
assert.equal(rich[6].type, 'p');
assert.equal(rich[6].inlines.some((token) => token.type === 'em'), false);
assert.equal(rich[6].inlines.some((token) => token.type === 'code' && token.text === 'useTable'), true);

assert.deepEqual(
  assetIdsInMarkdown('![](asset:AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE)'),
  ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
);

const riskPack = buildRiskRegisterExport([{
  referenceCode: 'RK001',
  title: 'Interface',
  likelihood: 4,
  impact: 4,
  category: 'supplier',
  proximity: 'immediate',
  status: 'open',
  response: 'reduce',
  links: [],
}]);
assert.equal(riskPack.RiskRegisterExport.risks[0].band, 'high');

const docPack = buildProjectDocumentExport([{
  referenceCode: 'D001',
  title: 'Note',
  body: 'See ![](asset:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee)',
  links: [],
}]);
assert.deepEqual(docPack.ProjectDocumentExport.documents[0].assetIds, ['aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee']);

const tree = buildDocumentTree([
  { id: 'a', referenceCode: 'D002', title: 'Later', isStarred: true, links: [{ targetKind: 'risk', targetId: 'rk', label: 'RK001 Interface' }] },
  { id: 'b', referenceCode: 'D001', title: 'Note', links: [{ targetKind: 'risk', targetId: 'rk', label: 'RK001 Interface' }] },
  { id: 'c', referenceCode: 'D003', title: 'Loose', links: [] },
]);
assert.deepEqual(tree.map((group) => group.id), ['starred', 'risk', 'unlinked']);
assert.deepEqual(tree[0].folders[0].documents.map((doc) => doc.referenceCode), ['D002']);
assert.deepEqual(tree[1].folders[0].documents.map((doc) => doc.referenceCode), ['D002', 'D001']);
assert.equal(tree[2].folders[0].label, null);
assert.equal(tree[2].folders[0].documents[0].referenceCode, 'D003');

console.log('risk-and-documents.test.mjs ok');
