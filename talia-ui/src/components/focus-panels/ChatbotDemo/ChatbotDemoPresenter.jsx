/**
 * Demonstration chat layout. The container owns the scripted replies.
 */

import React, { useEffect, useRef } from 'react';
import { useReportShellOptions } from '../../../hooks/useReportShellOptions';
import { DEMO_PROMPTS } from './demoReplies';

const ChatbotDemoPresenter = ({
  panelInstanceId = null,
  panelComponentId = null,
  messages = [],
  draft = '',
  pending = false,
  onDraftChange,
  onAsk,
  onClear,
}) => {
  const { reportShellClassName } = useReportShellOptions(
    panelComponentId || 'ui-chatbot-demo',
    panelInstanceId
  );
  const endRef = useRef(null);
  const showPrompts = messages.length <= 1 && !pending;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages, pending]);

  const submit = (event) => {
    event.preventDefault();
    onAsk?.(draft);
  };

  return (
    <div
      className={`focus-panel talia-report ui-chatbot ${reportShellClassName}`}
      role="region"
      aria-label="Chatbot demonstration"
    >
      <header className="talia-report__header">
        <div className="talia-report__header-left">
          <h2 className="talia-report__title">Chatbot</h2>
          <span className="talia-report__subtitle">Demonstration — a random line from Sun Tzu</span>
        </div>
      </header>
      <main className="talia-report__content ui-chatbot__body">
        <div className="ui-chatbot__transcript" role="log" aria-live="polite" aria-relevant="additions">
          {messages.map((message) => (
            <p
              key={message.id}
              className={`ui-chatbot__message ui-chatbot__message--${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              {message.text}
            </p>
          ))}
          {pending ? <p className="ui-chatbot__message ui-chatbot__message--assistant ui-chatbot__message--pending">…</p> : null}
          {showPrompts ? (
            <div className="ui-chatbot__prompts">
              {DEMO_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="talia-btn talia-btn--secondary ui-chatbot__prompt"
                  onClick={() => onAsk?.(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
        <form className="ui-chatbot__composer" onSubmit={submit}>
          <button
            className="talia-btn talia-btn--secondary"
            type="button"
            onClick={() => onClear?.()}
            disabled={messages.length <= 1 && !pending && !String(draft).trim()}
          >
            Clear
          </button>
          <input
            className="ui-chatbot__input"
            type="text"
            value={draft}
            placeholder="Ask a question"
            aria-label="Ask a question"
            disabled={pending}
            onChange={(event) => onDraftChange?.(event.target.value)}
          />
          <button className="talia-btn talia-btn--primary" type="submit" disabled={pending || !String(draft).trim()}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
};

export default ChatbotDemoPresenter;
