#!/usr/bin/env node

/**
 * PDF Generator for Executive Overview
 * 
 * Converts EXECUTIVE-OVERVIEW.md to PDF using markdown-pdf
 * 
 * Prerequisites:
 *   npm install -g markdown-pdf
 * 
 * Or use the local version:
 *   npm install markdown-pdf --save-dev
 * 
 * Usage:
 *   node scripts/generate-pdf.js
 *   npm run generate:overview:pdf
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function checkCommand(command) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function generatePDF() {
  const overviewPath = path.join(rootDir, 'EXECUTIVE-OVERVIEW.md');
  const outputPath = path.join(rootDir, 'EXECUTIVE-OVERVIEW.pdf');
  
  if (!fs.existsSync(overviewPath)) {
    console.error('❌ EXECUTIVE-OVERVIEW.md not found!');
    console.error('   Run: npm run generate:overview');
    process.exit(1);
  }

  console.log('📄 Generating PDF from Executive Overview...');

  // Try different PDF generation methods
  const methods = [
    {
      name: 'pandoc',
      command: `pandoc "${overviewPath}" -o "${outputPath}" --pdf-engine=xelatex -V geometry:margin=1in`,
      check: () => checkCommand('pandoc')
    },
    {
      name: 'markdown-pdf (local)',
      command: `npx markdown-pdf "${overviewPath}" -o "${outputPath}"`,
      check: () => {
        try {
          const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
          return pkg.devDependencies?.['markdown-pdf'] || pkg.dependencies?.['markdown-pdf'];
        } catch {
          return false;
        }
      }
    },
    {
      name: 'markdown-pdf (global)',
      command: `markdown-pdf "${overviewPath}" -o "${outputPath}"`,
      check: () => checkCommand('markdown-pdf')
    }
  ];

  for (const method of methods) {
    if (method.check()) {
      try {
        console.log(`   Trying ${method.name}...`);
        execSync(method.command, { stdio: 'inherit', cwd: rootDir });
        console.log(`✅ PDF generated successfully using ${method.name}!`);
        console.log(`📄 Output: ${outputPath}`);
        return;
      } catch (error) {
        console.warn(`   ${method.name} failed, trying next method...`);
        continue;
      }
    }
  }

  console.error('\n❌ No PDF generation method available!');
  console.error('\n📦 Install one of the following:');
  console.error('   1. pandoc: brew install pandoc (macOS) or apt-get install pandoc (Linux)');
  console.error('   2. markdown-pdf: npm install -g markdown-pdf');
  console.error('   3. Or use gamma.app (see EXECUTIVE-OVERVIEW-GUIDE.md)');
  process.exit(1);
}

generatePDF();

