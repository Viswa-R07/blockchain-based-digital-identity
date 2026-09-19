/*
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { AppRoute } from '../App';
import { credentialService } from '../services/credentialService';
import {
  Search,
  History,
  Database,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Key,
  Copy,
  Check,
  AlertCircle,
  FileCode,
  ArrowRight,
  RefreshCw,
  GitCommit,
} from 'lucide-react';

interface AuditLedgerPageProps {
  onNavigate: (route: AppRoute) => void;
}

type QueryTargetType = 'identity' | 'credential';
type EventFilterType = 'ALL' | 'ACTIVE' | 'DELETED';

interface HistoryEventItem {
  txId: string;
  timestamp: string;
  isDelete: boolean;
  value: any;
}

const SAMPLE_QUERIES = {
  identity: [
    'did:example:alice123',
    'did:example:bob456',
    'did:example:gov:authority',
    'did:example:university:registrar',
  ],
  credential: [
    'gov-id-9932-a',
    'gov-id-1001-active',
    'degree-cs-2024-01',
    'kyc-tier3-bank-44',
  ],
};

export const AuditLedgerPage: React.FC<AuditLedgerPageProps> = () => {
  const [targetType, setTargetType] = useState<QueryTargetType>('identity');
  const [searchKey, setSearchKey] = useState<string>('did:example:alice123');
  const [loading, setLoading] = useState<boolean>(false);
  const [events, setEvents] = useState<HistoryEventItem[] | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilterType>('ALL');

  // Expanded cards tracker
  const [expandedTxs, setExpandedTxs] = useState<Record<string, boolean>>({});
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  const toggleExpand = (txId: string) => {
    setExpandedTxs((prev) => ({ ...prev, [txId]: !prev[txId] }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(id);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const handleFetchHistory = async (keyToFetch?: string) => {
    const key = (keyToFetch || searchKey).trim();
    if (!key) return;

    setLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);
    setEvents(null);
    setExpandedTxs({});

    try {
      if (targetType === 'identity') {
        const res = await credentialService.getIdentityHistory(key);
        setLoading(false);
        setLatencyMs(res.latencyMs);
        if (res.error) {
          const isNotFound =
            res.status === 404 ||
            res.error.toUpperCase().includes('NOT_FOUND') ||
            res.error.toLowerCase().includes('not found') ||
            res.error.toLowerCase().includes('does not exist');

          if (isNotFound) {
            setInfoMessage('No transactions recorded for this DID.');
          } else {
            setErrorMessage(res.error);
          }
        } else {
          const raw = res.data as any;
          const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
          if (list.length === 0) {
            setInfoMessage('No transactions recorded for this DID.');
          } else {
            setEvents(list);
          }
        }
      } else {
        const res = await credentialService.getCredentialHistory(key);
        setLoading(false);
        setLatencyMs(res.latencyMs);
        if (res.error) {
          setErrorMessage(res.error);
        } else {
          const raw = res.data as any;
          const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
          setEvents(list);
        }
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMessage(err?.message || 'Network error querying Fabric ledger history.');
    }
  };

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (filter === 'ACTIVE') return events.filter((e) => !e.isDelete);
    if (filter === 'DELETED') return events.filter((e) => e.isDelete);
    return events;
  }, [events, filter]);

  return (
    <div>
      <PageHeader
        title="Audit Ledger & Provenance Explorer"
        subtitle="Cryptographic Transaction History & State Provenance via Fabric GetHistoryForKey"
        dataClassification="LIVE"
        dataTagLabel="[A] Fabric History Endpoints"
      />

      {/* ── Architecture Context Card ── */}
      <Card accent="cyan" style={{ marginBottom: 24, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Database size={22} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Ledger Immutability & Provenance Architecture
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 780 }}>
                Fabric blockchain history is an append-only cryptographic ledger. The queries below execute{' '}
                <code style={{ color: 'var(--accent-cyan)' }}>GetHistoryForKey</code> on the channel chaincode,
                retrieving the exact sequence of historical state commitments, transaction identifiers, and deletion flags
                recorded since channel genesis.
              </p>
            </div>
          </div>
          <DataTag type="STATIC" label="[C] Static Architecture Data" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 14, borderTop: '1px solid var(--border-structural)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Channel: <strong style={{ color: 'var(--text-primary)' }}>identity-channel</strong>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Consortium: <strong style={{ color: 'var(--text-primary)' }}>4 Orgs / 8 Peers</strong>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Consensus: <strong style={{ color: 'var(--text-primary)' }}>3-Node Raft CFT</strong>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            State DB: <strong style={{ color: 'var(--text-primary)' }}>CouchDB Key-History</strong>
          </div>
        </div>
      </Card>

      {/* ── Search & Filter Controls ── */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Target type selection */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant={targetType === 'identity' ? 'primary' : 'outline'}
                size="sm"
                icon={<Key size={13} />}
                onClick={() => {
                  setTargetType('identity');
                  setSearchKey('did:example:alice123');
                  setEvents(null);
                  setErrorMessage(null);
                }}
              >
                Subject Identity DID History
              </Button>
              <Button
                variant={targetType === 'credential' ? 'primary' : 'outline'}
                size="sm"
                icon={<ShieldCheck size={13} />}
                onClick={() => {
                  setTargetType('credential');
                  setSearchKey('gov-id-9932-a');
                  setEvents(null);
                  setErrorMessage(null);
                }}
              >
                Credential Record History
              </Button>
            </div>
            <DataTag
              type="LIVE"
              label={
                targetType === 'identity'
                  ? '[A] GET /api/v1/identities/:did/history'
                  : '[A] GET /api/v1/credentials/:id/history'
              }
            />
          </div>

          {/* Search bar */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={searchKey}
                onChange={(e) => setSearchKey(e.target.value)}
                placeholder={
                  targetType === 'identity'
                    ? 'Enter Subject DID (e.g. did:example:alice123)'
                    : 'Enter Credential ID (e.g. gov-id-9932-a)'
                }
                className="font-mono"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-surface-lowest)',
                  border: '1px solid var(--border-structural)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFetchHistory();
                }}
              />
            </div>
            <Button
              variant="primary"
              disabled={loading || !searchKey.trim()}
              icon={loading ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
              onClick={() => handleFetchHistory()}
            >
              {loading ? 'Querying Ledger...' : 'Audit Ledger'}
            </Button>
          </div>

          {/* Sample quick picks */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quick inspect samples:</span>
            {SAMPLE_QUERIES[targetType].map((sample) => (
              <span
                key={sample}
                onClick={() => {
                  setSearchKey(sample);
                  handleFetchHistory(sample);
                }}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--bg-surface-highest)',
                  border: '1px solid var(--border-interactive)',
                  color: 'var(--accent-cyan)',
                  cursor: 'pointer',
                }}
              >
                {sample}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Query Results ── */}
      {infoMessage && !errorMessage && (
        <Card accent="cyan" style={{ marginBottom: 24, textAlign: 'center', padding: '36px 20px' }}>
          <History size={32} color="var(--accent-cyan)" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            {infoMessage}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            The requested decentralized identifier (<code>{searchKey}</code>) has no on-chain identity records or transaction provenance on the Fabric ledger.
          </div>
        </Card>
      )}

      {errorMessage && (
        <Card accent="red" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={18} color="var(--status-revoked)" />
            <div style={{ fontSize: 13, color: 'var(--status-revoked)' }}>
              <strong>Query Failed:</strong> {errorMessage}
            </div>
          </div>
        </Card>
      )}

      {events && (
        <div>
          {/* Results Summary Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Ledger Provenance Log: <code style={{ color: 'var(--accent-cyan)' }}>{searchKey}</code>
              </div>
              <Badge variant="cyan">{events.length} State Transition{events.length === 1 ? '' : 's'}</Badge>
              {latencyMs !== null && (
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Evaluated in {latencyMs}ms
                </span>
              )}
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ALL', 'ACTIVE', 'DELETED'] as EventFilterType[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '3px 10px',
                    fontSize: 11,
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-structural)',
                    backgroundColor: filter === f ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
                    color: filter === f ? 'var(--accent-cyan)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: filter === f ? 600 : 400,
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredEvents.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
              <History size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>
                No history events match the selected criteria on the Fabric ledger.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Key has not undergone state transitions matching filter <code>{filter}</code>.
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {filteredEvents.map((event, index) => {
                const isExpanded = Boolean(expandedTxs[event.txId]);
                const parsedVal = event.value && typeof event.value === 'object' ? event.value : null;

                // Determine transition version
                const versionNumber = parsedVal?.version ?? (filteredEvents.length - index);

                return (
                  <Card key={`${event.txId}-${index}`} style={{ padding: '16px 20px' }}>
                    {/* Header: TxID & Timestamp */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor: event.isDelete ? 'rgba(239, 68, 68, 0.15)' : 'var(--accent-cyan-container)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <GitCommit size={15} color={event.isDelete ? 'var(--status-revoked)' : 'var(--accent-cyan)'} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              Version {versionNumber}
                            </span>
                            {event.isDelete ? (
                              <Badge variant="revoked">DELETED (isDelete=true)</Badge>
                            ) : parsedVal?.status ? (
                              <Badge
                                variant={
                                  parsedVal.status === 'ACTIVE'
                                    ? 'verified'
                                    : parsedVal.status === 'SUSPENDED'
                                    ? 'suspended'
                                    : 'revoked'
                                }
                              >
                                {parsedVal.status}
                              </Badge>
                            ) : (
                              <Badge variant="neutral">RECORD STATE</Badge>
                            )}
                          </div>
                          <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>TxID: {event.txId}</span>
                            <span
                              onClick={() => handleCopy(event.txId, event.txId)}
                              style={{ cursor: 'pointer', color: copiedTx === event.txId ? 'var(--status-verified)' : 'var(--accent-cyan)' }}
                              title="Copy Transaction ID"
                            >
                              {copiedTx === event.txId ? <Check size={12} /> : <Copy size={12} />}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={12} />
                          {event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A'}
                        </div>
                        <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {event.timestamp || 'ISO timestamp'}
                        </div>
                      </div>
                    </div>

                    {/* State Payload Summary */}
                    {parsedVal && !event.isDelete && (
                      <div style={{ marginTop: 14, padding: '10px 14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: 12 }}>
                          {parsedVal.status && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Status: </span>
                              <strong style={{ color: 'var(--text-primary)' }}>{parsedVal.status}</strong>
                            </div>
                          )}
                          {parsedVal.issuerOrg && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Issuer Org: </span>
                              <strong className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{parsedVal.issuerOrg}</strong>
                            </div>
                          )}
                          {parsedVal.credentialType && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Type: </span>
                              <span style={{ color: 'var(--text-secondary)' }}>{parsedVal.credentialType}</span>
                            </div>
                          )}
                          {parsedVal.revocationReason && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Revocation Reason: </span>
                              <Badge variant="revoked">{parsedVal.revocationReason}</Badge>
                            </div>
                          )}
                        </div>

                        {/* Commitment hash display */}
                        {(parsedVal.credentialCommitment || parsedVal.identityCommitment) && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-structural)', fontSize: 11 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Commitment Digest: </span>
                            <span className="font-mono" style={{ color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                              {parsedVal.credentialCommitment || parsedVal.identityCommitment}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Raw JSON Expand Toggle */}
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => toggleExpand(event.txId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: 11,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <FileCode size={12} />
                        {isExpanded ? 'Hide Raw Ledger Record' : 'Inspect Raw Ledger Record'}
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>
                    </div>

                    {/* Expandable Raw JSON Viewer */}
                    {isExpanded && (
                      <div style={{ marginTop: 10, padding: '12px', backgroundColor: 'var(--bg-surface-highest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-interactive)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                            RAW RECORD JSON PAYLOAD (AS RETURNED BY FABRIC GATEWAY)
                          </span>
                          <DataTag type="LIVE" label="[A] Exact Payload" />
                        </div>
                        <pre
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            color: 'var(--accent-cyan)',
                            margin: 0,
                            overflowX: 'auto',
                            maxHeight: 260,
                            lineHeight: 1.4,
                          }}
                        >
                          {JSON.stringify(event, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
