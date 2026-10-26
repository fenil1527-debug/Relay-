import React from 'react';
import { IconHandoff, IconCpu, IconAlert, IconCheck } from '../common/Icons.jsx';

export default function HandoffTimeline({ handoffs, attempts }) {
  const formatProvider = (p) => {
    if (!p) return 'Provider';
    const [family, model] = p.split(':');
    return model || family;
  };

  const getReasonLabel = (reason) => {
    switch (reason) {
      case 'rate_limit':
        return '429 Rate Limit Exceeded';
      case 'server_error':
        return '500 Server Outage';
      case 'context_overflow':
        return 'Context Window Overflow';
      case 'timeout':
        return 'Provider Timeout';
      default:
        return reason || 'Failover';
    }
  };

  if (!handoffs?.length && !attempts?.length) {
    return (
      <div className="timeline-empty">
        <IconHandoff size={24} className="timeline-empty-icon" />
        <p>No handoffs recorded</p>
        <small>Primary provider is handling requests without failover.</small>
      </div>
    );
  }

  return (
    <div className="handoff-timeline">
      <div className="timeline-header">
        <IconHandoff size={15} />
        <span>Resilience & Handoff Timeline</span>
        <span className="badge badge-accent">{handoffs.length} Handoffs</span>
      </div>

      <div className="timeline-events-list">
        {handoffs.map((h, i) => (
          <div key={h._id || i} className="timeline-event-card">
            <div className="timeline-marker">
              <span className="marker-dot"></span>
              {i < handoffs.length - 1 && <span className="marker-line"></span>}
            </div>

            <div className="timeline-card-content">
              <div className="handoff-route">
                <span className="provider-pill from-provider">
                  <IconCpu size={12} />
                  {formatProvider(h.fromProvider)}
                </span>
                <span className="route-arrow">→</span>
                <span className="provider-pill to-provider">
                  <IconCpu size={12} />
                  {formatProvider(h.toProvider)}
                </span>
              </div>

              <div className="handoff-reason-tag">
                <IconAlert size={12} />
                <span>{getReasonLabel(h.reason)}</span>
              </div>

              {h.packet && (
                <div className="handoff-packet-meta">
                  <span>Context Packet:</span>
                  <code>
                    {h.packet.ledgerEntries?.length || 0} ledger items ·{' '}
                    {h.packet.touchedFiles?.length || 0} files tracked
                  </code>
                </div>
              )}

              <div className="timeline-time">
                {new Date(h.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
