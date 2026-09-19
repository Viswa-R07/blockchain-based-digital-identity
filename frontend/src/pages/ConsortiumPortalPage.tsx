/*
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import { AppRoute } from '../App';
import {
  ArrowRight,
  Building2,
  ShieldCheck,
  Users,
  Lock,
  FileKey,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';

// [C] Verified Architecture — server-controlled type mappings
const CREDENTIAL_TYPE_MAP: Record<string, { label: string; schema: string }> = {
  'government-id': {
    label: 'GovernmentIdCredential',
    schema: 'https://schema.org/v1/GovernmentIdCredential.json',
  },
  academic: {
    label: 'AcademicDegreeCredential',
    schema: 'https://schema.org/v1/AcademicDegreeCredential.json',
  },
  kyc: {
    label: 'KYCCredential',
    schema: 'https://schema.org/v1/KYCCredential.json',
  },
  employment: {
    label: 'EmploymentCredential',
    schema: 'https://schema.org/v1/EmploymentCredential.json',
  },
};

// [C] Approved Consortium Organizations (No fictional names)
const ALL_ORGS = [
  {
    mspId: 'GovMSP',
    name: 'Government Identity Authority',
    role: 'GOV_ADMIN',
    issuerDid: 'did:example:gov:authority',
    credentialKey: 'government-id',
    color: 'var(--accent-cyan)',
    peers: 2,
  },
  {
    mspId: 'UniversityMSP',
    name: 'University',
    role: 'UNI_REGISTRAR',
    issuerDid: 'did:example:university:registrar',
    credentialKey: 'academic',
    color: 'var(--status-verified)',
    peers: 2,
  },
  {
    mspId: 'BankMSP',
    name: 'Bank',
    role: 'BANK_COMPLIANCE',
    issuerDid: 'did:example:bank:compliance',
    credentialKey: 'kyc',
    color: 'var(--status-warning)',
    peers: 2,
  },
  {
    mspId: 'EmployerMSP',
    name: 'Employer',
    role: 'EMP_HR',
    issuerDid: 'did:example:employer:hr',
    credentialKey: 'employment',
    color: 'var(--text-muted)',
    peers: 2,
  },
];

// [C] Authorization Invariants
const AUTHORIZATION_INVARIANTS = [
  'Credential issuance is restricted to the authenticated issuing organization matching the credential type.',
  'Lifecycle mutations are restricted to the original issuing organization (issuerOrg) on the ledger record.',
  'VERIFIER and CITIZEN roles cannot issue credentials or perform lifecycle mutations.',
  'Revocation is a permanent terminal state — no reinstatement path exists once REVOKED.',
  'Frontend role selection is a UI demonstration control only — it does not authorize backend operations.',
  'All 403 authorization errors are returned by the backend and displayed without modification.',
  'Citizens and verifiers are not Fabric MSP members (application DIDs remain separate from Fabric X.509 identities).',
];

const FieldRow: React.FC<{ label: string; value: React.ReactNode; id?: string }> = ({ label, value, id }) => (
  <div
    id={id}
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '8px 0',
      borderBottom: '1px solid var(--border-structural)',
      gap: 12,
    }}
  >
    <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{label}</span>
    <span
      style={{
        fontSize: 12,
        color: 'var(--text-primary)',
        fontFamily: 'monospace',
        wordBreak: 'break-all',
        textAlign: 'right',
      }}
    >
      {value}
    </span>
  </div>
);

export const ConsortiumPortalPage: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({ onNavigate }) => {
  const { currentPersona } = useAuth();
  const isInstitutional = currentPersona.allowedCredentialTypes.length > 0;
  const currentOrg = ALL_ORGS.find((o) => o.mspId === currentPersona.mspId);
  const currentCred = isInstitutional
    ? CREDENTIAL_TYPE_MAP[currentPersona.allowedCredentialTypes[0]]
    : null;

  const warningBg = {
    backgroundColor: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.3)',
  };
  const revokedBg = { backgroundColor: 'rgba(239,68,68,0.12)' };
  const cyanBg = { backgroundColor: 'rgba(56,189,248,0.12)' };
  const greyBg = { backgroundColor: 'rgba(100,116,139,0.12)' };

  return (
    <div id="portal-container">
      <PageHeader
        title="Institutional Authority Consortium Portal"
        subtitle="Credential Issuance Authority, Governance, and Consortium Architecture Dashboard"
        dataClassification="STATIC"
        dataTagLabel="[C] Architectural Reference"
        actions={
          isInstitutional ? (
            <>
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRight size={13} />}
                onClick={() => onNavigate('issue')}
                id="portal-cta-issue"
              >
                Issuance Pipeline
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigate('lifecycle')}
                id="portal-cta-lifecycle"
              >
                Lifecycle Center
              </Button>
            </>
          ) : undefined
        }
      />

      {!isInstitutional && (
        <div
          id="portal-non-institutional-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            marginBottom: 24,
            borderRadius: 'var(--radius-md)',
            ...warningBg,
          }}
        >
          <AlertTriangle size={18} color="var(--status-warning)" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-warning)' }}>
              Read-Only Access — No Issuance Authority
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
              The active persona <strong style={{ color: 'var(--text-primary)' }}>{currentPersona.name} ({currentPersona.mspId})</strong> does not hold credential issuance or lifecycle mutation authority. Issuance and lifecycle actions are strictly restricted to authenticated consortium member organizations.
            </div>
          </div>
        </div>
      )}

      {/* Row 1: Active Principal & Credential Scope */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Card A — Active Institutional Principal */}
        <div id="portal-card-principal">
          <Card title="Active Institutional Principal" accent="cyan" elevated>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-lowest)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 16,
                border: '1px solid var(--border-structural)',
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  ...(isInstitutional ? cyanBg : greyBg),
                }}
              >
                <Building2 size={22} color={isInstitutional ? 'var(--accent-cyan)' : 'var(--text-muted)'} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {currentPersona.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                  {currentPersona.roleTitle}
                </div>
              </div>
              <Badge variant={currentPersona.badgeColor} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                {currentPersona.mspId}
              </Badge>
            </div>

            <FieldRow label="MSP Identifier" value={<code>{currentPersona.mspId}</code>} id="principal-row-msp" />
            <FieldRow
              label="Issuer DID"
              value={
                currentOrg ? (
                  <code style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>{currentOrg.issuerDid}</code>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>None (External Principal)</span>
                )
              }
              id="principal-row-did"
            />
            <FieldRow
              label="Credential Authority"
              value={
                currentCred ? (
                  <span style={{ color: 'var(--status-verified)', fontWeight: 600 }}>{currentCred.label}</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}>None — read-only role</span>
                )
              }
              id="principal-row-authority"
            />
            {currentCred && (
              <FieldRow
                label="Schema ID"
                value={<code style={{ fontSize: 10 }}>{currentCred.schema}</code>}
                id="principal-row-schema"
              />
            )}
            <FieldRow
              label="Issuance Status"
              value={
                isInstitutional ? (
                  <span style={{ color: 'var(--status-verified)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} /> Authorized
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <XCircle size={12} /> Not authorized
                  </span>
                )
              }
              id="principal-row-status"
            />

            <div style={{ marginTop: 14 }}>
              <DataTag type="STATIC" label="[C] Architectural Reference — Not a Security Boundary" />
            </div>

            {isInstitutional ? (
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <Button
                  variant="primary"
                  icon={<ArrowRight size={14} />}
                  onClick={() => onNavigate('issue')}
                  id="card-issue-btn"
                >
                  Enter Issuance Pipeline
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onNavigate('lifecycle')}
                  id="card-lifecycle-btn"
                >
                  Lifecycle Center
                </Button>
              </div>
            ) : (
              <div
                id="card-no-authority-note"
                style={{
                  marginTop: 16,
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-lowest)',
                  border: '1px solid var(--border-structural)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                This institutional role does not hold credential issuance or lifecycle mutation authority. Issuance controls are hidden.
              </div>
            )}
          </Card>
        </div>

        {/* Card B — Credential Authority Scope */}
        <div id="portal-card-scope">
          <Card title="Credential Authority Scope" accent="green">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
              Each consortium organization is authorized to issue exactly one credential type, enforced by server-controlled issuer routing and ABAC at the API gateway.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ALL_ORGS.map((org) => {
                const ct = CREDENTIAL_TYPE_MAP[org.credentialKey];
                const isActive = org.mspId === currentPersona.mspId;
                const isAuth = isActive && isInstitutional;
                return (
                  <div
                    key={org.mspId}
                    id={`scope-row-${org.mspId.toLowerCase()}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isActive ? 'rgba(56,189,248,0.06)' : 'var(--bg-surface-lowest)',
                      border: isActive ? '1px solid rgba(56,189,248,0.25)' : '1px solid var(--border-structural)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          backgroundColor: isAuth
                            ? 'var(--status-verified)'
                            : isActive
                            ? 'var(--status-warning)'
                            : 'var(--border-interactive)',
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {ct.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {org.name} ({org.mspId}) · {org.role}
                        </div>
                      </div>
                    </div>
                    <Badge variant={isAuth ? 'verified' : isActive ? 'suspended' : 'neutral'}>
                      {isAuth ? 'Active Authority' : isActive ? 'Restricted' : 'Consortium Member'}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14 }}>
              <DataTag type="STATIC" label="[C] Server-Controlled Issuer Routing" />
            </div>
          </Card>
        </div>
      </div>

      {/* Row 2: Consortium Endorsement Architecture & Invariants */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Card C — Endorsement Architecture */}
        <div id="portal-card-endorsement">
          <Card title="Consortium Endorsement Architecture" accent="amber">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              All credential issuance and lifecycle mutations require endorsement from{' '}
              <strong style={{ color: 'var(--status-warning)' }}>3 of 4 consortium organizations</strong>{' '}
              (GovMSP, UniversityMSP, BankMSP, EmployerMSP) before the Fabric ordering service commits the transaction to the channel ledger.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {ALL_ORGS.map((org) => (
                <div
                  key={org.mspId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 10px',
                    backgroundColor: 'var(--bg-surface-lowest)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-structural)',
                  }}
                >
                  <Users size={12} color={org.color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{org.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginLeft: 6 }}>
                    {org.mspId} ({org.peers} Peers)
                  </span>
                  <CheckCircle size={12} color="var(--status-verified)" style={{ marginLeft: 'auto', flexShrink: 0 }} />
                </div>
              ))}
            </div>

            <div
              style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--status-warning)' }}>Topology:</strong> 4 Organizations · 8 Peers (2 per org) · 1 Channel: <code>identity-channel</code><br />
                <strong style={{ color: 'var(--status-warning)' }}>Ordering:</strong> 3 Raft orderers — <code>orderer1.gov</code>, <code>orderer2.university</code>, <code>orderer3.bank</code><br />
                <strong style={{ color: 'var(--status-warning)' }}>Consenter Role:</strong> EmployerMSP is an endorsing peer organization, not a Raft consenter/orderer.<br />
                <strong style={{ color: 'var(--status-warning)' }}>Consensus:</strong> Crash-fault tolerant (CFT) via Raft. Does not claim Byzantine fault tolerance (BFT).<br />
                <strong style={{ color: 'var(--status-warning)' }}>World State:</strong> Apache CouchDB state database per peer
              </div>
            </div>
            <DataTag type="STATIC" label="[C] Consortium Endorsement Context: MAJORITY (3-of-4)" />
          </Card>
        </div>

        {/* Card D — Authorization Invariants */}
        <div id="portal-card-invariants">
          <Card title="Backend Authorization Invariants" accent="red">
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              Enforced by the backend API gateway and chaincode ABAC — not the frontend.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AUTHORIZATION_INVARIANTS.map((rule, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    padding: '8px 10px',
                    backgroundColor: 'var(--bg-surface-lowest)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-structural)',
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      flexShrink: 0,
                      marginTop: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      ...revokedBg,
                    }}
                  >
                    <ShieldCheck size={10} color="var(--status-revoked)" />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{rule}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <DataTag type="STATIC" label="[C] Backend ABAC — Not Frontend-Enforced" />
            </div>
          </Card>
        </div>
      </div>

      {/* Row 3 — All Orgs Directory */}
      <div id="portal-card-directory">
        <Card
          title="Consortium Member Organizations"
          headerAction={<Badge variant="neutral">{ALL_ORGS.length} Member Organizations</Badge>}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12 }}>
            {ALL_ORGS.map((org) => {
              const cred = CREDENTIAL_TYPE_MAP[org.credentialKey];
              const isCurrent = org.mspId === currentPersona.mspId;
              return (
                <div
                  key={org.mspId}
                  id={`member-card-${org.mspId.toLowerCase()}`}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: isCurrent ? 'rgba(56,189,248,0.05)' : 'var(--bg-surface-lowest)',
                    border: isCurrent ? '1px solid rgba(56,189,248,0.2)' : '1px solid var(--border-structural)',
                    position: 'relative',
                  }}
                >
                  {isCurrent && (
                    <div style={{ position: 'absolute', top: 10, right: 10 }}>
                      <Badge variant="cyan">Active Principal</Badge>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--radius-sm)',
                        flexShrink: 0,
                        backgroundColor: 'var(--bg-surface-primary)',
                        border: '1px solid var(--border-structural)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Lock size={14} color={org.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{org.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {org.role}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                    MSP: <code style={{ color: 'var(--text-secondary)' }}>{org.mspId}</code> (2 Peers)
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, wordBreak: 'break-all' }}>
                    DID: <code style={{ color: 'var(--accent-cyan)', fontSize: 10 }}>{org.issuerDid}</code>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 8px',
                      backgroundColor: 'var(--bg-surface-primary)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-structural)',
                    }}
                  >
                    <FileKey size={11} color="var(--status-verified)" />
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{cred.label}</span>
                  </div>
                  {isCurrent && isInstitutional && (
                    <button
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 10,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-cyan)',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: 0,
                      }}
                      onClick={() => onNavigate('issue')}
                      id={`member-issue-btn-${org.mspId.toLowerCase()}`}
                    >
                      Enter Issuance Pipeline <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <DataTag type="STATIC" label="[C] Verified Architecture — Consortium Organization Reference" />
          </div>
        </Card>
      </div>

      {/* Privacy note */}
      <div
        id="portal-privacy-banner"
        style={{
          marginTop: 20,
          padding: '14px 18px',
          backgroundColor: 'var(--bg-surface-lowest)',
          border: '1px solid var(--border-structural)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <ShieldCheck size={16} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            Privacy-Preserving Architecture
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Privacy-preserving architecture designed to minimize exposure of directly identifying data.
            No raw PII is stored on the Fabric ledger. Credential claims are stored off-chain using AES-256-GCM encryption.
            Only SHA-256 cryptographic commitments and metadata are committed on-chain.
          </div>
          <div style={{ marginTop: 8 }}>
            <DataTag type="STATIC" label="[C] Off-Chain Privacy Architecture" />
          </div>
        </div>
      </div>
    </div>
  );
};
