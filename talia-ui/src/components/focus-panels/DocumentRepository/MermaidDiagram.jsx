/**
 * Draws a Mermaid block the way Cursor's Markdown preview does.
 * The source stays in the document; this only renders it.
 */

import React, { useEffect, useId, useRef, useState } from 'react';

const configure = async (securityLevel = 'strict') => {
  const mermaid = (await import('mermaid')).default;
  // Always re-initialize: PDF export and Document Repository share the singleton
  // and may flip securityLevel / themeVariables between renders.
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel,
    fontFamily: 'inherit',
    suppressErrorRendering: true,
  });
  return mermaid;
};

/**
 * @param {string} source
 * @param {'strict'|'loose'|'antiscript'} [securityLevel='strict']
 *   Use `loose` when the diagram includes Mermaid `click` callbacks.
 */
const MermaidDiagram = ({ source, securityLevel = 'strict' }) => {
  const reactId = useId().replace(/:/g, '');
  const hostRef = useRef(null);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const bindFunctionsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSvg('');
    setError('');
    bindFunctionsRef.current = null;
    configure(securityLevel)
      .then((mermaid) => mermaid.render(`pd-mermaid-${reactId}`, String(source || '')))
      .then((result) => {
        if (cancelled) return;
        bindFunctionsRef.current = result?.bindFunctions || null;
        setSvg(result?.svg || '');
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'This diagram could not be drawn');
      });
    return () => {
      cancelled = true;
    };
  }, [source, reactId, securityLevel]);

  useEffect(() => {
    if (!svg || !hostRef.current || !bindFunctionsRef.current) return;
    try {
      bindFunctionsRef.current(hostRef.current);
    } catch {
      // Ignore bind failures; DOM click fallback may still work for lineage.
    }
  }, [svg]);

  if (error) {
    return (
      <pre className="lang-mermaid">
        <span className="pd-code-lang">Diagram</span>
        <code>{source}</code>
      </pre>
    );
  }
  if (!svg) return <p className="pd-mermaid pd-mermaid--pending">Drawing diagram…</p>;
  return (
    <div
      ref={hostRef}
      className="pd-mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default MermaidDiagram;
