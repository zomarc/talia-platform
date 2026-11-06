/**
 * Document repository presenter — tree, rendered Markdown, and the edit form.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useSubpanelExpansion } from '../../../hooks/useSubpanelExpansion';
import RecordLinkEditor from '../../shared/RecordLinkEditor';
import ReportDataDetails from '../../shared/ReportDataDetails';
import ReportProvenance from '../../shared/ReportProvenance';
import SubpanelExpandButton from '../../shared/SubpanelExpandButton';
import { registerPanelDataExport } from '../../../lib/panelDataExport';
import { buildDocumentTree } from '../../../lib/projectDocument';
import { projectDocumentExportPayload } from '../../../lib/projectDocumentPrint';
import { parseMarkdown } from '../../../lib/markdownLite';
import MermaidDiagram from './MermaidDiagram';
import './document-repository.css';

const LINK_KINDS = [
  { id: 'requirement', label: 'Requirement' },
  { id: 'matrix', label: 'Matrix' },
  { id: 'risk', label: 'Risk' },
];

const Field = ({ label, children, className = '' }) => (
  <label className={`pd-field${className ? ` ${className}` : ''}`}>
    <span className="talia-report-filters__label">{label}</span>
    {children}
  </label>
);

const Pane = ({ paneKey, title, expandedKey, onToggle, className = '', children }) => (
  <section
    className={`pd-pane talia-card talia-card--expandable${expandedKey === paneKey ? ' talia-card--expanded' : ''}${className ? ` ${className}` : ''}`}
    aria-label={title}
  >
    <SubpanelExpandButton
      className="talia-card__expand-toggle"
      expanded={expandedKey === paneKey}
      onToggle={() => onToggle(paneKey)}
      label={title}
    />
    <header className="pd-pane__header">
      <h3 className="pd-pane__title">{title}</h3>
    </header>
    {children}
  </section>
);

const Inline = ({ token, assets }) => {
  if (token.type === 'strong') return <strong>{token.text}</strong>;
  if (token.type === 'em') return <em>{token.text}</em>;
  if (token.type === 'code') return <code>{token.text}</code>;
  if (token.type === 'link') {
    return <a href={token.href} target="_blank" rel="noreferrer">{token.text}</a>;
  }
  if (token.type === 'image') {
    const src = token.assetId ? assets[token.assetId.toLowerCase()] || assets[token.assetId] : token.href;
    if (!src) return <span className="pd-missing-image">{token.alt || 'Image'}</span>;
    return <img src={src} alt={token.alt || ''} />;
  }
  return token.text;
};

const Inlines = ({ tokens, assets }) => (
  tokens.map((token, index) => <Inline key={index} token={token} assets={assets} />)
);

const MarkdownList = ({ block, assets }) => {
  const Tag = block.type === 'ol' ? 'ol' : 'ul';
  return (
    <Tag>
      {block.items.map((item, index) => (
        <li key={index}>
          <Inlines tokens={item.inlines || []} assets={assets} />
          {item.children ? <MarkdownList block={item.children} assets={assets} /> : null}
        </li>
      ))}
    </Tag>
  );
};

const MarkdownBlock = ({ block, assets }) => {
  if (block.type === 'ul' || block.type === 'ol') return <MarkdownList block={block} assets={assets} />;
  if (block.type === 'hr') return <hr />;
  if (block.type === 'code') {
    if (String(block.lang || '').toLowerCase() === 'mermaid') {
      return <MermaidDiagram source={block.text} />;
    }
    return (
      <pre className={block.lang ? `lang-${block.lang}` : undefined}>
        {block.lang ? <span className="pd-code-lang">{block.lang}</span> : null}
        <code>{block.text}</code>
      </pre>
    );
  }
  if (block.type === 'table') {
    return (
      <div className="pd-table-wrap">
        <table>
          {block.header?.length ? (
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={index}><Inlines tokens={cell} assets={assets} /></th>
                ))}
              </tr>
            </thead>
          ) : null}
          <tbody>
            {(block.rows || []).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, index) => (
                  <td key={index}><Inlines tokens={cell} assets={assets} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (block.type === 'quote') {
    return <blockquote><Inlines tokens={block.inlines || []} assets={assets} /></blockquote>;
  }
  const Tag = /^h[1-4]$/.test(block.type) ? block.type : 'p';
  return <Tag><Inlines tokens={block.inlines || []} assets={assets} /></Tag>;
};

const MarkdownView = ({ source, assets }) => {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  if (!blocks.length) return <p className="pd-reading__empty">This document has no body yet.</p>;
  return (
    <div className="pd-markdown">
      {blocks.map((block, index) => (
        <MarkdownBlock key={`${block.type}-${index}`} block={block} assets={assets} />
      ))}
    </div>
  );
};

const StarButton = ({ starred, onToggle, disabled, className = '' }) => (
  <button
    type="button"
    className={`pd-star${starred ? ' is-starred' : ''}${className ? ` ${className}` : ''}`}
    aria-label={starred ? 'Unstar document' : 'Star document'}
    aria-pressed={Boolean(starred)}
    title={starred ? 'Unstar' : 'Star'}
    disabled={disabled}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle?.();
    }}
  >
    {starred ? '★' : '☆'}
  </button>
);

const DocumentLeaf = ({ document, selectedId, onSelect, onToggleStar, busy }) => (
  <div className={`pd-tree__doc${document.id === selectedId ? ' is-selected' : ''}`}>
    <button
      type="button"
      className="pd-tree__doc-main"
      onClick={() => onSelect(document)}
    >
      <strong>{document.referenceCode}</strong>
      <span>{document.title}</span>
    </button>
    <StarButton
      starred={document.isStarred}
      disabled={busy || !document.id}
      onToggle={() => onToggleStar?.(document)}
    />
  </div>
);

const DocumentTree = ({ documents, selectedId, onSelect, onToggleStar, busy }) => {
  const tree = useMemo(() => buildDocumentTree(documents), [documents]);
  if (!tree.length) return <p className="pd-tree__empty">No documents yet.</p>;
  return (
    <div className="pd-tree" role="tree" aria-label="Documents">
      {tree.map((group) => (
        <details key={group.id} open className="pd-tree__group">
          <summary>{group.label}</summary>
          {group.folders.map((folder) => (
            folder.label ? (
              <details key={folder.id} open className="pd-tree__folder">
                <summary>{folder.label}</summary>
                {folder.documents.map((document) => (
                  <DocumentLeaf
                    key={`${folder.id}-${document.id}`}
                    document={document}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onToggleStar={onToggleStar}
                    busy={busy}
                  />
                ))}
              </details>
            ) : (
              folder.documents.map((document) => (
                <DocumentLeaf
                  key={`${group.id}-${document.id}`}
                  document={document}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onToggleStar={onToggleStar}
                  busy={busy}
                />
              ))
            )
          ))}
        </details>
      ))}
    </div>
  );
};

const DocumentRepositoryPresenter = ({
  panelInstanceId,
  panelComponentId,
  reportShellClassName,
  showFilters,
  showDetails,
  showProvenance,
  items,
  totalCount,
  titleFilter,
  onTitleFilter,
  catalogs,
  assets,
  selectedId,
  selected,
  drafting,
  form,
  busy,
  message,
  onSelect,
  onToggleStar,
  onNew,
  onImportFile,
  onOpenPaste,
  pasteOpen,
  pasteText,
  onPasteTextChange,
  onConvertPaste,
  onClosePaste,
  onReformatBody,
  onFormChange,
  onLinksChange,
  onSave,
  onDelete,
  onAddImage,
  onDeleteAsset,
  onExportAll,
  onRefresh,
}) => {
  const { expandedKey, toggleExpandedKey } = useSubpanelExpansion(null);
  const activeKey = expandedKey === 'editor' && !showDetails ? null : expandedKey;
  const showPane = (key) => !activeKey || activeKey === key;
  const exportRef = useRef({});
  exportRef.current = { items, selected, drafting, assets };
  useEffect(() => registerPanelDataExport({
    panelInstanceId,
    panelComponentId: panelComponentId || 'document-repository',
    getPayload: () => {
      const current = exportRef.current;
      const open = current.selected && !current.drafting ? current.selected : null;
      const diagrams = open && typeof document !== 'undefined'
        ? [...document.querySelectorAll('.document-repository .pd-reading .pd-mermaid svg')].map((node) => node.outerHTML)
        : [];
      return projectDocumentExportPayload({
        documents: current.items,
        selected: open,
        assets: current.assets,
        diagrams,
      });
    },
  }));

  return (
  <div
    className={`focus-panel talia-report document-repository${reportShellClassName ? ` ${reportShellClassName}` : ''}`}
    role="region"
    aria-label="Documents"
    data-panel-instance-id={panelInstanceId || undefined}
    data-panel-component-id={panelComponentId || undefined}
  >
    <header className="talia-report__header">
      <div className="talia-report__header-left">
        <h2 className="talia-report__title">Documents</h2>
        <p className="talia-report__subtitle">
          Tree of linked documents · Cursor Markdown, including diagrams
          {totalCount ? ` · ${items.length} of ${totalCount}` : ''}
        </p>
      </div>
    </header>

    <div className={`talia-report-filters${showFilters ? '' : ' talia-report-filters--hidden'}`} aria-label="Document filters">
      <label className="talia-report-filters__group">
        <span className="talia-report-filters__label">Title</span>
        <input
          className="talia-report-filters__input"
          value={titleFilter}
          onChange={(event) => onTitleFilter(event.target.value)}
          placeholder="Search"
        />
      </label>
    </div>

    <div className="talia-report__actions-bar">
      <button type="button" className="talia-btn talia-btn--primary" onClick={onNew} disabled={busy}>New document</button>
      <label className={`talia-btn talia-btn--secondary${busy ? ' is-disabled' : ''}`}>
        Import…
        <input
          type="file"
          accept=".pdf,.txt,.md,.markdown,text/plain,text/markdown,application/pdf"
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onImportFile?.(file);
          }}
        />
      </label>
      <button type="button" className="talia-btn talia-btn--secondary" onClick={onOpenPaste} disabled={busy}>Paste…</button>
      <button type="button" className="talia-btn talia-btn--secondary" onClick={onExportAll} disabled={busy || !totalCount}>Export JSON</button>
      <button type="button" className="talia-btn talia-btn--secondary" onClick={onRefresh} disabled={busy}>Refresh</button>
    </div>

    {message ? <p className="talia-callout">{message}</p> : null}

    {pasteOpen ? (
      <div className="pd-paste-overlay" role="presentation" onClick={onClosePaste}>
        <div
          className="pd-paste-dialog talia-card"
          role="dialog"
          aria-label="Paste text to convert"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="pd-paste-dialog__header">
            <h3 className="pd-paste-dialog__title">Paste text → Markdown</h3>
            <button type="button" className="talia-btn talia-btn--secondary" onClick={onClosePaste} disabled={busy}>Close</button>
          </header>
          <p className="pd-paste-dialog__hint">
            Paste PDF or Word copy here. Talia reformats it as Markdown for the repository — originals are not stored.
          </p>
          <textarea
            className="talia-report-filters__input pd-paste-dialog__input"
            value={pasteText}
            onChange={(event) => onPasteTextChange(event.target.value)}
            placeholder="Paste document text…"
            rows={16}
            autoFocus
          />
          <div className="pd-paste-dialog__actions">
            <button type="button" className="talia-btn talia-btn--primary" onClick={onConvertPaste} disabled={busy || !String(pasteText || '').trim()}>
              Convert to Markdown
            </button>
          </div>
        </div>
      </div>
    ) : null}

    <div className={`pd-stage${activeKey ? ' pd-stage--focused' : ''}`}>
      {showPane('index') || showPane('reading') ? (
        <div className="talia-report__content pd-primary">
          {showPane('index') ? (
            <Pane paneKey="index" title="Index" expandedKey={activeKey} onToggle={toggleExpandedKey} className="pd-pane--index">
              <div className="pd-pane__body">
                <DocumentTree
                  documents={items}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onToggleStar={onToggleStar}
                  busy={busy}
                />
              </div>
            </Pane>
          ) : null}
          {showPane('reading') ? (
            <Pane paneKey="reading" title="Document" expandedKey={activeKey} onToggle={toggleExpandedKey} className="pd-pane--reading">
              {selected && !drafting ? (
                <article className="pd-pane__body pd-reading" aria-label={`${selected.referenceCode} ${selected.title}`}>
                  <header className="pd-reading__title">
                    <StarButton
                      className="pd-star--title"
                      starred={selected.isStarred}
                      disabled={busy}
                      onToggle={() => onToggleStar?.(selected)}
                    />
                    <strong>{selected.referenceCode}</strong> {selected.title}
                  </header>
                  {(selected.links || []).length ? (
                    <p className="pd-reading__links">
                      {selected.links.map((link) => link.label || link.targetId).join(' · ')}
                    </p>
                  ) : null}
                  <MarkdownView source={selected.body} assets={assets} />
                </article>
              ) : (
                <p className="pd-pane__body pd-reading pd-reading--empty">
                  {drafting ? 'The new document is edited in the editor.' : 'Select a document to read it.'}
                </p>
              )}
            </Pane>
          ) : null}
        </div>
      ) : null}

      {showDetails && showPane('editor') ? (
        <ReportDataDetails
          visible
          className={`pd-pane pd-pane--editor talia-card talia-card--expandable${activeKey === 'editor' ? ' talia-card--expanded' : ''}`}
          aria-label="Editor"
        >
          <SubpanelExpandButton
            className="talia-card__expand-toggle"
            expanded={activeKey === 'editor'}
            onToggle={() => toggleExpandedKey('editor')}
            label="editor"
          />
          <header className="pd-pane__header">
            <h3 className="pd-pane__title">Editor</h3>
          </header>
          {drafting || selected ? (
            <form
              className="pd-form"
              onSubmit={(event) => {
                event.preventDefault();
                onSave();
              }}
            >
              <Field label="Reference">
                <input
                  className="talia-report-filters__input"
                  value={form.referenceCode}
                  onChange={(event) => onFormChange('referenceCode', event.target.value)}
                  required
                />
              </Field>
              <Field label="Title">
                <input
                  className="talia-report-filters__input"
                  value={form.title}
                  onChange={(event) => onFormChange('title', event.target.value)}
                  required
                />
              </Field>
              <Field label="Markdown" className="pd-field--body">
                <textarea
                  className="talia-report-filters__input"
                  value={form.body}
                  onChange={(event) => onFormChange('body', event.target.value)}
                />
              </Field>
              <div className="pd-form__actions">
                <label className="talia-btn talia-btn--secondary">
                  Add image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    hidden
                    disabled={busy || drafting || !selected}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = '';
                      if (file) onAddImage(file);
                    }}
                  />
                </label>
                {(selected?.assets || []).map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    className="talia-btn talia-btn--secondary"
                    onClick={() => onDeleteAsset(asset.id)}
                    disabled={busy}
                  >
                    Remove {asset.filename}
                  </button>
                ))}
              </div>
              <Field label="Links" className="pd-field--links">
                <RecordLinkEditor
                  kinds={LINK_KINDS}
                  catalogs={catalogs}
                  links={form.links}
                  onChange={onLinksChange}
                />
              </Field>
              <div className="pd-form__actions">
                <button type="submit" className="talia-btn talia-btn--primary" disabled={busy}>Save</button>
                <button
                  type="button"
                  className="talia-btn talia-btn--secondary"
                  onClick={onReformatBody}
                  disabled={busy || !String(form.body || '').trim()}
                  title="Convert the current body text into structured Markdown"
                >
                  Reformat as Markdown
                </button>
                {selected && !drafting ? (
                  <button type="button" className="talia-btn talia-btn--secondary" onClick={onDelete} disabled={busy}>Delete</button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="pd-pane__body pd-form__empty">Select a document, or start a new one.</p>
          )}
        </ReportDataDetails>
      ) : null}
    </div>

    <ReportProvenance visible={showProvenance}>
      <p>
        Documents live in <code>public.project_document</code>. The body is Markdown, including
        Mermaid diagrams from Cursor.
        Images are PNG, JPEG, GIF, or WebP, stored with the document and written as
        <code> ![](asset:…)</code>. A document links to a requirement, a matrix cell, or a risk.
        Import / Paste converts PDF or plain text to Markdown in the browser; only the Markdown is saved.
      </p>
    </ReportProvenance>
  </div>
  );
};

export default DocumentRepositoryPresenter;
