import React, { useState } from 'react';
import { IconLedger, IconCheck, IconAlert } from '../common/Icons.jsx';

export default function LedgerPanel({ ledgerEntries }) {
  const [filterKind, setFilterKind] = useState('all');

  const getKindBadgeClass = (kind) => {
    switch (kind) {
      case 'decision':
        return 'badge-primary';
      case 'constraint':
        return 'badge-error';
      case 'todo':
        return 'badge-warning';
      case 'hypothesis':
        return 'badge-info';
      default:
        return 'badge-secondary';
    }
  };

  const filteredEntries = ledgerEntries.filter((entry) => {
    if (filterKind === 'all') return true;
    return entry.kind === filterKind;
  });

  return (
    <div className="ledger-panel">
      <div className="ledger-header">
        <div className="ledger-title">
          <IconLedger size={15} />
          <span>Decision Ledger</span>
          <span className="badge badge-secondary">{ledgerEntries.length}</span>
        </div>

        <div className="ledger-filters">
          <button
            className={`filter-btn ${filterKind === 'all' ? 'active' : ''}`}
            onClick={() => setFilterKind('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterKind === 'decision' ? 'active' : ''}`}
            onClick={() => setFilterKind('decision')}
          >
            Decisions
          </button>
          <button
            className={`filter-btn ${filterKind === 'constraint' ? 'active' : ''}`}
            onClick={() => setFilterKind('constraint')}
          >
            Constraints
          </button>
          <button
            className={`filter-btn ${filterKind === 'todo' ? 'active' : ''}`}
            onClick={() => setFilterKind('todo')}
          >
            TODOs
          </button>
        </div>
      </div>

      <div className="ledger-body">
        {filteredEntries.length === 0 ? (
          <div className="ledger-empty">
            <p>No ledger entries recorded yet.</p>
            <small>
              As the agent plans and writes code, it registers architectural decisions, constraints, and TODOs here.
            </small>
          </div>
        ) : (
          filteredEntries.map((entry, idx) => {
            const isSuperseded = entry.status === 'superseded';
            const isCompleted = entry.status === 'completed';

            return (
              <div
                key={entry._id || idx}
                className={`ledger-item ${isSuperseded ? 'item-superseded' : ''}`}
              >
                <div className="ledger-item-header">
                  <span className={`badge ${getKindBadgeClass(entry.kind)}`}>
                    {entry.kind}
                  </span>
                  <span className="ledger-status-tag">
                    {isCompleted ? (
                      <span className="text-success">
                        <IconCheck size={12} /> done
                      </span>
                    ) : isSuperseded ? (
                      <span className="text-muted">superseded</span>
                    ) : (
                      <span className="text-active">active</span>
                    )}
                  </span>
                </div>

                <div className="ledger-item-body">{entry.body}</div>

                {entry.sourceSeq && (
                  <div className="ledger-item-meta">From Turn #{entry.sourceSeq}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
