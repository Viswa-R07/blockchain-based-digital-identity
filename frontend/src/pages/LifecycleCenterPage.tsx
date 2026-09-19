import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { AppRoute } from '../App';
import { apiClient } from '../services/apiClient';
import { CredentialRecord, CredentialStatusResult, CredentialHistoryEvent, RevocationReason } from '../types';
import {
  Search, PauseCircle, PlayCircle, XCircle, Lock,
  AlertTriangle, CheckCircle, ArrowLeft, RefreshCw, Clock,
} from 'lucide-react';

// [C] Verified Architecture — RevocationReason enum from backend types/index.ts
const REVOCATION_REASONS: RevocationReason[] = [
  'KEY_COMPROMISE',
  'AFFILIATION_CHANGED',
  'SUPERSEDED',
  'CESSATION_OF_OPERATION',
  'PRIVILEGE_WITHDRAWN',
  'UNSPECIFIED',
];

const DEMO_CREDENTIAL_ID = 'gov-id-9932-a';

type ActionType = 'suspend' | 'reinstate' | 'revoke';

const statusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':   return 'var(--status-verified)';
    case 'SUSPENDED': return 'var(--status-warning)';
    case 'REVOKED':  return 'var(--status-revoked)';
    default:         return 'var(--text-muted)';
  }
};

const statusVariant = (status: string): 'verified' | 'suspended' | 'revoked' | 'neutral' => {
  switch (status) {
    case 'ACTIVE':    return 'verified';
    case 'SUSPENDED': return 'suspended';
    case 'REVOKED':   return 'revoked';
    default:          return 'neutral';
  }
};

const FieldRow: React.FC<{ label: string; value: React.ReactNode; classified?: React.ReactNode }> = ({ label, value, classified }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '7px 0', borderBottom: '1px solid var(--border-structural)', gap: 12 }}>
    <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'right' }}>{value}</span>
      {classified}
    </div>
  </div>
);

const AccessDenied: React.FC<{ onNavigate: (r: AppRoute) => void; personaName: string; mspId: string }> = ({ onNavigate, personaName, mspId }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
    <div style={{ width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
      <Lock size={28} color="var(--status-revoked)" />
    </div>
    <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Lifecycle Mutations Not Authorized</h2>
    <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 440, lineHeight: 1.6, marginBottom: 24 }}>
      The <strong style={{ color: 'var(--text-primary)' }}>{personaName} ({mspId})</strong> role cannot perform credential lifecycle mutations.
      Authorization is enforced by the backend — not the frontend.
    </p>
    <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => onNavigate('portal')} id="lifecycle-access-denied-portal-btn">
      Return to Consortium Portal
    </Button>
    <div style={{ marginTop: 16 }}>
      <DataTag type="STATIC" label="[C] Backend ABAC — Not Frontend-Enforced" />
    </div>
  </div>
);

export const LifecycleCenterPage: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({ onNavigate }) => {
  const { currentPersona } = useAuth();
  const isInstitutional = currentPersona.allowedCredentialTypes.length > 0;

  // Lookup
  const [credentialId, setCredentialId] = useState<string>(DEMO_CREDENTIAL_ID);
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [currentStatus, setCurrentStatus] = useState<CredentialStatusResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // History
  const [historyEvents, setHistoryEvents] = useState<CredentialHistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Lifecycle actions
  const [suspendReason, setSuspendReason] = useState<RevocationReason>('PRIVILEGE_WITHDRAWN');
  const [revokeReason, setRevokeReason] = useState<RevocationReason>('UNSPECIFIED');
  const [actionLoading, setActionLoading] = useState<ActionType | null>(null);
  const [actionResult, setActionResult] = useState<CredentialRecord | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLatency, setActionLatency] = useState<number | null>(null);
  const [lastAction, setLastAction] = useState<ActionType | null>(null);

  // Revoke confirmation modal
  const [revokeModalOpen, setRevokeModalOpen] = useState<boolean>(false);
  const [revokeAcknowledged, setRevokeAcknowledged] = useState<boolean>(false);

  const fetchStatus = async () => {
    if (!credentialId.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    setCurrentStatus(null);
    const res = await apiClient.get<CredentialStatusResult>(`/credentials/${encodeURIComponent(credentialId.trim())}/status`);
    setLookupLoading(false);
    if (res.error) {
      setLookupError(res.error);
    } else {
      setCurrentStatus(res.data);
    }
  };

  const fetchHistory = async () => {
    if (!credentialId.trim()) return;
    setHistoryLoading(true);
    setHistoryError(null);
    const res = await apiClient.get<CredentialHistoryEvent[]>(`/credentials/${encodeURIComponent(credentialId.trim())}/history`);
    setHistoryLoading(false);
    if (res.error) {
      setHistoryError(res.error);
    } else if (res.data) {
      const data = res.data as any;
      setHistoryEvents(Array.isArray(data) ? data : (data?.data ?? []));
    }
  };

  const executeAction = async (action: ActionType, body?: Record<string, unknown>) => {
    if (!credentialId.trim()) return;
    setActionLoading(action);
    setActionResult(null);
    setActionError(null);
    setActionMessage(null);
    setLastAction(action);

    const res = await apiClient.post<CredentialRecord>(
      `/credentials/${encodeURIComponent(credentialId.trim())}/${action}`,
      body
    );
    setActionLoading(null);
    setActionLatency(res.latencyMs);

    if (res.error) {
      setActionError(res.error);
    } else if (res.data) {
      setActionResult(res.data);
      const msgMap: Record<ActionType, string> = {
        suspend: 'Credential suspended successfully',
        reinstate: 'Credential reinstated successfully',
        revoke: 'Credential permanently revoked',
      };
      setActionMessage(msgMap[action]);
      // Refresh status display
      setCurrentStatus(null);
      fetchStatus();
    }
  };

  const handleSuspend = () => executeAction('suspend', { reason: suspendReason });
  const handleReinstate = () => executeAction('reinstate', undefined);
  const handleRevokeConfirm = () => {
    setRevokeModalOpen(false);
    setRevokeAcknowledged(false);
    executeAction('revoke', { reason: revokeReason });
  };

  if (!isInstitutional) {
    return (
      <div>
        <PageHeader
          title="Credential Lifecycle & Revocation Center"
          subtitle="Suspension, Reinstatement, and Revocation on the Fabric Ledger"
          dataClassification="LIVE"
          dataTagLabel="[A] POST /api/v1/credentials/:id/{suspend|reinstate|revoke}"
        />
        <AccessDenied onNavigate={onNavigate} personaName={currentPersona.name} mspId={currentPersona.mspId} />
      </div>
    );
  }

  const isRevoked = currentStatus?.status === 'REVOKED' || actionResult?.status === 'REVOKED';

  return (
    <div>
      <PageHeader
        title="Credential Lifecycle & Revocation Center"
        subtitle={`Suspension, Reinstatement, and Revocation · ${currentPersona.mspId}`}
        dataClassification="LIVE"
        dataTagLabel="[A] POST /api/v1/credentials/:id/{suspend|reinstate|revoke}"
        actions={
          <Button variant="secondary" size="sm" onClick={() => onNavigate('portal')} id="lifecycle-back-portal">
            ← Portal
          </Button>
        }
      />

      {/* ── Row 1: Credential Lookup ──────────────────────────────────────── */}
      <Card title="Credential Lookup" accent="cyan">
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">
              Credential ID <DataTag type="DERIVED" label="[B] User/Input Data" />
            </label>
            <input
              type="text"
              className="form-input font-mono"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="gov-id-xxxx-a"
              id="lifecycle-credential-id"
              style={{ marginTop: 6 }}
            />
          </div>
          <Button
            variant="primary"
            loading={lookupLoading}
            icon={<Search size={14} />}
            onClick={fetchStatus}
            id="lifecycle-fetch-status-btn"
          >
            Fetch Status
          </Button>
          <Button
            variant="outline"
            loading={historyLoading}
            icon={<Clock size={14} />}
            onClick={fetchHistory}
            id="lifecycle-fetch-history-btn"
          >
            Fetch History
          </Button>
        </div>
        <div style={{ marginTop: 8 }}>
          <DataTag type="SAMPLE" label={`[D] Demo preset: ${DEMO_CREDENTIAL_ID}`} />
        </div>

        {lookupError && (
          <div style={{ marginTop: 12, padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <XCircle size={13} color="var(--status-revoked)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-revoked)' }}>Status Fetch Failed</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{lookupError}</div>
            <div style={{ marginTop: 6 }}><DataTag type="LIVE" label="[A] Live Backend Error — Not Frontend-Generated" /></div>
          </div>
        )}

        {currentStatus && (
          <div style={{ marginTop: 14, padding: '14px 16px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-structural)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Current Status — CredentialStatusResult</span>
              <Badge variant={statusVariant(currentStatus.status)}>{currentStatus.status}</Badge>
            </div>
            <FieldRow label="credentialId"    value={currentStatus.credentialId}   classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="status"          value={<span style={{ color: statusColor(currentStatus.status), fontWeight: 700 }}>{currentStatus.status}</span>} classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="effectiveStatus" value={currentStatus.effectiveStatus} classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="issuerOrg"       value={currentStatus.issuerOrg}       classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="credentialType"  value={currentStatus.credentialType}  classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="issuedAt"        value={currentStatus.issuedAt}        classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="expiresAt"       value={currentStatus.expiresAt}       classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="version"         value={String(currentStatus.version)} classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            <FieldRow label="evaluatedAt"     value={currentStatus.evaluatedAt}     classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            {currentStatus.revocationReason && (
              <FieldRow label="revocationReason" value={String(currentStatus.revocationReason)} classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            )}
            {currentStatus.revokedAt && (
              <FieldRow label="revokedAt" value={currentStatus.revokedAt} classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
            )}
          </div>
        )}

        {historyError && (
          <div style={{ marginTop: 12, padding: '10px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)' }}>
            <span style={{ fontSize: 12, color: 'var(--status-revoked)' }}>{historyError}</span>
          </div>
        )}

        {historyEvents && historyEvents.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
              Transaction History — {historyEvents.length} event(s)
              <DataTag type="LIVE" label="[A] Live Backend Data" style={{ marginLeft: 8 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {historyEvents.map((evt, i) => (
                <div key={i} style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <code style={{ fontSize: 11, color: 'var(--text-muted)' }}>Event {i + 1}</code>
                    {evt.isDelete && <Badge variant="revoked">Delete</Badge>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    txId: <span style={{ color: 'var(--accent-cyan)' }}>{evt.txId}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    timestamp: {evt.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Row 2: Action Panel + State Machine ───────────────────────────── */}
      <div className="grid-2" style={{ marginTop: 20 }}>
        {/* Action Panel */}
        <Card title="Lifecycle Mutation Actions" accent={isRevoked ? 'red' : 'amber'}>
          {isRevoked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', marginBottom: 16 }}>
              <XCircle size={16} color="var(--status-revoked)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-revoked)' }}>Terminal State — REVOKED</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  This credential is in a terminal REVOKED state. No further lifecycle mutations are possible.
                  The Fabric ledger record is immutable.
                </div>
              </div>
            </div>
          )}

          {/* Suspend */}
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-structural)', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PauseCircle size={14} color="var(--status-warning)" />
              Suspend Credential
              <DataTag type="LIVE" label="[A] POST .../suspend" style={{ marginLeft: 'auto' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Suspension Reason <DataTag type="DERIVED" label="[B] User/Input Data" /></label>
              <select
                className="form-input"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value as RevocationReason)}
                disabled={isRevoked}
                id="lifecycle-suspend-reason"
                style={{ marginTop: 6 }}
              >
                {REVOCATION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <Button
              variant="secondary"
              loading={actionLoading === 'suspend'}
              icon={<PauseCircle size={14} />}
              onClick={handleSuspend}
              disabled={isRevoked}
              id="lifecycle-suspend-btn"
              style={{ marginTop: 10 }}
            >
              Suspend Credential
            </Button>
          </div>

          {/* Reinstate */}
          <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-structural)', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PlayCircle size={14} color="var(--status-verified)" />
              Reinstate Credential
              <DataTag type="LIVE" label="[A] POST .../reinstate" style={{ marginLeft: 'auto' }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Reinstates a SUSPENDED credential to ACTIVE status. No request body required.
            </p>
            <Button
              variant="secondary"
              loading={actionLoading === 'reinstate'}
              icon={<PlayCircle size={14} />}
              onClick={handleReinstate}
              disabled={isRevoked}
              id="lifecycle-reinstate-btn"
            >
              Reinstate Credential
            </Button>
          </div>

          {/* Revoke */}
          <div style={{ padding: '14px', backgroundColor: 'rgba(239,68,68,0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-revoked)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <XCircle size={14} />
              Revoke Permanently
              <DataTag type="LIVE" label="[A] POST .../revoke" style={{ marginLeft: 'auto' }} />
            </div>
            <div className="form-group">
              <label className="form-label">
                Revocation Reason (required) <DataTag type="DERIVED" label="[B] User/Input Data" />
              </label>
              <select
                className="form-input"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value as RevocationReason)}
                disabled={isRevoked}
                id="lifecycle-revoke-reason"
                style={{ marginTop: 6 }}
              >
                {REVOCATION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <Button
              variant="danger"
              loading={actionLoading === 'revoke'}
              icon={<XCircle size={14} />}
              onClick={() => { setRevokeAcknowledged(false); setRevokeModalOpen(true); }}
              disabled={isRevoked}
              id="lifecycle-revoke-btn"
              style={{ marginTop: 10 }}
            >
              Revoke Permanently
            </Button>
          </div>
        </Card>

        {/* Lifecycle State Machine Reference */}
        <Card title="Lifecycle State Machine" accent="amber">
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
            Valid lifecycle transitions enforced by the chaincode. The frontend does not enforce these rules independently — all transitions are validated by the backend.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {[
              { from: 'ACTIVE', to: 'SUSPENDED', label: 'Suspend (reversible)', color: 'var(--status-warning)', terminal: false },
              { from: 'SUSPENDED', to: 'ACTIVE', label: 'Reinstate (reversible)', color: 'var(--status-verified)', terminal: false },
              { from: 'ACTIVE', to: 'REVOKED', label: 'Revoke — TERMINAL', color: 'var(--status-revoked)', terminal: true },
              { from: 'SUSPENDED', to: 'REVOKED', label: 'Revoke — TERMINAL', color: 'var(--status-revoked)', terminal: true },
            ].map(({ from, to, label, color, terminal }, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', backgroundColor: terminal ? 'rgba(239,68,68,0.05)' : 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: terminal ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border-structural)' }}>
                <Badge variant={statusVariant(from)} style={{ flexShrink: 0 }}>{from}</Badge>
                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>→</span>
                <Badge variant={statusVariant(to)} style={{ flexShrink: 0 }}>{to}</Badge>
                <span style={{ fontSize: 11, color, marginLeft: 4 }}>{label}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 12px', backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--status-revoked)' }}>Terminal State:</strong> REVOKED is a permanent terminal state. No reinstatement, suspension, or further mutation is possible once REVOKED.<br />
              <strong style={{ color: 'var(--status-warning)' }}>No-Op Rejection:</strong> Attempting to suspend an already-SUSPENDED credential, or reinstate an already-ACTIVE credential, will be rejected by the chaincode with NOOP_STATUS_TRANSITION.<br />
              <strong style={{ color: 'var(--text-secondary)' }}>ABAC:</strong> Only the original issuing organization (issuerOrg) may perform lifecycle mutations.
            </div>
          </div>
          <DataTag type="STATIC" label="[C] Chaincode Lifecycle Invariants — Backend-Authoritative" />
        </Card>
      </div>

      {/* ── Row 3: Action Response Panel ─────────────────────────────────── */}
      {(actionResult || actionError) && (
        <Card
          title="Backend Response"
          accent={actionError ? 'red' : 'green'}
          style={{ marginTop: 20 }}
          headerAction={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {actionLatency !== null && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{actionLatency}ms</span>}
              {actionError
                ? <Badge variant="revoked">Error</Badge>
                : <Badge variant="verified">HTTP 200</Badge>}
            </div>
          }
        >
          {actionError && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <XCircle size={14} color="var(--status-revoked)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-revoked)' }}>
                  {lastAction ? `${lastAction.charAt(0).toUpperCase() + lastAction.slice(1)} Failed` : 'Action Failed'}
                </span>
              </div>
              <div style={{ padding: '12px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{actionError}</div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                This error was returned directly by the backend API or chaincode. Common causes: CREDENTIAL_REVOCATION_IS_TERMINAL (credential already REVOKED),
                NOOP_STATUS_TRANSITION (no-op transition rejected), FORBIDDEN (caller org not authorized), CREDENTIAL_NOT_FOUND.
              </p>
              <div style={{ marginTop: 8 }}>
                <DataTag type="LIVE" label="[A] Live Backend Error Response — Backend-Authoritative, Not Frontend-Generated" />
              </div>
            </div>
          )}

          {actionResult && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle size={14} color="var(--status-verified)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-verified)' }}>
                  {actionMessage}
                </span>
              </div>
              <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Updated CredentialRecord — Fabric Ledger State</div>
                <FieldRow label="credentialId"         value={actionResult.credentialId}         classified={<DataTag type="LIVE" label="[A]" />} />
                <FieldRow label="status"               value={<span style={{ color: statusColor(actionResult.status), fontWeight: 700 }}>{actionResult.status}</span>} classified={<DataTag type="LIVE" label="[A] Live Backend Data" />} />
                <FieldRow label="issuerOrg"            value={actionResult.issuerOrg}            classified={<DataTag type="LIVE" label="[A]" />} />
                <FieldRow label="updatedAt"            value={actionResult.updatedAt}            classified={<DataTag type="LIVE" label="[A]" />} />
                <FieldRow label="version"              value={String(actionResult.version)}      classified={<DataTag type="LIVE" label="[A]" />} />
                {actionResult.revocationReason && (
                  <FieldRow label="revocationReason" value={String(actionResult.revocationReason)} classified={<DataTag type="LIVE" label="[A]" />} />
                )}
                {actionResult.revokedAt && (
                  <FieldRow label="revokedAt" value={actionResult.revokedAt} classified={<DataTag type="LIVE" label="[A]" />} />
                )}
              </div>
              {actionLatency !== null && (
                <div style={{ marginTop: 8 }}>
                  <DataTag type="LIVE" label={`[A] Live Backend Data · Fabric Latency: ${actionLatency}ms`} />
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Revocation Confirmation Modal ─────────────────────────────────── */}
      <Modal
        isOpen={revokeModalOpen}
        onClose={() => { setRevokeModalOpen(false); setRevokeAcknowledged(false); }}
        title="Confirm Permanent Revocation"
        maxWidth={520}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, padding: '12px 14px', backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)' }}>
          <XCircle size={18} color="var(--status-revoked)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--status-revoked)', marginBottom: 6 }}>Terminal Operation — Cannot Be Undone</div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Revocation is a permanent terminal state on the Fabric ledger. Once revoked, this credential cannot be reinstated.
              This action will submit a <code>RevokeCredential</code> transaction to the Fabric channel.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Target credential:</div>
          <code style={{ fontSize: 13, color: 'var(--accent-cyan)' }}>{credentialId}</code>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Revocation reason:</div>
          <Badge variant="revoked">{revokeReason}</Badge>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', backgroundColor: 'var(--bg-surface-lowest)', border: '1px solid var(--border-structural)', borderRadius: 'var(--radius-md)', marginBottom: 20, cursor: 'pointer' }}
          onClick={() => setRevokeAcknowledged((v) => !v)}
        >
          <div
            style={{ width: 16, height: 16, borderRadius: 3, border: revokeAcknowledged ? 'none' : '1px solid var(--border-interactive)', backgroundColor: revokeAcknowledged ? 'var(--status-revoked)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}
          >
            {revokeAcknowledged && <RefreshCw size={10} color="#fff" />}
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            I acknowledge that revocation is irreversible. This action will permanently revoke the credential on the Hyperledger Fabric ledger.
          </span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <DataTag type="STATIC" label="[C] Confirmation — Not a 2FA/MFA mechanism. Authorization enforced by backend ABAC." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button
            variant="outline"
            onClick={() => { setRevokeModalOpen(false); setRevokeAcknowledged(false); }}
            id="revoke-modal-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!revokeAcknowledged}
            icon={<XCircle size={14} />}
            onClick={handleRevokeConfirm}
            id="revoke-modal-confirm-btn"
          >
            Confirm Revocation
          </Button>
        </div>
      </Modal>
    </div>
  );
};
