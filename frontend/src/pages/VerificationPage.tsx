import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { DataTag } from '../components/common/DataTag';
import { AppRoute } from '../App';
import { credentialService } from '../services/credentialService';
import {
  VerificationRequest,
  VerificationResult,
  VerificationReason,
  CredentialStatus,
} from '../types';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  Clock,
  Search,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  Fingerprint,
  Layers,
  Lock,
  Database,
  Key,
  ChevronDown,
  ChevronUp,
  Hash,
  User,
  Calendar,
  Zap,
} from 'lucide-react';

interface VerificationPageProps {
  onNavigate: (route: AppRoute) => void;
}

interface DemoPreset {
  key: string;
  title: string;
  label: string;
  credentialId: string;
  subjectDID: string;
  credentialCommitment: string;
  expectedOutcome: VerificationReason;
  expectedValid: boolean;
  badgeText: string;
  badgeVariant: 'verified' | 'suspended' | 'revoked' | 'neutral';
  issuerOrg: string;
  credentialType: string;
  status: CredentialStatus;
  description: string;
}

const DEMO_PRESETS: Record<string, DemoPreset> = {
  'gov-id-9932-a': {
    key: 'gov-id-9932-a',
    title: 'Valid: Gov National ID (ACTIVE)',
    label: 'Valid • Gov National ID',
    credentialId: 'gov-id-9932-a',
    subjectDID: 'did:example:3a89e47c1b82f09d',
    credentialCommitment: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    expectedOutcome: 'VALID',
    expectedValid: true,
    badgeText: 'VALID',
    badgeVariant: 'verified',
    issuerOrg: 'Government of FabricID (GovMSP)',
    credentialType: 'National Identity Credential',
    status: 'ACTIVE',
    description: 'Active, verified identity card with matching on-chain commitment and valid expiration.',
  },
  'kyc-tier3-7801-b': {
    key: 'kyc-tier3-7801-b',
    title: 'Suspended: Banking KYC (SUSPENDED)',
    label: 'Suspended • Banking KYC',
    credentialId: 'kyc-tier3-7801-b',
    subjectDID: 'did:example:3a89e47c1b82f09d',
    credentialCommitment: '3a7bd231e5f891ad6b13904e2289410efca12389bcdae456908123456789abcd',
    expectedOutcome: 'SUSPENDED',
    expectedValid: false,
    badgeText: 'SUSPENDED',
    badgeVariant: 'suspended',
    issuerOrg: 'Consortium Central Bank (BankMSP)',
    credentialType: 'Financial KYC Tier-3 Verification',
    status: 'SUSPENDED',
    description: 'Temporarily suspended credential pending annual compliance and regulatory review.',
  },
  'deg-univ-4421-x': {
    key: 'deg-univ-4421-x',
    title: 'Revoked: Academic Degree (REVOKED)',
    label: 'Revoked • Academic Degree',
    credentialId: 'deg-univ-4421-x',
    subjectDID: 'did:example:3a89e47c1b82f09d',
    credentialCommitment: 'c5d2e38914b10293847561a0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0',
    expectedOutcome: 'REVOKED',
    expectedValid: false,
    badgeText: 'REVOKED',
    badgeVariant: 'revoked',
    issuerOrg: 'State Technological University (UniversityMSP)',
    credentialType: 'Bachelor of Science Degree',
    status: 'REVOKED',
    description: 'Permanently revoked credential due to academic record supersession.',
  },
  'emp-auth-2109-c': {
    key: 'emp-auth-2109-c',
    title: 'Expired: Work Authorization (EXPIRED)',
    label: 'Expired • Work Auth',
    credentialId: 'emp-auth-2109-c',
    subjectDID: 'did:example:3a89e47c1b82f09d',
    credentialCommitment: '89ab01cd23ef4567890123456789abcdef0123456789abcdef0123456789abcd',
    expectedOutcome: 'EXPIRED',
    expectedValid: false,
    badgeText: 'EXPIRED',
    badgeVariant: 'suspended',
    issuerOrg: 'Consortium Enterprise Employer (EmployerMSP)',
    credentialType: 'Employment Authorization Document',
    status: 'ACTIVE',
    description: 'Credential whose registered expiration timestamp has elapsed relative to ledger time.',
  },
  'hash-mismatch': {
    key: 'hash-mismatch',
    title: 'Mismatch: Commitment Hash Tampered',
    label: 'Mismatch • Hash Tampered',
    credentialId: 'gov-id-9932-a',
    subjectDID: 'did:example:3a89e47c1b82f09d',
    credentialCommitment: '0000000000000000000000000000000000000000000000000000000000000000',
    expectedOutcome: 'COMMITMENT_MISMATCH',
    expectedValid: false,
    badgeText: 'HASH MISMATCH',
    badgeVariant: 'revoked',
    issuerOrg: 'Government of FabricID (GovMSP)',
    credentialType: 'National Identity Credential',
    status: 'ACTIVE',
    description: 'Valid credential ID and subject, but presented claims commitment differs from on-chain hash.',
  },
  'subject-mismatch': {
    key: 'subject-mismatch',
    title: 'Mismatch: Subject DID Spoofed',
    label: 'Mismatch • Subject Spoofed',
    credentialId: 'gov-id-9932-a',
    subjectDID: 'did:example:attacker-spoofed-holder',
    credentialCommitment: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    expectedOutcome: 'SUBJECT_MISMATCH',
    expectedValid: false,
    badgeText: 'SUBJECT MISMATCH',
    badgeVariant: 'revoked',
    issuerOrg: 'Government of FabricID (GovMSP)',
    credentialType: 'National Identity Credential',
    status: 'ACTIVE',
    description: 'Presented credential matches commitment, but subject DID does not match registered holder.',
  },
  'not-found': {
    key: 'not-found',
    title: 'Unknown: Credential Not Found',
    label: 'Not Found • Unregistered ID',
    credentialId: 'cred-unknown-9999-z',
    subjectDID: 'did:example:3a89e47c1b82f09d',
    credentialCommitment: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    expectedOutcome: 'NOT_FOUND',
    expectedValid: false,
    badgeText: 'NOT FOUND',
    badgeVariant: 'revoked',
    issuerOrg: 'Unregistered',
    credentialType: 'Unknown',
    status: 'ACTIVE',
    description: 'Querying an identifier that does not exist in the Fabric world state database.',
  },
};

export const VerificationPage: React.FC<VerificationPageProps> = ({ onNavigate }) => {
  // Form Inputs [B] User/Input Data
  const [credentialId, setCredentialId] = useState<string>('gov-id-9932-a');
  const [subjectDID, setSubjectDID] = useState<string>('did:example:3a89e47c1b82f09d');
  const [credentialCommitment, setCredentialCommitment] = useState<string>(
    '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'
  );

  // Active preset key (for [D] labeling)
  const [activePresetKey, setActivePresetKey] = useState<string | null>('gov-id-9932-a');

  // Execution & Live Response State
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [backendLatencyMs, setBackendLatencyMs] = useState<number | null>(null);
  const [clientElapsedMs, setClientElapsedMs] = useState<number | null>(null);
  const [rawResponse, setRawResponse] = useState<any | null>(null);
  const [isLiveResult, setIsLiveResult] = useState<boolean>(false);
  const [backendOffline, setBackendOffline] = useState<boolean>(false);

  // Error States
  const [validationErrors, setValidationErrors] = useState<{
    credentialId?: string;
    subjectDID?: string;
    credentialCommitment?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // UI Utilities
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState<boolean>(false);

  // 1. URL Query Parameter Initialization
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paramId = params.get('id');
    if (paramId && paramId.trim()) {
      const cleanId = paramId.trim();
      const matchedPreset = Object.values(DEMO_PRESETS).find((p) => p.credentialId === cleanId);
      if (matchedPreset) {
        applyPreset(matchedPreset);
      } else {
        setCredentialId(cleanId);
        setActivePresetKey(null);
        // Attempt prefetch metadata if backend available
        credentialService.getCredential(cleanId).then((res) => {
          if (res.data) {
            if (res.data.subjectDID) setSubjectDID(res.data.subjectDID);
            if (res.data.credentialCommitment) {
              setCredentialCommitment(res.data.credentialCommitment.toLowerCase());
            }
          }
        }).catch(() => {
          // Keep existing values on failure
        });
      }
    }
  }, []);

  const applyPreset = (preset: DemoPreset) => {
    setCredentialId(preset.credentialId);
    setSubjectDID(preset.subjectDID);
    setCredentialCommitment(preset.credentialCommitment);
    setActivePresetKey(preset.key);
    setValidationErrors({});
    setServerError(null);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadResponse = () => {
    if (!rawResponse) return;
    const jsonStr = JSON.stringify(rawResponse, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verification-response-${credentialId || 'result'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. Form Submission Handler
  const handleExecuteVerification = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setServerError(null);

    // Client-side validation
    const errors: { credentialId?: string; subjectDID?: string; credentialCommitment?: string } = {};
    if (!credentialId.trim()) {
      errors.credentialId = 'Credential Identifier is required';
    } else if (!/^[a-zA-Z0-9_.:-]+$/.test(credentialId.trim())) {
      errors.credentialId = 'Invalid identifier format (letters, numbers, _:.- only)';
    }

    if (!subjectDID.trim()) {
      errors.subjectDID = 'Subject Application DID is required';
    } else if (!/^did:[a-z0-9]+:[a-zA-Z0-9_.:-]+$/.test(subjectDID.trim())) {
      errors.subjectDID = 'Invalid DID format (must be did:<method>:<identifier>)';
    }

    const cleanCommitment = credentialCommitment.trim().toLowerCase();
    if (!cleanCommitment) {
      errors.credentialCommitment = 'SHA-256 Credential Commitment is required';
    } else if (!/^[a-f0-9]{64}$/.test(cleanCommitment)) {
      errors.credentialCommitment = 'Commitment must be a 64-character lowercase hexadecimal SHA-256 digest';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setVerifying(true);
    const t0 = performance.now();

    // Update URL query parameter without full reload
    window.history.pushState(null, '', `/verify?id=${encodeURIComponent(credentialId.trim())}`);

    try {
      const res = await credentialService.verifyCredential({
        credentialId: credentialId.trim(),
        subjectDID: subjectDID.trim(),
        credentialCommitment: cleanCommitment,
      });

      const t1 = performance.now();
      const measuredElapsed = Math.round((t1 - t0) * 10) / 10;
      setClientElapsedMs(measuredElapsed);

      if (res && res.data) {
        setVerificationResult(res.data);
        setBackendLatencyMs(res.latencyMs ?? null);
        setRawResponse({
          endpoint: 'POST /api/v1/credentials/verify',
          status: res.status ?? 200,
          latencyMs: res.latencyMs ?? null,
          clientElapsedMs: measuredElapsed,
          data: res.data,
        });
        setIsLiveResult(true);
        setBackendOffline(false);
      } else {
        throw new Error(res.error || 'Empty response received from verification endpoint');
      }
    } catch (err: any) {
      const t1 = performance.now();
      const measuredElapsed = Math.round((t1 - t0) * 10) / 10;
      setClientElapsedMs(measuredElapsed);

      // Graceful offline demo fallback
      const currentPreset = activePresetKey ? DEMO_PRESETS[activePresetKey] : null;
      if (currentPreset && currentPreset.credentialId === credentialId.trim()) {
        // Construct truthful deterministic demo response for offline inspection
        const mockResult: VerificationResult = {
          valid: currentPreset.expectedValid,
          reason: currentPreset.expectedOutcome,
          credentialId: currentPreset.credentialId,
          subjectDID: currentPreset.expectedOutcome === 'NOT_FOUND' ? undefined : currentPreset.subjectDID,
          issuerOrg: currentPreset.expectedOutcome === 'NOT_FOUND' ? undefined : currentPreset.issuerOrg,
          credentialType: currentPreset.expectedOutcome === 'NOT_FOUND' ? undefined : currentPreset.credentialType,
          status: currentPreset.expectedOutcome === 'NOT_FOUND' ? undefined : currentPreset.status,
          verifiedAt: new Date().toISOString(),
        };

        setVerificationResult(mockResult);
        setBackendLatencyMs(null);
        setRawResponse({
          endpoint: 'POST /api/v1/credentials/verify [Demo Simulation - Backend Offline]',
          status: 200,
          latencyMs: null,
          clientElapsedMs: measuredElapsed,
          data: mockResult,
        });
        setIsLiveResult(false);
        setBackendOffline(true);
      } else {
        setVerificationResult(null);
        setRawResponse(null);
        setIsLiveResult(false);
        setBackendOffline(true);
        setServerError(
          err?.message ||
            'Fabric verification gateway is currently offline or unreachable. Live on-chain evaluation could not be completed.'
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  const getOutcomeDetails = (reason?: string, valid?: boolean) => {
    switch (reason) {
      case 'VALID':
        return {
          title: 'CRYPTOGRAPHIC AUDIT: VALID',
          subtitle: 'The presented credential matches on-chain commitment and subject DID. Lifecycle is ACTIVE with no revocation records.',
          badgeText: 'VALID',
          badgeVariant: 'verified' as const,
          color: '#10B981',
          bgColor: 'rgba(16, 185, 129, 0.08)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          icon: <CheckCircle2 size={24} color="#10B981" />,
        };
      case 'NOT_FOUND':
        return {
          title: 'VERIFICATION FAILED: NOT FOUND',
          subtitle: 'No credential record matching this identifier exists on the Hyperledger Fabric ledger world state.',
          badgeText: 'NOT FOUND',
          badgeVariant: 'revoked' as const,
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.08)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          icon: <XCircle size={24} color="#EF4444" />,
        };
      case 'SUBJECT_MISMATCH':
        return {
          title: 'VERIFICATION FAILED: SUBJECT MISMATCH',
          subtitle: 'The presented subject application DID does not match the registered holder DID anchored on the ledger.',
          badgeText: 'SUBJECT MISMATCH',
          badgeVariant: 'revoked' as const,
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.08)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          icon: <AlertOctagon size={24} color="#EF4444" />,
        };
      case 'COMMITMENT_MISMATCH':
        return {
          title: 'VERIFICATION FAILED: COMMITMENT MISMATCH',
          subtitle: 'The presented SHA-256 claims digest does not match the immutable cryptographic commitment on the ledger.',
          badgeText: 'HASH MISMATCH',
          badgeVariant: 'revoked' as const,
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.08)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          icon: <AlertTriangle size={24} color="#EF4444" />,
        };
      case 'REVOKED':
        return {
          title: 'VERIFICATION FAILED: CREDENTIAL REVOKED',
          subtitle: 'The issuing authority has permanently revoked this credential on the Fabric ledger.',
          badgeText: 'REVOKED',
          badgeVariant: 'revoked' as const,
          color: '#EF4444',
          bgColor: 'rgba(239, 68, 68, 0.08)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          icon: <XCircle size={24} color="#EF4444" />,
        };
      case 'SUSPENDED':
        return {
          title: 'VERIFICATION FAILED: CREDENTIAL SUSPENDED',
          subtitle: 'The credential has been temporarily suspended pending identity audit or regulatory compliance review.',
          badgeText: 'SUSPENDED',
          badgeVariant: 'suspended' as const,
          color: '#F59E0B',
          bgColor: 'rgba(245, 158, 11, 0.08)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          icon: <AlertTriangle size={24} color="#F59E0B" />,
        };
      case 'EXPIRED':
        return {
          title: 'VERIFICATION FAILED: CREDENTIAL EXPIRED',
          subtitle: 'The validity period for this credential has elapsed relative to the deterministic ledger evaluation timestamp.',
          badgeText: 'EXPIRED',
          badgeVariant: 'suspended' as const,
          color: '#F59E0B',
          bgColor: 'rgba(245, 158, 11, 0.08)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
          icon: <Clock size={24} color="#F59E0B" />,
        };
      default:
        return {
          title: valid ? 'VERIFICATION EVALUATED: VALID' : 'VERIFICATION FAILED',
          subtitle: `Evaluation completed with reason code: ${reason || 'UNKNOWN'}`,
          badgeText: reason || (valid ? 'VALID' : 'FAILED'),
          badgeVariant: (valid ? 'verified' : 'revoked') as 'verified' | 'revoked',
          color: valid ? '#10B981' : '#EF4444',
          bgColor: valid ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          borderColor: valid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
          icon: valid ? <CheckCircle2 size={24} color="#10B981" /> : <XCircle size={24} color="#EF4444" />,
        };
    }
  };

  const outcomeInfo = verificationResult
    ? getOutcomeDetails(verificationResult.reason as string, verificationResult.valid)
    : null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>
      {/* =========================================================================
          PAGE HEADER
         ========================================================================= */}
      <PageHeader
        title="Credential Verification Terminal"
        subtitle="Independent On-Chain Commitment, Subject DID & Lifecycle Audit"
        dataClassification="LIVE"
        dataTagLabel="[A] POST /api/v1/credentials/verify"
      />

      {/* =========================================================================
          SECTION 1: VERIFICATION SCOPE & NETWORK CONTEXT BANNER
         ========================================================================= */}
      <div
        style={{
          backgroundColor: '#0D131D',
          border: '1px solid #1C2735',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Shield size={18} style={{ color: '#38BDF8' }} />
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginRight: 8 }}>
              Zero-Trust Verification Engine
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Channel: <code style={{ color: '#38BDF8' }}>identity-channel</code> • Chaincode: <code style={{ color: '#FCD34D' }}>identity-registry</code>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }}>
          <span style={{ color: 'var(--text-muted)' }}>Execution Mode:</span>
          <span style={{ color: '#10B981', fontWeight: 600, backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: 4 }}>
            Read-Only Evaluate (Non-Mutating)
          </span>
          <DataTag type="STATIC" />
        </div>
      </div>

      {backendOffline && (
        <div
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <AlertTriangle size={18} color="#F59E0B" />
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#F59E0B', display: 'block', marginBottom: 2 }}>
              Verification Gateway Offline
            </strong>
            The live backend API gateway is currently unreachable. The terminal is operating in interactive demo simulation mode using verified portfolio presets labeled <DataTag type="SAMPLE" />.
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 2: VERIFICATION INPUT & DEMO PRESETS PANEL
         ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Left Column: Input Form [B] */}
        <Card title="Submit Verification Payload">
          <form onSubmit={handleExecuteVerification} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Target Hyperledger Fabric Evaluate Query
              </span>
              <DataTag type="DERIVED" />
            </div>

            {/* Credential ID */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Credential Identifier (credentialId):
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={credentialId}
                  onChange={(e) => {
                    setCredentialId(e.target.value);
                    setActivePresetKey(null);
                  }}
                  placeholder="e.g. gov-id-9932-a"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: '#070B12',
                    border: `1px solid ${validationErrors.credentialId ? '#EF4444' : '#1C2735'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                  }}
                />
              </div>
              {validationErrors.credentialId && (
                <div style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>
                  {validationErrors.credentialId}
                </div>
              )}
            </div>

            {/* Subject DID */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                Subject Application DID (subjectDID):
              </label>
              <input
                type="text"
                value={subjectDID}
                onChange={(e) => {
                  setSubjectDID(e.target.value);
                  setActivePresetKey(null);
                }}
                placeholder="did:example:..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: '#070B12',
                  border: `1px solid ${validationErrors.subjectDID ? '#EF4444' : '#1C2735'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              />
              {validationErrors.subjectDID && (
                <div style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>
                  {validationErrors.subjectDID}
                </div>
              )}
            </div>

            {/* Credential Commitment (SHA-256) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  SHA-256 Credential Commitment (lowercase hex):
                </label>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>64 hex chars</span>
              </div>
              <textarea
                rows={2}
                value={credentialCommitment}
                onChange={(e) => {
                  setCredentialCommitment(e.target.value);
                  setActivePresetKey(null);
                }}
                placeholder="64-character hex hash digest H(Claims)..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  backgroundColor: '#070B12',
                  border: `1px solid ${validationErrors.credentialCommitment ? '#EF4444' : '#1C2735'}`,
                  borderRadius: 'var(--radius-sm)',
                  color: '#38BDF8',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  resize: 'none',
                }}
              />
              {validationErrors.credentialCommitment && (
                <div style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>
                  {validationErrors.credentialCommitment}
                </div>
              )}
            </div>

            <Button
              variant="primary"
              loading={verifying}
              disabled={verifying}
              icon={<Shield size={14} />}
              onClick={handleExecuteVerification}
              style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
            >
              {verifying ? 'Evaluating On-Chain Commitment...' : 'Execute Verification Audit'}
            </Button>
          </form>
        </Card>

        {/* Right Column: Demo Presets [D] */}
        <Card title="Quick-Fill Test Presets">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Populate form with reference test cases covering all 7 chaincode evaluation outcomes:
              </span>
              <DataTag type="SAMPLE" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 310, overflowY: 'auto', paddingRight: 4 }}>
              {Object.values(DEMO_PRESETS).map((preset) => {
                const isActive = activePresetKey === preset.key;
                return (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      backgroundColor: isActive ? 'rgba(56, 189, 248, 0.1)' : '#070B12',
                      border: `1px solid ${isActive ? '#38BDF8' : '#1C2735'}`,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? '#38BDF8' : 'var(--text-primary)' }}>
                        {preset.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {preset.credentialId} • {preset.issuerOrg.split(' ')[0]}
                      </div>
                    </div>
                    <Badge variant={preset.badgeVariant}>
                      {preset.badgeText}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          SECTION 3: FIVE-STAGE VERIFICATION EXECUTION PIPELINE [C]
         ========================================================================= */}
      <div style={{ marginBottom: 24 }}>
        <Card title="5-Stage Chaincode Verification Logic Architecture">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Deterministic chaincode verification phases executed by{' '}
                <code style={{ color: '#38BDF8' }}>IdentityRegistryContract:VerifyCredential</code> on Hyperledger Fabric peer nodes.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DataTag type="STATIC" />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Explanatory Architecture Specification</span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.04)',
                border: '1px solid rgba(56, 189, 248, 0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              This pipeline depicts the logical evaluation sequence enforced inside the smart contract. It is an explanatory architectural model and not live sub-phase telemetry. Individual stages do not produce standalone transaction records or independent network timings.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
              {[
                {
                  num: '01',
                  title: 'Credential Lookup',
                  desc: 'Query composite key credential:<id> from CouchDB world state via ctx.stub.getState(). Triggers NOT_FOUND if key absent.',
                  trigger: 'NOT_FOUND',
                },
                {
                  num: '02',
                  title: 'Subject DID Match',
                  desc: 'Compare presented subjectDID against registered record.subjectDID. Triggers SUBJECT_MISMATCH if different.',
                  trigger: 'SUBJECT_MISMATCH',
                },
                {
                  num: '03',
                  title: 'Commitment Check',
                  desc: 'Evaluate presented SHA-256 commitment against on-chain hash. Triggers COMMITMENT_MISMATCH if bytes diverge.',
                  trigger: 'COMMITMENT_MISMATCH',
                },
                {
                  num: '04',
                  title: 'Lifecycle Status',
                  desc: 'Inspect registered lifecycle state. Triggers REVOKED if revoked, or SUSPENDED if temporarily barred.',
                  trigger: 'REVOKED / SUSPENDED',
                },
                {
                  num: '05',
                  title: 'Expiration & Verdict',
                  desc: 'Compare deterministic transaction timestamp against record.expiresAt. Triggers EXPIRED if elapsed, else VALID.',
                  trigger: 'EXPIRED / VALID',
                },
              ].map((stage, idx) => {
                return (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#0D131D',
                      border: '1px solid #1C2735',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#38BDF8', fontFamily: 'var(--font-mono)' }}>
                        STAGE {stage.num}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', backgroundColor: '#111A26', padding: '1px 5px', borderRadius: 3 }}>
                        [C]
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {stage.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1 }}>
                      {stage.desc}
                    </div>
                    <div style={{ fontSize: 10, color: '#FCD34D', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                      Rejection: {stage.trigger}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* =========================================================================
          SECTION 4: LIVE VERIFICATION RESULT BANNER
         ========================================================================= */}
      {serverError && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <AlertOctagon size={24} color="#EF4444" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', marginBottom: 2 }}>
              Gateway / Execution Error
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {serverError}
            </div>
          </div>
        </div>
      )}

      {verificationResult && outcomeInfo && (
        <div style={{ marginBottom: 24 }}>
          {/* Main Outcome Banner */}
          <div
            style={{
              backgroundColor: outcomeInfo.bgColor,
              border: `1px solid ${outcomeInfo.borderColor}`,
              borderRadius: 'var(--radius-sm)',
              padding: '20px 24px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
            }}
          >
            <div style={{ marginTop: 2 }}>{outcomeInfo.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: outcomeInfo.color, letterSpacing: '0.02em' }}>
                  {outcomeInfo.title}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DataTag type={isLiveResult ? 'LIVE' : 'SAMPLE'} />
                  <Badge variant={outcomeInfo.badgeVariant}>
                    {outcomeInfo.badgeText}
                  </Badge>
                </div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                {outcomeInfo.subtitle}
              </div>

              {/* Metadata Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 10,
                  backgroundColor: '#070B12',
                  border: '1px solid #1C2735',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>CREDENTIAL ID:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{verificationResult.credentialId}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>VERIFICATION REASON:</span>
                  <span style={{ color: outcomeInfo.color, fontWeight: 600 }}>{verificationResult.reason}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>REGISTERED STATUS:</span>
                  <span style={{ color: verificationResult.status === 'ACTIVE' ? '#10B981' : '#EF4444' }}>
                    {verificationResult.status || 'N/A (Unregistered)'}
                  </span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>ISSUING ORGANIZATION:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{verificationResult.issuerOrg || 'N/A'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>EVALUATION TIMESTAMP:</span>
                  <span style={{ color: '#38BDF8' }}>{verificationResult.verifiedAt}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>BACKEND LATENCY:</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {backendLatencyMs !== null ? `${backendLatencyMs} ms [A]` : 'Offline Simulation [D]'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SECTION 5: CRYPTOGRAPHIC LEDGER AUDIT RECEIPT
             ========================================================================= */}
          <Card title="Cryptographic Ledger Audit Receipt">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Panel A: Live Backend Fields */}
              <div
                style={{
                  backgroundColor: '#0D131D',
                  border: '1px solid #1C2735',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    [A] Authoritative Ledger Response Data
                  </span>
                  <DataTag type={isLiveResult ? 'LIVE' : 'SAMPLE'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Outcome Verdict: </span>
                    <strong style={{ color: outcomeInfo.color }}>{verificationResult.valid ? 'VALID' : 'INVALID'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Chaincode Reason: </span>
                    <strong style={{ color: outcomeInfo.color }}>{verificationResult.reason}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Subject DID: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{verificationResult.subjectDID || 'Omitted'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Credential Type: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{verificationResult.credentialType || 'Omitted'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Backend Latency: </span>
                    <span style={{ color: '#38BDF8' }}>{backendLatencyMs !== null ? `${backendLatencyMs} ms` : 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Evaluation Timestamp: </span>
                    <span style={{ color: 'var(--text-primary)' }}>{verificationResult.verifiedAt}</span>
                  </div>
                </div>
              </div>

              {/* Panel B: Derived Client Measurements */}
              <div
                style={{
                  backgroundColor: '#0D131D',
                  border: '1px solid #1C2735',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    [B] Derived Client Performance Measurements
                  </span>
                  <DataTag type="DERIVED" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>T_e2e (Frontend Round-Trip): </span>
                    <strong style={{ color: '#60A5FA' }}>{clientElapsedMs !== null ? `${clientElapsedMs} ms` : 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Measurement Method: </span>
                    <span style={{ color: 'var(--text-secondary)' }}>performance.now() dispatch-to-state</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Commitment Canonicalization: </span>
                    <span style={{ color: 'var(--text-secondary)' }}>SHA-256 hex digest verified</span>
                  </div>
                </div>
              </div>

              {/* Panel C: Verified Static Architecture Context */}
              <div
                style={{
                  backgroundColor: '#0D131D',
                  border: '1px solid #1C2735',
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    [C] Static Verified Consortium Architecture Context
                  </span>
                  <DataTag type="STATIC" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Consortium Channel: </span>
                    <span style={{ color: '#38BDF8' }}>identity-channel</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Raft Ordering Cluster: </span>
                    <span style={{ color: 'var(--text-primary)' }}>3 nodes (orderer1.gov, orderer2.uni, orderer3.bank)</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Consortium Organizations: </span>
                    <span style={{ color: 'var(--text-primary)' }}>4 orgs (Gov, University, Bank, Employer) / 8 peers</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Endorsement Policy: </span>
                    <span style={{ color: 'var(--text-primary)' }}>MAJORITY (3-of-4 consortium orgs)</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Ledger Privacy Guarantee: </span>
                    <span style={{ color: '#10B981' }}>Zero Raw PII on Ledger • SHA-256 Commitments</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Privacy Design: </span>
                    <span style={{ color: 'var(--text-secondary)' }}>Designed to minimize on-chain exposure of directly identifying credential data</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* =========================================================================
              SECTION 6: RAW JSON TELEMETRY VIEW & ACTION CONTROLS
             ========================================================================= */}
          <div style={{ marginTop: 24 }}>
            <Card title="Raw Verification Response (JSON Telemetry)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Verbatim response payload returned by the Fabric verification gateway:
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                      variant="outline"
                      onClick={() => handleCopy(JSON.stringify(rawResponse, null, 2), 'json')}
                      icon={copiedField === 'json' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    >
                      {copiedField === 'json' ? 'Copied' : 'Copy JSON Telemetry'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleDownloadResponse}
                      icon={<Download size={12} />}
                    >
                      Download Verification Response
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRawJson(!showRawJson)}
                      icon={showRawJson ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    >
                      {showRawJson ? 'Collapse JSON' : 'Expand JSON'}
                    </Button>
                  </div>
                </div>

                {showRawJson && (
                  <pre
                    style={{
                      backgroundColor: '#070B12',
                      border: '1px solid #1C2735',
                      borderRadius: 'var(--radius-sm)',
                      padding: 14,
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      color: '#38BDF8',
                      overflowX: 'auto',
                      maxHeight: 320,
                    }}
                  >
                    {JSON.stringify(rawResponse, null, 2)}
                  </pre>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION 7: NAVIGATION SHORTCUTS
         ========================================================================= */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 24 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" onClick={() => onNavigate('wallet')} icon={<Fingerprint size={14} />}>
            Open Citizen Wallet
          </Button>
          <Button variant="outline" onClick={() => onNavigate('network')} icon={<Layers size={14} />}>
            Hyperledger Network Explorer
          </Button>
        </div>

        {credentialId.trim() && (
          <Button
            variant="primary"
            onClick={() => {
              window.history.pushState(null, '', `/vault?id=${encodeURIComponent(credentialId.trim())}`);
              onNavigate('vault');
            }}
            icon={<ExternalLink size={14} />}
          >
            Inspect in Encrypted Vault
          </Button>
        )}
      </div>
    </div>
  );
};
