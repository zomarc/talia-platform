import React from 'react';

const formatList = (items = []) => {
  if (!items || items.length === 0) {
    return ['—'];
  }
  return items;
};

const ReportEventMeta = ({ emits = [], respondsTo = [] }) => {
  const emitList = formatList(emits);
  const respondList = formatList(respondsTo);

  return (
    <div className="talia-event-meta" role="note" aria-label="Report event contract">
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
    </div>
  );
};

export default ReportEventMeta;
