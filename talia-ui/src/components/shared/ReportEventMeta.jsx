import React, { useMemo, useState } from 'react';

const formatList = (items = []) => {
  if (!items || items.length === 0) {
    return ['—'];
  }
  return items;
};

const copyText = async (text) => {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy fallback.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

const ReportEventMeta = ({ emits = [], respondsTo = [], sources = [] }) => {
  const emitList = formatList(emits);
  const respondList = formatList(respondsTo);
  const sourceList = formatList(sources);
  const [copyStatus, setCopyStatus] = useState('');
  const copyPayload = useMemo(() => (
    [
      `Emits: ${emitList.join(', ')}`,
      `Accepts: ${respondList.join(', ')}`,
      `Sources: ${sourceList.join(', ')}`
    ].join('\n')
  ), [emitList, respondList, sourceList]);

  const handleCopySources = async () => {
    const success = await copyText(copyPayload);
    setCopyStatus(success ? 'Copied' : 'Copy failed');
    window.setTimeout(() => setCopyStatus(''), 1500);
  };

  return (
    <div className="talia-event-meta" role="note" aria-label="Report event contract">
      <div className="talia-event-meta__actions">
        <button type="button" className="talia-event-meta__copy-btn" onClick={handleCopySources}>
          Copy Sources
        </button>
        {copyStatus && <span className="talia-event-meta__copy-status">{copyStatus}</span>}
      </div>
      <div className="talia-event-meta__group">
        <span className="talia-event-meta__label">Emits</span>
        <div className="talia-event-meta__chips">
          {emitList.map((eventName) => (
            <span key={`emit-${eventName}`} className="talia-event-meta__chip">
              {eventName}
            </span>
          ))}
        </div>
      </div>
      <div className="talia-event-meta__group">
        <span className="talia-event-meta__label">Accepts</span>
        <div className="talia-event-meta__chips">
          {respondList.map((eventName) => (
            <span key={`respond-${eventName}`} className="talia-event-meta__chip talia-event-meta__chip--secondary">
              {eventName}
            </span>
          ))}
        </div>
      </div>
      <div className="talia-event-meta__group">
        <span className="talia-event-meta__label">Sources</span>
        <div className="talia-event-meta__chips">
          {sourceList.map((sourceName) => (
            <span key={`source-${sourceName}`} className="talia-event-meta__chip talia-event-meta__chip--source">
              {sourceName}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReportEventMeta;
