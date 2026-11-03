/**
 * Browser pdf.js loader for document import (Vite worker URL).
 */

import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

let configured = false;

export function getPdfJs() {
  if (!configured) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
    configured = true;
  }
  return pdfjs;
}
