/**
 * Chatbot demo container. Conversation state stays in this panel instance.
 * Replies are local samples — no model and no network.
 */

import React, { useEffect, useRef, useState } from 'react';
import ChatbotDemoPresenter from './ChatbotDemoPresenter';
import { DEMO_WELCOME, demoChatReply } from './demoReplies';

let messageSeq = 0;
const nextId = () => {
  messageSeq += 1;
  return `demo-${messageSeq}`;
};

const ChatbotDemoContainer = ({ panelInstanceId = null, panelComponentId = null }) => {
  const [messages, setMessages] = useState(() => ([
    { id: 'welcome', role: 'assistant', text: DEMO_WELCOME },
  ]));
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const timerRef = useRef(null);
  const lastQuoteRef = useRef('');

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const ask = (raw) => {
    const text = String(raw || '').trim();
    if (!text || pending) return;
    const reply = demoChatReply({ avoid: lastQuoteRef.current });
    lastQuoteRef.current = reply;
    setDraft('');
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }]);
    setPending(true);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', text: reply }]);
      setPending(false);
    }, 450);
  };

  const clear = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastQuoteRef.current = '';
    setPending(false);
    setDraft('');
    setMessages([{ id: 'welcome', role: 'assistant', text: DEMO_WELCOME }]);
  };

  return (
    <ChatbotDemoPresenter
      panelInstanceId={panelInstanceId}
      panelComponentId={panelComponentId}
      messages={messages}
      draft={draft}
      pending={pending}
      onDraftChange={setDraft}
      onAsk={ask}
      onClear={clear}
    />
  );
};

export default ChatbotDemoContainer;
