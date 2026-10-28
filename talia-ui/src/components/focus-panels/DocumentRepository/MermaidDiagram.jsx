/**
 * Draws a Mermaid block the way Cursor's Markdown preview does.
 * The source stays in the document; this only renders it.
 */

import React, { useEffect, useId, useState } from 'react';

let configured = false;

const configure = async () => {
  const mermaid = (await import('mermaid')).default;
  if (!configured) {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'strict',
      fontFamily: 'inherit',
      suppressErrorRendering: true,
    });
    configured = true;
  }
  return mermaid;
};

const MermaidDiagram = ({ source }) => {
  const reactId = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSvg('');
    setError('');
    configure()
      .then((mermaid) => mermaid.render(`pd-mermaid-${reactId}`, String(source || '')))
      .then((result) => {
        if (!cancelled) setSvg(result?.svg || '');
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'This diagram could not be drawn');
      });
    return () => {
      cancelled = true;
    };
  }, [source, reactId]);

  if (error) {
    return (
      <pre className="lang-mermaid">
        <span className="pd-code-lang">Diagram</span>
        <code>{source}</code>
      </pre>
    );
  }
  if (!svg) return <p className="pd-mermaid pd-mermaid--pending">Drawing diagram…</p>;
  return <div className="pd-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
};

export default MermaidDiagram;
