/**
 * Pinned node detail from overview double-click — copyable text.
 */

import React, { useEffect, useState } from 'react';

async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
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
}

function buildCopyPayload(node) {
  if (!node) return '';
  const lines = [
    node.title || '',
    node.blurb || '',
    node.detail || '',
    node.address ? `Address: ${node.address}` : '',
    node.concern ? `${node.concern.title}: ${node.concern.detail}` : '',
    node.state && node.state !== 'static' ? `Status: ${node.state}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

export default function ArchitectureNodeInspector({ node, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [node?.id, node?.title]);

  useEffect(() => {
    if (!node) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [node, onClose]);

  if (!node) return null;

  const handleCopy = async () => {
    const ok = await copyText(buildCopyPayload(node));
    setCopied(Boolean(ok));
  };

  return (
    <div className="dm-arch-inspector" role="dialog" aria-label={`${node.title} details`}>
      <div className="dm-arch-inspector__panel talia-card">
        <div className="dm-arch-inspector__header">
          <div>
            <h4 className="dm-arch-inspector__title">{node.title}</h4>
            {node.blurb ? <p className="dm-arch-inspector__blurb">{node.blurb}</p> : null}
          </div>
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={onClose}
            aria-label="Close details"
          >
            Close
          </button>
        </div>
        <div className="dm-arch-inspector__body">
          {node.detail ? <p>{node.detail}</p> : null}
          {node.address ? (
            <p className="dm-arch-inspector__address">
              <code>{node.address}</code>
            </p>
          ) : null}
          {node.concern ? (
            <p className={`dm-arch-inspector__concern dm-arch-inspector__concern--${node.concern.severity}`}>
              {node.concern.title}: {node.concern.detail}
            </p>
          ) : null}
          {node.state && node.state !== 'static' ? (
            <p className="dm-arch-inspector__status">Status: {node.state}</p>
          ) : null}
        </div>
        <div className="dm-arch-inspector__actions">
          <button
            type="button"
            className="admin-button admin-button--secondary"
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy details'}
          </button>
          <span className="dm-arch-inspector__hint">Double-click a box to open · Esc to close</span>
        </div>
      </div>
    </div>
  );
}
