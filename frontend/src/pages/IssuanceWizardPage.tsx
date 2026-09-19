/*
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import { AppRoute } from '../App';
import { credentialService } from '../services/credentialService';
import {
  CredentialType,
  CredentialRecord,
} from '../types';
import {
  FileCheck2,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  UserCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions & Canonicalization
// ─────────────────────────────────────────────────────────────────────────────

interface CredentialTypeConfig {
  typeKey: CredentialType;
  label: string;
  category: string;
  mspId: string;
  role: string;
  authoritativeIssuerDid: string;
  endpoint: string;
  defaultClaims: Record<string, any>;
}

const CREDENTIAL_TYPE_CONFIGS: Record<CredentialType, CredentialTypeConfig> = {
  'government-id': {
    typeKey: 'government-id',
    label: 'Government ID',
    category: 'Civil Identity Registry',
    mspId: 'GovMSP',
    role: 'GOV_ADMIN',
    authoritativeIssuerDid: 'did:example:gov:authority',
    endpoint: '/api/v1/credentials/government-id',
    defaultClaims: {
      documentType: 'NationalIdentityCard',
      jurisdiction: 'US-FED',
      nationalIdentifierHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      fullNameHash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    },
  },
  academic: {
    typeKey: 'academic',
    label: 'Academic Degree',
    category: 'Higher Education Accreditation',
    mspId: 'UniversityMSP',
    role: 'UNI_REGISTRAR',
    authoritativeIssuerDid: 'did:example:university:registrar',
    endpoint: '/api/v1/credentials/academic',
    defaultClaims: {
      degreeName: 'Bachelor of Science in Computer Science',
      institutionCode: 'APEX-UNIV-9921',
      graduationYear: 2024,
      honorsCategory: 'Summa Cum Laude',
    },
  },
  kyc: {
    typeKey: 'kyc',
    label: 'KYC / AML Compliance',
    category: 'Financial Banking Regulatory',
    mspId: 'BankMSP',
    role: 'BANK_COMPLIANCE',
    authoritativeIssuerDid: 'did:example:bank:compliance',
    endpoint: '/api/v1/credentials/kyc',
    defaultClaims: {
      complianceTier: 'Tier-3 Enhanced Due Diligence',
      jurisdictionCode: 'FINCEN-US',
      sanctionScreeningHash: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
      riskClassification: 'LOW_RISK',
    },
  },
  employment: {
    typeKey: 'employment',
    label: 'Employment Record',
    category: 'Corporate Human Resources',
    mspId: 'EmployerMSP',
    role: 'EMP_HR',
    authoritativeIssuerDid: 'did:example:employer:hr',
    endpoint: '/api/v1/credentials/employment',
    defaultClaims: {
      corporateEntity: 'OmniCorp Global Holdings Ltd.',
      departmentCode: 'ENG-INFRA-04',
      roleTitle: 'Lead Distributed Systems Engineer',
      employmentStatus: 'ACTIVE_FULL_TIME',
    },
  },
};

/**
 * Deterministic JSON canonicalization matching backend calculateCredentialCommitment.
 * Sorts object keys recursively to produce identical canonical UTF-8 bytes.
 */
function canonicalizeJson(val: any): string {
  if (val === null || val === undefined) return 'null';
  if (typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) {
    return `[${val.map(canonicalizeJson).join(',')}]`;
  }
  const keys = Object.keys(val).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(val[k])}`);
  return `{${entries.join(',')}}`;
}

// Client-side SHA-256 preview helper using browser crypto
async function computeSha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = enc.encode(str);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  const arr = Array.from(new Uint8Array(hashBuf));
  return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface IssuanceWizardPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const IssuanceWizardPage: React.FC<IssuanceWizardPageProps> = ({ onNavigate }) => {
  const { currentPersona, switchPersona } = useAuth();

  // Determine initial credential type based on current persona
  const initialType: CredentialType = useMemo(() => {
    if (currentPersona.id === 'UNI') return 'academic';
    if (currentPersona.id === 'BANK') return 'kyc';
    if (currentPersona.id === 'EMP') return 'employment';
    return 'government-id';
  }, [currentPersona.id]);

  const [selectedType, setSelectedType] = useState<CredentialType>(initialType);

  // Form inputs
  const [credentialId, setCredentialId] = useState<string>('');
  const [subjectDID, setSubjectDID] = useState<string>('did:example:alice123');
  const [issuerDID, setIssuerDID] = useState<string>(
    CREDENTIAL_TYPE_CONFIGS[initialType].authoritativeIssuerDid
  );
  const [expiresAt, setExpiresAt] = useState<string>(
    new Date(Date.now() + 10 * 365 * 24 * 3600 * 1000).toISOString().split('.')[0] + 'Z'
  );
  const [claimsJson, setClaimsJson] = useState<string>(
    JSON.stringify(CREDENTIAL_TYPE_CONFIGS[initialType].defaultClaims, null, 2)
  );

  // Client-side commitment preview
  const [computedCommitment, setComputedCommitment] = useState<string>('');
  const [commitmentError, setCommitmentError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [issuanceSuccess, setIssuanceSuccess] = useState<CredentialRecord | null>(null);
  const [issuanceLatency, setIssuanceLatency] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Storage state
  const [isStoring, setIsStoring] = useState<boolean>(false);
  const [storageResult, setStorageResult] = useState<{ message: string; keyId?: string } | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Sync issuerDID and default claims when selectedType changes
  useEffect(() => {
    const config = CREDENTIAL_TYPE_CONFIGS[selectedType];
    setIssuerDID(config.authoritativeIssuerDid);
    setClaimsJson(JSON.stringify(config.defaultClaims, null, 2));

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    if (selectedType === 'government-id') setCredentialId(`gov-id-${randomSuffix}`);
    else if (selectedType === 'academic') setCredentialId(`degree-cs-${randomSuffix}`);
    else if (selectedType === 'kyc') setCredentialId(`kyc-bank-${randomSuffix}`);
    else if (selectedType === 'employment') setCredentialId(`emp-corp-${randomSuffix}`);

    setIssuanceSuccess(null);
    setIssuanceLatency(null);
    setErrorMessage(null);
    setStorageResult(null);
    setStorageError(null);
  }, [selectedType]);

  // Compute canonical SHA-256 commitment preview
  useEffect(() => {
    let active = true;
    try {
      const parsed = JSON.parse(claimsJson);
      setCommitmentError(null);
      const canonical = canonicalizeJson(parsed);
      computeSha256Hex(canonical).then((hash) => {
        if (active) setComputedCommitment(hash);
      });
    } catch {
      if (active) {
        setCommitmentError('Invalid JSON format');
        setComputedCommitment('');
      }
    }
    return () => {
      active = false;
    };
  }, [claimsJson]);

  // Access check: Only institutional personas can issue
  const isVerifierOrCitizen = currentPersona.id === 'VERIFIER' || currentPersona.id === 'CITIZEN';

  // Check if current persona MSP matches selected type MSP
  const currentConfig = CREDENTIAL_TYPE_CONFIGS[selectedType];
  const isMspMismatch = currentPersona.mspId !== currentConfig.mspId;

  // Handle Form Submission (Real Fabric Gateway Mutation)
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialId.trim() || !subjectDID.trim() || !issuerDID.trim() || !computedCommitment) {
      setErrorMessage('All credential input fields and a valid SHA-256 commitment are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setIssuanceSuccess(null);
    setStorageResult(null);
    setStorageError(null);

    const payload = {
      credentialId: credentialId.trim(),
      subjectDID: subjectDID.trim(),
      issuerDID: issuerDID.trim(),
      credentialCommitment: computedCommitment.trim().toLowerCase(),
      expiresAt: expiresAt.trim(),
    };

    const res = await credentialService.issueCredential(selectedType, payload);
    setIsSubmitting(false);

    if (res.error || !res.data) {
      setErrorMessage(res.error || 'Credential issuance rejected by Fabric Gateway.');
    } else {
      setIssuanceSuccess(res.data);
      setIssuanceLatency(res.latencyMs);
    }
  };

  // Handle Optional Off-Chain Encrypted Storage (Real Storage API)
  const handleStoreEncrypted = async () => {
    if (!issuanceSuccess) return;
    setIsStoring(true);
    setStorageError(null);
    setStorageResult(null);

    try {
      const parsedClaims = JSON.parse(claimsJson);
      const res = await credentialService.storeCredential(issuanceSuccess.credentialId, parsedClaims);
      setIsStoring(false);
      if (res.error || !res.data) {
        setStorageError(res.error || 'Failed to persist encrypted payload to off-chain storage.');
      } else {
        setStorageResult({
          message: (res.data as any).message || 'Payload encrypted and stored off-chain successfully.',
          keyId: (res.data as any).metadata?.keyId || undefined,
        });
      }
    } catch (err: any) {
      setIsStoring(false);
      setStorageError(err.message || 'Error processing claims payload for storage.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Simplified Credential Issuance"
        subtitle="Institutional Credential Minting & Hyperledger Fabric Ledger Confirmation"
        dataClassification="LIVE"
        dataTagLabel="[A] Active Fabric Gateway Endpoints"
      />

      {/* ── Visual Workflow Breadcrumb Indicator ── */}
      <Card accent="cyan" style={{ marginBottom: 24, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              WORKFLOW PIPELINE:
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>1. Input</span>
            <ArrowRight size={13} color="var(--text-muted)" />
            <span style={{ color: computedCommitment ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: 600 }}>
              2. Commitment
            </span>
            <ArrowRight size={13} color="var(--text-muted)" />
            <span style={{ color: isSubmitting ? 'var(--status-warning)' : 'var(--text-muted)', fontWeight: 600 }}>
              3. Fabric Transaction
            </span>
            <ArrowRight size={13} color="var(--text-muted)" />
            <span style={{ color: issuanceSuccess ? 'var(--status-verified)' : 'var(--text-muted)', fontWeight: 600 }}>
              4. Ledger Confirmation
            </span>
            <ArrowRight size={13} color="var(--text-muted)" />
            <span style={{ color: storageResult ? 'var(--accent-cyan)' : 'var(--text-muted)', fontWeight: 600 }}>
              5. Optional Storage
            </span>
          </div>
          <DataTag type="STATIC" label="[C] Visual Workflow Indicator" />
        </div>
      </Card>

      {/* ── Access Control Warning for Citizen / Verifier ── */}
      {isVerifierOrCitizen ? (
        <Card accent="amber" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <AlertCircle size={22} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                Consortium Issuance Restricted ({currentPersona.name})
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                Under consortium ABAC policy, credential issuance is strictly limited to authenticated institutional
                issuers (<code style={{ color: 'var(--accent-cyan)' }}>GovMSP</code>,{' '}
                <code style={{ color: 'var(--accent-cyan)' }}>UniversityMSP</code>,{' '}
                <code style={{ color: 'var(--accent-cyan)' }}>BankMSP</code>,{' '}
                <code style={{ color: 'var(--accent-cyan)' }}>EmployerMSP</code>). Callers authenticated as external
                verifiers or citizens cannot submit issuance transactions to the Fabric Gateway.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button variant="primary" icon={<UserCheck size={14} />} onClick={() => switchPersona('GOV')}>
                  Switch to Government (GovMSP)
                </Button>
                <Button variant="outline" onClick={() => switchPersona('UNI')}>
                  Switch to University
                </Button>
                <Button variant="outline" onClick={() => switchPersona('BANK')}>
                  Switch to Bank
                </Button>
                <Button variant="outline" onClick={() => switchPersona('EMP')}>
                  Switch to Employer
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {/* ── Main Issuance Form ── */}
      <form onSubmit={handleIssueSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 24, marginBottom: 24 }}>
          {/* Left Column: Credential Parameters & Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Section 1: Credential Type Selection */}
            <Card title="1. Credential Classification" accent="cyan">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select consortium credential type:</span>
                <DataTag type="STATIC" label="[C] Consortium Type Registry" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                {(Object.keys(CREDENTIAL_TYPE_CONFIGS) as CredentialType[]).map((type) => {
                  const cfg = CREDENTIAL_TYPE_CONFIGS[type];
                  const isSelected = selectedType === type;
                  const isMatchingPersona = currentPersona.mspId === cfg.mspId;
                  return (
                    <div
                      key={type}
                      onClick={() => setSelectedType(type)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
                        border: isSelected ? '1px solid var(--accent-cyan)' : '1px solid var(--border-structural)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                          {cfg.label}
                        </span>
                        {isMatchingPersona && <Badge variant="verified">Caller Org</Badge>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {cfg.mspId} • {cfg.role}
                      </div>
                    </div>
                  );
                })}
              </div>

              {isMspMismatch && !isVerifierOrCitizen && (
                <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-highest)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-interactive)', fontSize: 12, color: 'var(--status-warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    Current caller is <strong>{currentPersona.mspId}</strong>. Issuing this credential requires{' '}
                    <strong>{currentConfig.mspId}</strong>.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (currentConfig.mspId === 'GovMSP') switchPersona('GOV');
                      else if (currentConfig.mspId === 'UniversityMSP') switchPersona('UNI');
                      else if (currentConfig.mspId === 'BankMSP') switchPersona('BANK');
                      else if (currentConfig.mspId === 'EmployerMSP') switchPersona('EMP');
                    }}
                  >
                    Switch MSP
                  </Button>
                </div>
              )}
            </Card>

            {/* Section 2: Credential Parameters */}
            <Card title="2. On-Chain Credential Parameters" accent="cyan">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Credential ID */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Credential ID
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unique ledger key</span>
                  </div>
                  <input
                    type="text"
                    value={credentialId}
                    onChange={(e) => setCredentialId(e.target.value)}
                    placeholder="e.g. gov-id-9921"
                    required
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-lowest)',
                      border: '1px solid var(--border-structural)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Subject DID */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Subject DID
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Citizen holder DID</span>
                  </div>
                  <input
                    type="text"
                    value={subjectDID}
                    onChange={(e) => setSubjectDID(e.target.value)}
                    placeholder="did:example:alice123"
                    required
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-lowest)',
                      border: '1px solid var(--border-structural)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Issuer DID */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Issuer DID (Bound to {currentConfig.mspId})
                    </label>
                    <DataTag type="STATIC" label="[C] SEC-ROUTE-04 Bound" />
                  </div>
                  <input
                    type="text"
                    value={issuerDID}
                    onChange={(e) => setIssuerDID(e.target.value)}
                    required
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-lowest)',
                      border: '1px solid var(--border-structural)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>

                {/* Expiration Date */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Expiration Date (ISO-8601 UTC)
                    </label>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Temporal validity threshold</span>
                  </div>
                  <input
                    type="text"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    required
                    className="font-mono"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-surface-lowest)',
                      border: '1px solid var(--border-structural)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column: Claims Payload & SHA-256 Commitment Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Section 3: Off-Chain Claims Payload */}
            <Card title="3. Off-Chain Claims & Canonical Commitment" accent="cyan">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Plaintext claims (never committed directly to ledger):
                </span>
                <DataTag type="DERIVED" label="[B] SHA-256 Preview" />
              </div>

              <textarea
                rows={7}
                value={claimsJson}
                onChange={(e) => setClaimsJson(e.target.value)}
                className="font-mono"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-lowest)',
                  border: commitmentError ? '1px solid var(--status-revoked)' : '1px solid var(--border-structural)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  resize: 'vertical',
                }}
              />

              {commitmentError && (
                <div style={{ fontSize: 11, color: 'var(--status-revoked)', marginTop: 4 }}>
                  {commitmentError}
                </div>
              )}

              {/* SHA-256 Commitment Preview Box */}
              <div style={{ marginTop: 14, padding: '12px', backgroundColor: 'var(--bg-surface-lowest)', border: '1px solid var(--border-structural)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <KeyRound size={13} /> Computed SHA-256 Commitment Digest
                  </span>
                  <Badge variant="cyan" className="font-mono">64-char Hex</Badge>
                </div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    color: computedCommitment ? 'var(--text-primary)' : 'var(--text-muted)',
                    wordBreak: 'break-all',
                    backgroundColor: 'var(--bg-surface-highest)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-xs)',
                  }}
                >
                  {computedCommitment || 'Awaiting valid JSON claims payload...'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                  Computed via recursive key-sorted canonicalization. Authoritative commitment verified by backend.
                </div>
              </div>

              {/* Submission Action */}
              <div style={{ marginTop: 20 }}>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ width: "100%" }}
                  disabled={isSubmitting || !computedCommitment || isVerifierOrCitizen}
                  icon={isSubmitting ? <RefreshCw size={14} className="spin" /> : <FileCheck2 size={14} />}
                >
                  {isSubmitting ? 'Submitting to Fabric Gateway...' : `Issue ${currentConfig.label} to Ledger`}
                </Button>
              </div>

              {errorMessage && (
                <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-revoked)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--status-revoked)' }}>
                  <strong>Issuance Error:</strong> {errorMessage}
                </div>
              )}
            </Card>
          </div>
        </div>
      </form>

      {/* ── Section 4: Ledger Confirmation & Record Result ── */}
      {issuanceSuccess && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
          <Card accent="green">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={22} color="var(--status-verified)" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-verified)' }}>
                    Ledger credential record created.
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Transaction confirmed on <code>identity-channel</code> via 3-of-4 consortium endorsement.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {issuanceLatency !== null && (
                  <Badge variant="cyan" className="font-mono">
                    API Round-Trip: {issuanceLatency}ms
                  </Badge>
                )}
                <DataTag type="LIVE" label="[A] Fabric Record" />
              </div>
            </div>

            {/* Returned Record Details */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Credential ID</div>
                <div className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                  {issuanceSuccess.credentialId}
                </div>
              </div>
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</div>
                <div style={{ marginTop: 4 }}>
                  <Badge variant="verified">{issuanceSuccess.status}</Badge>
                </div>
              </div>
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Subject DID</div>
                <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {issuanceSuccess.subjectDID}
                </div>
              </div>
              <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Issuer Org / MSP</div>
                <div className="font-mono" style={{ fontSize: 12, color: 'var(--accent-cyan)', marginTop: 2 }}>
                  {issuanceSuccess.issuerOrg}
                </div>
              </div>
            </div>

            <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>On-Chain Commitment Hash</div>
              <div className="font-mono" style={{ fontSize: 11, color: 'var(--accent-cyan)', wordBreak: 'break-all' }}>
                {issuanceSuccess.credentialCommitment}
              </div>
            </div>

            {/* ── Section 5: Optional Post-Issuance Storage ── */}
            <div style={{ borderTop: '1px solid var(--border-structural)', paddingTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Optional Off-Chain Encrypted Storage
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Encrypt claims payload with AES-256-GCM and store in institutional off-chain vault.
                  </div>
                </div>
                <DataTag type="STATIC" label="[C] AES-256-GCM Vault" />
              </div>

              {storageResult ? (
                <div style={{ padding: '10px 14px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--status-verified)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: 'var(--status-verified)' }}>
                    ✓ {storageResult.message}
                    {storageResult.keyId ? <> (Key: <code>{storageResult.keyId}</code>)</> : null}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ExternalLink size={13} />}
                    onClick={() => onNavigate('vault')}
                  >
                    View in Encrypted Vault
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Button
                    variant="outline"
                    disabled={isStoring}
                    icon={isStoring ? <RefreshCw size={13} className="spin" /> : <Lock size={13} />}
                    onClick={handleStoreEncrypted}
                  >
                    {isStoring ? 'Encrypting & Storing...' : 'Persist to Off-Chain Encrypted Storage'}
                  </Button>
                  <Button
                    variant="outline"
                    icon={<ExternalLink size={13} />}
                    onClick={() => onNavigate('vault')}
                  >
                    Open Vault Inspector
                  </Button>
                </div>
              )}

              {storageError && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--status-revoked)' }}>
                  {storageError}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
