#!/usr/bin/env node

/**
 * PDF Generator for Executive Overview (delegates to Chrome headless script).
 *
 * Usage:
 *   node scripts/generate-pdf.js
 *   npm run generate:overview:pdf
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(__dirname, 'generate-executive-overview-pdf.sh');

execSync(`bash "${script}"`, { stdio: 'inherit' });
