import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { AppRoute } from '../App';
import {
  ShieldCheck,
  ArrowRight,
  Network,
  Lock,
  FileCheck,
  CheckCircle2,
  Building2,
  GraduationCap,
  Landmark,
  Briefcase,
  Key,
  Layers,
  Search,
  Fingerprint,
  Database,
  Cpu,
  RefreshCw,
  Eye,
  Server,
  Terminal,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';

export const LandingPage: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({ onNavigate }) => {
  const { isConnected, latencyMs, lastChecked } = useNetwork();
  const [selectedPreset, setSelectedPreset] = useState<'alice' | 'degree' | 'kyc'>('alice');
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<any>(null);

  const presets = {
    alice: {
      label: 'National Identity Credential',
      did: 'did:example:alice123',
      credId: 'cred:gov:nat-98210',
      msp: 'GovMSP',
      hash: '9f83a213e48816b8018612654fb88702b0052682d20e171d7b716839a8524419',
      status: 'ACTIVE',
      schema: 'NationalIdentityCredential',
    },
    degree: {
      label: 'B.S. Computer Science Degree',
      did: 'did:example:bob456',
      credId: 'cred:uni:degree-44102',
      msp: 'UniversityMSP',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'ACTIVE',
      schema: 'AcademicDegreeCredential',
    },
    kyc: {
      label: 'Tier-1 KYC Verification',
      did: 'did:example:charlie789',
      credId: 'cred:bank:kyc-10928',
      msp: 'BankMSP',
      hash: '5d41402abc4b2a76b9719d911017c59223a5cf7f2824da5717361405b630018f',
      status: 'ACTIVE',
      schema: 'KycVerificationCredential',
    },
  };

  const handleEvaluate = () => {
    setEvaluating(true);
    setEvalResult(null);
    setTimeout(() => {
      setEvaluating(false);
      const active = presets[selectedPreset];
      setEvalResult({
        credentialId: active.credId,
        subjectDid: active.did,
        issuerOrg: active.msp,
        schema: active.schema,
        commitmentHash: active.hash,
        status: active.status,
        revocationFlag: false,
        evaluatedAt: new Date().toISOString(),
        endorsementPolicy: '3-of-4 Orgs Validated',
        channel: 'identity-channel',
        chaincode: 'identity-registry v3.0',
        blockHeight: 613,
      });
    }, 600);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
      {/* 1. HERO SECTION */}
      <section
        style={{
          position: 'relative',
          padding: '48px 36px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--bg-surface-primary)',
          border: '1px solid var(--border-structural)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--accent-cyan)',
                letterSpacing: '0.08em',
                padding: '3px 8px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--accent-cyan-container)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              FABRICID • HLF 2.5.16 CANONICAL DARK
            </span>
            <DataTag type="STATIC" label="[C] Enterprise Identity Infrastructure" />
          </div>

          <h1
            style={{
              fontSize: 38,
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
              marginBottom: 16,
            }}
          >
            FabricID — Your Identity. <span style={{ color: 'var(--accent-cyan)' }}>Verified.</span> Trusted.
          </h1>

          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              color: 'var(--text-secondary)',
              marginBottom: 28,
            }}
          >
            <strong>FabricID</strong> is a privacy-preserving enterprise digital identity platform powered by <strong>Hyperledger Fabric 2.5.16</strong>,
            enabling sovereign verifiable credentials across governments, universities, banks, and employers
            without exposing raw Personally Identifiable Information (PII) on-chain.
          </p>

          {/* Infrastructure Quick Ticker */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              padding: '12px 18px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-surface-lowest)',
              border: '1px solid var(--border-structural)',
              marginBottom: 32,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className={`pulse-dot ${
                  isConnected ? 'pulse-dot-green' : 'pulse-dot-amber'
                }`}
              />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {isConnected ? 'Gateway Online' : 'Connecting...'}
              </span>
              <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                {latencyMs}ms
              </span>
              <DataTag type="LIVE" label="[A]" />
            </div>
            <span style={{ color: 'var(--border-interactive)' }}>|</span>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Channel: </span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                identity-channel
              </span>
            </div>
            <span style={{ color: 'var(--border-interactive)' }}>|</span>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Consensus: </span>
              <span style={{ color: 'var(--status-verified)' }}>3-Node Raft (CFT)</span>
            </div>
            <span style={{ color: 'var(--border-interactive)' }}>|</span>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Endorsement: </span>
              <span style={{ color: 'var(--accent-blue)' }}>3-of-4 Org Policy</span>
            </div>
            <span style={{ color: 'var(--border-interactive)' }}>|</span>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Ledger Height: </span>
              <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                Block #613
              </span>
              <DataTag type="SAMPLE" label="[D]" />
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <Button
              variant="primary"
              icon={<ArrowRight size={16} />}
              onClick={() => onNavigate('issue')}
            >
              Launch Issuance Pipeline
            </Button>
            <Button
              variant="secondary"
              icon={<CheckCircle2 size={16} />}
              onClick={() => onNavigate('verify')}
            >
              Open Verification Terminal
            </Button>
            <Button
              variant="outline"
              icon={<Network size={16} />}
              onClick={() => onNavigate('network')}
            >
              Explore Consortium Network
            </Button>
          </div>
        </div>
      </section>

      {/* 2. FOUR INSTITUTIONAL ANCHOR ORGANIZATIONS */}
      <section>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              Four Institutional Anchor Organizations
            </h2>
            <DataTag type="STATIC" label="[C] Consortium Trust Model" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Each organization administers 2 validating peers with sovereign X.509 certificates to maintain consensus
            and endorse identity assertions under the 3-of-4 organization endorsement policy. Citizens interact
            exclusively as application users.
          </p>
        </div>

        <div className="grid-4">
          <Card accent="cyan" title="Government Authority">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Building2 size={18} color="var(--accent-cyan)" />
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                GovMSP
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Issues sovereign national identity claims, passport assertions, and legal persona roots. Endorses
              national digital residency.
            </p>
            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid var(--border-structural)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              Peers: <span className="font-mono">peer0.gov, peer1.gov</span> (7051/7052)
            </div>
          </Card>

          <Card accent="green" title="Higher Education">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <GraduationCap size={18} color="var(--status-verified)" />
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                UniversityMSP
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Mints immutable academic degrees, postgraduate diplomas, and accredited professional credentials
              without raw transcript leakage.
            </p>
            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid var(--border-structural)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              Peers: <span className="font-mono">peer0.uni, peer1.uni</span> (8051/8052)
            </div>
          </Card>

          <Card accent="amber" title="Banking Consortium">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Landmark size={18} color="var(--status-suspended)" />
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                BankMSP
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Validates institutional KYC compliance, AML screening attestations, and accredited investor
              qualifications across financial boundaries.
            </p>
            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid var(--border-structural)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              Peers: <span className="font-mono">peer0.bank, peer1.bank</span> (9051/9052)
            </div>
          </Card>

          <Card accent="red" title="Enterprise Employer">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Briefcase size={18} color="var(--accent-blue)" />
              <span className="font-mono" style={{ fontSize: 12, fontWeight: 600 }}>
                EmployerMSP
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Endorses corporate tenure, operational roles, enterprise access delegations, and high-security
              compliance clearances.
            </p>
            <div
              style={{
                marginTop: 14,
                paddingTop: 10,
                borderTop: '1px solid var(--border-structural)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              Peers: <span className="font-mono">peer0.emp, peer1.emp</span> (10051/10052)
            </div>
          </Card>
        </div>
      </section>

      {/* 3. ARCHITECTURAL SEPARATION: OFF-CHAIN VS ON-CHAIN */}
      <section>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              Architectural Separation: Off-Chain vs On-Chain
            </h2>
            <DataTag type="STATIC" label="[C] Privacy-By-Design" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Strict data boundary engineered to protect subject privacy. Zero raw Personally Identifiable
            Information (PII) is committed to ledger storage.
          </p>
        </div>

        <div className="grid-2">
          {/* Off-Chain Data Vault */}
          <Card accent="green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Lock size={18} color="var(--status-verified)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Off-Chain Data Vault (AES-256-GCM)
                </h3>
              </div>
              <Badge variant="verified">Sovereign Custody</Badge>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              Protected decentralized storage under citizen sovereign custody. Sensitive identity claims are
              symmetrically encrypted using AES-256-GCM with unique 12-byte initialization vectors (IV) and
              128-bit authentication tags before dispatch.
            </p>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-lowest)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-structural)',
                fontSize: 12,
                lineHeight: 1.6,
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Contained Data Elements:
              </div>
              <ul style={{ paddingLeft: 18, color: 'var(--text-secondary)' }}>
                <li>Direct citizen identity claims (Full Legal Name, Date of Birth, National ID #)</li>
                <li>Verifiable academic credentials and degree certificates</li>
                <li>Financial compliance records &amp; corporate employment telemetry</li>
              </ul>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong>Erasure Model:</strong> Permanently deletes encrypted off-chain ciphertext, supporting
              erasure of directly identifying off-chain data.
            </div>
          </Card>

          {/* On-Chain Ledger */}
          <Card accent="cyan">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={18} color="var(--accent-cyan)" />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Hyperledger Fabric Ledger (identity-channel)
                </h3>
              </div>
              <Badge variant="cyan">Immutable State</Badge>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              Immutable WorldState (CouchDB) and orderer transaction blocks replicated across 8 enterprise peers via
              chaincode <span className="font-mono">identity-registry v3.0</span>. Only cryptographic state
              commitments and lifecycle status are anchored on-chain.
            </p>

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--bg-surface-lowest)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-structural)',
                fontSize: 12,
                lineHeight: 1.6,
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Contained Data Elements:
              </div>
              <ul style={{ paddingLeft: 18, color: 'var(--text-secondary)' }}>
                <li>One-way SHA-256 cryptographic commitment digests (64-char hex)</li>
                <li>Decentralized Identifier (DID) state anchors and institutional ownership mappings</li>
                <li>Tamper-evident credential status (Active, Suspended, Revoked) &amp; timestamped audit log</li>
              </ul>
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong>Zero-PII Guarantee:</strong> Even with full ledger access, mathematical one-way digests
              cannot be reversed to extract raw citizen attributes.
            </div>
          </Card>
        </div>
      </section>

      {/* 4. SEVEN-STAGE ZERO-TRUST ISSUANCE PIPELINE */}
      <section>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              Seven-Stage Zero-Trust Issuance Pipeline
            </h2>
            <DataTag type="STATIC" label="[C] Protocol Workflow" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Approved deterministic issuance workflow. Crucially, encrypted off-chain storage occurs strictly as Stage 7, post-ledger commit.
          </p>
        </div>

        {/* Pipeline Stepper Visual Tracker */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            backgroundColor: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-structural)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            overflowX: 'auto',
            gap: 8,
          }}
        >
          {[
            { num: 1, label: '1. Subject Verification' },
            { num: 2, label: '2. Schema Mapping' },
            { num: 3, label: '3. Claims Prep' },
            { num: 4, label: '4. Encryption Prep' },
            { num: 5, label: '5. Commitment Gen' },
            { num: 6, label: '6. Ledger Commit' },
            { num: 7, label: '7. Post-Ledger Storage' },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor:
                      s.num === 7
                        ? 'rgba(16, 185, 129, 0.2)'
                        : s.num === 6
                        ? 'rgba(56, 189, 248, 0.2)'
                        : 'var(--bg-surface-highest)',
                    border: `1px solid ${
                      s.num === 7
                        ? 'var(--status-verified)'
                        : s.num === 6
                        ? 'var(--accent-cyan)'
                        : 'var(--border-interactive)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color:
                      s.num === 7
                        ? 'var(--status-verified)'
                        : s.num === 6
                        ? 'var(--accent-cyan)'
                        : 'var(--text-secondary)',
                  }}
                >
                  {s.num}
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color:
                      s.num === 7
                        ? 'var(--status-verified)'
                        : s.num === 6
                        ? 'var(--accent-cyan)'
                        : 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.label}
                </span>
              </div>
              {idx < 6 && (
                <div
                  style={{
                    width: 14,
                    height: 1,
                    backgroundColor: 'var(--border-structural)',
                    flexShrink: 0,
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="grid-3" style={{ gap: 16 }}>
          {/* Stage 1 */}
          <Card accent="cyan">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Badge variant="cyan">Stage 1</Badge>
              <DataTag type="STATIC" label="Pre-Issuance" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              1. Subject / Identity Verification
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Verify subject identity registration on Hyperledger Fabric ledger (<span className="font-mono">GET /api/v1/identities/:did/exists</span>).
              Validates that the citizen DID is active and authorized before any credential payload is processed.
            </p>
          </Card>

          {/* Stage 2 */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Badge variant="cyan">Stage 2</Badge>
              <DataTag type="STATIC" label="Schema" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              2. Schema Mapping
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Validate credential type and map attributes against canonical JSON schemas (<span className="font-mono">Academic</span>,{' '}
              <span className="font-mono">KYC</span>, <span className="font-mono">Employment</span>, or <span className="font-mono">GovernmentID</span>).
              Enforces strict type safety and schema conformity.
            </p>
          </Card>

          {/* Stage 3 */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Badge variant="cyan">Stage 3</Badge>
              <DataTag type="STATIC" label="Payload" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              3. Claims Preparation
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Populate subject attributes and canonicalize claim key-value pairs (lexicographical sorting, whitespace stripping).
              Ensures deterministic serialization for zero-ambiguity cryptographic hashing.
            </p>
          </Card>

          {/* Stage 4 */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Badge variant="suspended">Stage 4</Badge>
              <DataTag type="STATIC" label="In-Memory Only" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              4. Encryption Preparation
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Prepare AES-256-GCM symmetric ciphertext with a fresh 96-bit initialization vector (IV) locally in memory.
              <strong style={{ color: 'var(--status-suspended)' }}> Note:</strong> Ciphertext is held in memory and is <em>not</em> called or stored to off-chain storage at this stage.
            </p>
          </Card>

          {/* Stage 5 */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Badge variant="cyan">Stage 5</Badge>
              <DataTag type="DERIVED" label="Cryptographic" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              5. SHA-256 Commitment Generation
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Compute deterministic SHA-256 digest of canonical claims. This 32-byte hash forms the immutable
              cryptographic commitment binding the credential state without exposing raw PII on-chain.
            </p>
          </Card>

          {/* Stage 6 */}
          <Card accent="cyan">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Badge variant="cyan">Stage 6</Badge>
              <DataTag type="STATIC" label="On-Chain Commit" />
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              6. Ledger Submission / Commit
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Submit issuance transaction proposal to Fabric endorsing peers under 3-of-4 consortium policy.
              Raft ordering cluster batches and commits the block to <span className="font-mono">identity-channel</span> with finality.
            </p>
          </Card>

          {/* Stage 7 */}
          <Card accent="green" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant="verified">Stage 7 • Post-Ledger</Badge>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-verified)', letterSpacing: '0.04em' }}>
                  CRUCIAL SEQUENCE: POST-LEDGER COMMIT ONLY
                </span>
              </div>
              <DataTag type="STATIC" label="Off-Chain Storage" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              7. Post-Ledger Encrypted Off-Chain Storage
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <strong>Execution Constraint:</strong> Persist AES-256-GCM encrypted ciphertext to off-chain encrypted storage <em>strictly after</em> successful ledger commit.
              Storage indexes the record by credential ID and verifies against the on-chain SHA-256 commitment.
              Permanently deletes encrypted off-chain ciphertext upon authorized request, supporting erasure of directly identifying off-chain data.
            </p>
          </Card>
        </div>
      </section>

      {/* 5. INTERACTIVE EVALUATE LEDGER COMMITMENT TERMINAL */}
      <section>
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              Evaluate Ledger Commitment Terminal
            </h2>
            <DataTag type="LIVE" label="[A] Live Gateway Probe" />
            <DataTag type="SAMPLE" label="[D] Preset Demonstration State" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Test real-time identity status lookup against the Hyperledger Fabric{' '}
            <span className="font-mono">identity-channel</span> smart contract (<span className="font-mono">identity-registry v3.0</span>).
          </p>
        </div>

        <div className="grid-2">
          {/* Preset Selector */}
          <Card title="Query Configuration">
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Select Demonstration Preset:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Object.keys(presets) as (keyof typeof presets)[]).map((k) => {
                  const p = presets[k];
                  const active = selectedPreset === k;
                  return (
                    <div
                      key={k}
                      onClick={() => setSelectedPreset(k)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: active ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
                        border: `1px solid ${active ? 'var(--accent-cyan)' : 'var(--border-structural)'}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {p.label}
                        </div>
                        <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {p.did} • {p.msp}
                        </div>
                      </div>
                      <Badge variant="cyan">{p.status}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                variant="primary"
                loading={evaluating}
                icon={<Search size={14} />}
                onClick={handleEvaluate}
              >
                Evaluate Commitment
              </Button>
              <Button variant="secondary" onClick={() => onNavigate('verify')}>
                Full Verification Terminal
              </Button>
            </div>
          </Card>

          {/* Evaluation Result */}
          <Card title="Consensus Gateway Query Output" accent="cyan">
            {evalResult ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="pulse-dot pulse-dot-green" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-verified)' }}>
                      Endorsed by 3-of-4 Consortium Orgs
                    </span>
                  </div>
                  <DataTag type="SAMPLE" label="[D] Evaluated Receipt" />
                </div>

                <pre className="code-terminal" style={{ fontSize: 11 }}>
                  {JSON.stringify(evalResult, null, 2)}
                </pre>
              </div>
            ) : (
              <div
                style={{
                  height: 220,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  gap: 8,
                }}
              >
                <Terminal size={32} color="var(--border-interactive)" />
                <span>Click "Evaluate Commitment" to simulate a ledger status query.</span>
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* 6. CALL TO ACTION BANNER */}
      <section
        style={{
          padding: '36px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-interactive)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 16,
        }}
      >
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
          Ready to Deploy FabricID Across Your Consortium?
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 640 }}>
          Operate FabricID with cryptographic confidence across consortium trust anchors. Protect citizen privacy
          with robust cryptographic commitments and zero on-chain raw PII.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <Button variant="primary" icon={<Key size={15} />} onClick={() => onNavigate('auth')}>
            Enter Authentication Gateway
          </Button>
          <Button variant="outline" icon={<Server size={15} />} onClick={() => onNavigate('network')}>
            View Fabric Topology
          </Button>
        </div>
      </section>
    </div>
  );
};
