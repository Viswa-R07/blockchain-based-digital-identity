/*
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { AppRoute } from '../App';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Server,
  Network,
  Cpu,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface SecurityCenterPageProps {
  onNavigate: (route: AppRoute) => void;
}

interface ControlItem {
  id: string;
  name: string;
  scope: string;
  category: 'Access Control' | 'Cryptography' | 'Data Protection' | 'Network Security';
  description: string;
  status: 'VERIFIED_M9' | 'PROTOTYPE_CONTROL';
  verificationDetails: string;
}

const IMPLEMENTED_CONTROLS: ControlItem[] = [
  {
    id: 'SEC-ROUTE-04',
    name: 'Issuer DID Institutional Binding',
    scope: 'Express API Middleware & Controllers',
    category: 'Access Control',
    description: 'Enforces strict cryptographic binding between the caller MSP identity and authorized issuer DIDs.',
    status: 'VERIFIED_M9',
    verificationDetails: 'All cross-organizational issuance attempts rejected with HTTP 403 before Fabric Gateway invocation.',
  },
  {
    id: 'SEC-CRYPTO-01',
    name: 'Timing-Safe API Key Comparison',
    scope: 'Authentication Middleware',
    category: 'Cryptography',
    description: 'Uses crypto.timingSafeEqual to prevent side-channel timing attacks against credential validation.',
    status: 'VERIFIED_M9',
    verificationDetails: 'Constant-time comparison digest evaluated on all incoming X-API-Key headers.',
  },
  {
    id: 'SEC-API-02',
    name: 'Zero Raw PII Gatekeeper',
    scope: 'Request Validation Layer',
    category: 'Data Protection',
    description: 'Pre-gateway inspection ensuring zero plaintext personal identifiable information enters Fabric ledger.',
    status: 'VERIFIED_M9',
    verificationDetails: 'Rejects request bodies containing plaintext civil or sensitive identity attributes with HTTP 400.',
  },
  {
    id: 'SEC-CRYPTO-02',
    name: 'AES-256-GCM Off-Chain Vault',
    scope: 'Encrypted File Storage',
    category: 'Cryptography',
    description: 'Authenticated symmetric encryption with 256-bit keys and deterministic SHA-256 commitment binding.',
    status: 'VERIFIED_M9',
    verificationDetails: 'Vault ciphertext verified against on-chain SHA-256 digest before decryption.',
  },
  {
    id: 'SEC-CRYPTO-03',
    name: 'Cryptographic Nonces & AAD Binding',
    scope: 'Storage Controller',
    category: 'Cryptography',
    description: 'Fresh 12-byte CSPRNG IV per write, 16-byte authentication tag, and Additional Authenticated Data binding.',
    status: 'VERIFIED_M9',
    verificationDetails: 'AAD format: aad:v{version}:{credentialId}:{credentialCommitment}. Prevents ciphertext transposition.',
  },
  {
    id: 'SEC-API-01',
    name: 'Tiered In-Memory Rate Limiting',
    scope: 'Express Gateway',
    category: 'Network Security',
    description: 'Protects backend endpoints with sliding-window rate limiters (sensitive mutations vs read queries).',
    status: 'VERIFIED_M9',
    verificationDetails: 'Sensitive: 20 req/min limit (HTTP 429 after 20 reqs). General: 100 req/min limit.',
  },
  {
    id: 'SEC-NET-01',
    name: 'Server-Side TLS CA Validation',
    scope: 'Fabric Gateway Client',
    category: 'Network Security',
    description: 'Validates peer and orderer TLS x509 certificates against organization CA root certificates.',
    status: 'VERIFIED_M9',
    verificationDetails: 'gRPC SSL credentials initialized with institutional ca.crt trust stores across 8 peers.',
  },
  {
    id: 'SEC-LEDGER-01',
    name: 'Chaincode ABAC Enforcement',
    scope: 'Smart Contract (Node/TS)',
    category: 'Access Control',
    description: 'Chaincode checks caller MSP ID and client identity attributes before executing state mutations.',
    status: 'VERIFIED_M9',
    verificationDetails: 'Unauthorized organization attempts to update or revoke foreign credentials fail at endorsement.',
  },
];

const PERMUTATION_TEST_RESULTS = [
  { org: 'GovMSP', callerRole: 'GOV_ADMIN', targetDid: 'did:example:gov:authority', expected: '201 Created', result: 'PASSED', latency: '1065ms' },
  { org: 'GovMSP', callerRole: 'GOV_ADMIN', targetDid: 'did:example:university:registrar', expected: '403 Forbidden', result: 'PASSED (Blocked pre-gateway)', latency: '3ms' },
  { org: 'UniversityMSP', callerRole: 'UNI_REGISTRAR', targetDid: 'did:example:university:registrar', expected: '201 Created', result: 'PASSED', latency: '1078ms' },
  { org: 'UniversityMSP', callerRole: 'UNI_REGISTRAR', targetDid: 'did:example:gov:authority', expected: '403 Forbidden', result: 'PASSED (Blocked pre-gateway)', latency: '2ms' },
  { org: 'BankMSP', callerRole: 'BANK_COMPLIANCE', targetDid: 'did:example:bank:compliance', expected: '201 Created', result: 'PASSED', latency: '1082ms' },
  { org: 'BankMSP', callerRole: 'BANK_COMPLIANCE', targetDid: 'did:example:employer:hr', expected: '403 Forbidden', result: 'PASSED (Blocked pre-gateway)', latency: '3ms' },
  { org: 'EmployerMSP', callerRole: 'EMP_HR', targetDid: 'did:example:employer:hr', expected: '201 Created', result: 'PASSED', latency: '1076ms' },
  { org: 'EmployerMSP', callerRole: 'EMP_HR', targetDid: 'did:example:bank:compliance', expected: '403 Forbidden', result: 'PASSED (Blocked pre-gateway)', latency: '2ms' },
];

const RESIDUAL_RISKS = [
  {
    title: 'Static Prototype API Keys',
    severity: 'MEDIUM',
    category: 'Authentication',
    description:
      'Current deployment utilizes fixed environment-configured API keys for demonstration and test workflows. Production requires automated OAuth2/OIDC token exchange with mTLS.',
    mitigation: 'Timing-safe evaluation is enforced; rotation requires server restart.',
  },
  {
    title: 'Shared Environment Master Key',
    severity: 'MEDIUM',
    category: 'Key Management',
    description:
      'Off-chain AES-256-GCM storage utilizes an environment-provided master key (STORAGE_MASTER_KEY). A production enterprise deployment requires envelope encryption backed by an external HSM/KMS.',
    mitigation: 'Key ID versioning is embedded in AAD; keys are never transmitted over network or exposed to client.',
  },
  {
    title: 'Development Docker Socket',
    severity: 'LOW',
    category: 'Host Security',
    description:
      'The local development environment uses Docker Desktop with local socket access. Standard for local testbeds, but isolated container runtimes are required for enterprise production.',
    mitigation: 'Development residual risk only; non-elevated user execution within WSL2 boundary.',
  },
  {
    title: 'Transport mTLS Not Claimed',
    severity: 'LOW',
    category: 'Network Protocol',
    description:
      'Server-side TLS CA validation is implemented for gRPC connections to peers. Full bidirectional mutual TLS (mTLS) with client certificate verification at the reverse proxy is a future hardening target.',
    mitigation: 'gRPC TLS credentials enforce server identity and encrypted transport.',
  },
  {
    title: 'Private Data Collections (PDC) Architecture',
    severity: 'INFORMATIONAL',
    category: 'Privacy Boundary',
    description:
      'PDC architecture is documented conceptually in system design specifications. Private data collections are NOT currently implemented on-chain; privacy is provided by off-chain encrypted vaults.',
    mitigation: 'Ledger contains only SHA-256 commitment digests, zero plaintext PII.',
  },
  {
    title: 'Raft CFT Consensus Scope',
    severity: 'INFORMATIONAL',
    category: 'Consensus Boundary',
    description:
      'The 3-orderer Fabric consensus cluster utilizes the Raft protocol. Raft provides Crash Fault Tolerance (CFT) for up to 1 failed node, but does NOT provide Byzantine Fault Tolerance (BFT).',
    mitigation: 'Crash resilience verified across orderer1.gov, orderer2.university, and orderer3.bank.',
  },
];

const FUTURE_RESEARCH_ITEMS = [
  {
    name: 'Bidirectional Mutual TLS (mTLS)',
    timeline: 'Production Hardening',
    description: 'Hardware token / X.509 client certificate authentication terminated at an enterprise reverse proxy layer.',
  },
  {
    name: 'Hardware Security Module (HSM / PKCS#11)',
    timeline: 'Enterprise Infrastructure',
    description: 'Off-chain encryption root keys protected within FIPS 140-2 Level 3 tamper-resistant cryptographic hardware.',
  },
  {
    name: 'FIDO2 / WebAuthn Passkeys',
    timeline: 'Citizen Experience',
    description: 'Biometric cryptographic key authorization for citizen identity holders without static passwords.',
  },
  {
    name: 'Zero-Knowledge Proofs (ZKP)',
    timeline: 'Academic / Research Roadmap',
    description: 'Cryptographic selective disclosure protocols allowing predicate proofs (e.g. Age >= 21) without revealing underlying claims.',
  },
  {
    name: 'Fabric Private Data Collections (PDCs)',
    timeline: 'Protocol Expansion',
    description: 'Transient peer-to-peer distribution of sensitive claims with bilateral hashing on-channel.',
  },
];

export const SecurityCenterPage: React.FC<SecurityCenterPageProps> = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const filteredControls = IMPLEMENTED_CONTROLS.filter((c) =>
    selectedCategory === 'ALL' ? true : c.category === selectedCategory
  );

  return (
    <div>
      <PageHeader
        title="Consortium Security Center & Posture Audit"
        subtitle="M9 Cryptographic Controls, Org-DID Binding Verification, and Risk Boundary Matrix"
        dataClassification="STATIC"
        dataTagLabel="[C] Empirical M9 Security Audit Data"
      />

      {/* ── Key Metrics Overview ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card accent="green">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>M9 Security Controls</span>
            <ShieldCheck size={16} color="var(--status-verified)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            8 / 8 Verified
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-verified)', marginTop: 4 }}>
            100% Audit Coverage Passed
          </div>
        </Card>

        <Card accent="cyan">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Org-DID Permutations</span>
            <Lock size={16} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            8 / 8 Passed
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 4 }}>
            SEC-ROUTE-04 Remediated
          </div>
        </Card>

        <Card accent="cyan">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>On-Chain Plaintext PII</span>
            <Shield size={16} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            0 Bytes
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 4 }}>
            Zero Raw PII Gatekeeper Active
          </div>
        </Card>

        <Card accent="amber">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Consensus Architecture</span>
            <Server size={16} color="var(--status-warning)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            Raft CFT
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-warning)', marginTop: 4 }}>
            3 Consenter Nodes (Not BFT)
          </div>
        </Card>
      </div>

      {/* ── Section 1: Implemented & Tested Security Controls (M9) ── */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              1. Implemented & Tested Security Controls (M9 Baseline)
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Cryptographic, routing, and access control mitigations evaluated against formal security test suite.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['ALL', 'Access Control', 'Cryptography', 'Data Protection', 'Network Security'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-structural)',
                  backgroundColor: selectedCategory === cat ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
                  color: selectedCategory === cat ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: selectedCategory === cat ? 600 : 400,
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {filteredControls.map((c) => (
            <div
              key={c.id}
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-lowest)',
                border: '1px solid var(--border-structural)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <code style={{ fontSize: 12, color: 'var(--accent-cyan)', fontWeight: 700 }}>{c.id}</code>
                  <Badge variant="verified">{c.status}</Badge>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Scope: {c.scope}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                  {c.description}
                </p>
              </div>
              <div style={{ borderTop: '1px solid var(--border-structural)', paddingTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--status-verified)' }}>Verification:</strong> {c.verificationDetails}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Section 2: Org-to-DID Binding Permutation Test Results ── */}
      <Card accent="cyan" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              2. SEC-ROUTE-04 Permutation Test Suite (8/8 Passed)
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Verification that institutional callers cannot submit issuance transactions with another organization's issuer DID.
            </div>
          </div>
          <DataTag type="STATIC" label="[C] M9 Empirical Test Matrix" />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-structural)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 10px' }}>Caller Org</th>
                <th style={{ padding: '8px 10px' }}>Role</th>
                <th style={{ padding: '8px 10px' }}>Submitted Issuer DID</th>
                <th style={{ padding: '8px 10px' }}>Expected Response</th>
                <th style={{ padding: '8px 10px' }}>Gateway Latency</th>
                <th style={{ padding: '8px 10px' }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {PERMUTATION_TEST_RESULTS.map((p, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-structural)' }}>
                  <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--accent-cyan)' }}>
                    {p.org}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{p.callerRole}</td>
                  <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>
                    {p.targetDid}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <Badge variant={p.expected.includes('201') ? 'verified' : 'revoked'}>{p.expected}</Badge>
                  </td>
                  <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                    {p.latency}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <Badge variant="verified">✓ {p.result}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Section 3: Residual Risks & Operational Boundaries ── */}
      <Card accent="amber" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              3. Known Residual Risks & Operational Boundaries
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Documented development assumptions, prototype artifacts, and explicit security boundaries.
            </div>
          </div>
          <DataTag type="STATIC" label="[C] Security Disclosures" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {RESIDUAL_RISKS.map((r, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-lowest)',
                border: '1px solid var(--border-structural)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</span>
                <Badge variant={r.severity === 'MEDIUM' ? 'suspended' : 'neutral'}>
                  {r.severity}
                </Badge>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 8 }}>
                {r.description}
              </p>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-structural)', paddingTop: 6 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Mitigation / Scope:</strong> {r.mitigation}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Section 4: Future / Research Hardening ── */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              4. Future / Research Hardening Roadmap
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Advanced cryptographic targets explicitly separated from current operational capabilities.
            </div>
          </div>
          <DataTag type="STATIC" label="[C] Future Research Only" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {FUTURE_RESEARCH_ITEMS.map((item, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-surface-lowest)',
                border: '1px solid var(--border-structural)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                <Badge variant="neutral">{item.timeline}</Badge>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
