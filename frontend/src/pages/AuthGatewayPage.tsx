import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import { DEMO_PERSONAS, validateApiKeyWithBackend } from '../services/authService';
import { PersonaType } from '../types';
import { AppRoute } from '../App';
import {
  Key,
  CheckCircle,
  AlertTriangle,
  User,
  Building2,
  CheckCircle2,
  ShieldAlert,
  Fingerprint,
  Lock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const AuthGatewayPage: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({ onNavigate }) => {
  const { currentPersona, currentApiKey, switchPersona, setCustomApiKey } = useAuth();
  const [activeTab, setActiveTab] = useState<'citizen' | 'consortium' | 'verifier' | 'orderer'>('consortium');
  const [probeResult, setProbeResult] = useState<{ status: string; message: string; latency?: number } | null>(null);
  const [probing, setProbing] = useState<boolean>(false);

  // Custom user DID state for citizen tab
  const [citizenDid, setCitizenDid] = useState<string>('did:example:alice123');

  const handleTestProbe = async () => {
    setProbing(true);
    const res = await validateApiKeyWithBackend(currentApiKey);
    setProbing(false);
    setProbeResult({
      status: res.valid ? 'SUCCESS' : 'FAILURE',
      message: res.message,
      latency: res.latencyMs,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <PageHeader
        title="FabricID Role-Based Authentication Gateway"
        subtitle="Prototype Demonstration Authentication — Institutional Personas, Citizen Tokenized Access, and Role Delegations for FabricID"
        dataClassification="STATIC"
        dataTagLabel="[C] Demo Auth Architecture"
      />

      {/* Cryptographic Access Control Notice */}
      <Card accent="amber">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <ShieldAlert size={22} color="var(--status-suspended)" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Cryptographic Access Control Notice
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
              Consortium operators operate through pre-configured enterprise gateway credentials. Citizen
              access uses tokenized identity handles routed via the backend service proxy. Frontend authentication
              is strictly for prototype workflow demonstration; the <strong>backend API remains the authoritative
              security boundary</strong>.
            </p>
          </div>
        </div>
      </Card>

      {/* Execution Flow Architecture */}
      <Card title="Execution Flow &amp; Trust Boundary">
        <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          Topology Routing Diagram:
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            backgroundColor: 'var(--bg-surface-lowest)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-structural)',
            overflowX: 'auto',
            gap: 12,
          }}
        >
          <div style={{ textAlign: 'center', minWidth: 140 }}>
            <Badge variant="neutral">Client Layer</Badge>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
              Citizen / User
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              did:example:...
            </div>
          </div>

          <ArrowRight size={18} color="var(--border-interactive)" />

          <div style={{ textAlign: 'center', minWidth: 150 }}>
            <Badge variant="cyan">Session Auth</Badge>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
              Backend API Gateway
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Rate Limit / Auth / Zero-PII
            </div>
          </div>

          <ArrowRight size={18} color="var(--border-interactive)" />

          <div style={{ textAlign: 'center', minWidth: 150 }}>
            <Badge variant="verified">Mutual TLS</Badge>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
              Fabric Gateway Client
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              X.509 Institutional Credential
            </div>
          </div>

          <ArrowRight size={18} color="var(--border-interactive)" />

          <div style={{ textAlign: 'center', minWidth: 150 }}>
            <Badge variant="cyan">Consensus</Badge>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 6 }}>
              Hyperledger Fabric Peer
            </div>
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              identity-channel
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
          <strong>Critical Architecture Rule:</strong> Citizens are <em>not</em> Fabric MSP members.
          Application DIDs are handled by the backend service and do not authenticate directly to Hyperledger Fabric.
        </div>
      </Card>

      {/* Tabbed Domain Access Gateway */}
      <div>
        <div className="tab-bar" style={{ marginBottom: 16 }}>
          <button
            className={`tab-item ${activeTab === 'consortium' ? 'tab-item-active' : ''}`}
            onClick={() => setActiveTab('consortium')}
          >
            <Building2 size={16} />
            <span>1. Consortium Institutional Authority</span>
          </button>
          <button
            className={`tab-item ${activeTab === 'citizen' ? 'tab-item-active' : ''}`}
            onClick={() => setActiveTab('citizen')}
          >
            <User size={16} />
            <span>2. Application User (Citizen / Subject)</span>
          </button>
          <button
            className={`tab-item ${activeTab === 'verifier' ? 'tab-item-active' : ''}`}
            onClick={() => setActiveTab('verifier')}
          >
            <CheckCircle2 size={16} />
            <span>3. Public Verifier Mode</span>
          </button>
          <button
            className={`tab-item ${activeTab === 'orderer' ? 'tab-item-active' : ''}`}
            onClick={() => setActiveTab('orderer')}
          >
            <Lock size={16} />
            <span>4. Raft Orderer Administration</span>
          </button>
        </div>

        {/* TAB 1: CONSORTIUM INSTITUTIONAL AUTHORITY */}
        {activeTab === 'consortium' && (
          <div className="grid-2">
            <Card title="Select Institutional Anchor Authority">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
                Select an institutional anchor to load its prototype demonstration credential and configure the
                active gateway session:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['GOV', 'UNI', 'BANK', 'EMP'] as PersonaType[]).map((key) => {
                  const persona = DEMO_PERSONAS[key];
                  const isSelected = currentPersona.id === key;

                  return (
                    <div
                      key={key}
                      onClick={() => {
                        switchPersona(key);
                        setProbeResult(null);
                      }}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isSelected ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
                        border: `1px solid ${isSelected ? 'var(--accent-cyan)' : 'var(--border-structural)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {persona.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {persona.mspId} • {persona.roleTitle} • Port 7051/8051/9051/10051
                        </div>
                      </div>
                      <Badge variant={persona.badgeColor}>Demo Key</Badge>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 20 }}>
                <Button variant="primary" icon={<ArrowRight size={14} />} onClick={() => onNavigate('portal')}>
                  Initiate Consortium Gateway Session
                </Button>
              </div>
            </Card>

            {/* Institutional Credentials Inspection */}
            <div>
              <Card title="Active Demonstration Credential" accent="cyan">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Selected Anchor:</span>
                  <Badge variant={currentPersona.badgeColor}>{currentPersona.mspId}</Badge>
                </div>

                <div className="form-group">
                  <label className="form-label">Demonstration API Key (Bearer Token):</label>
                  <input
                    type="password"
                    className="form-input font-mono"
                    value={currentApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    placeholder="demo-api-key..."
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                    [Prototype / Demonstration Credential] — Configured via .env.local (ignored by git).
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <Button
                    variant="primary"
                    loading={probing}
                    icon={<Key size={14} />}
                    onClick={handleTestProbe}
                  >
                    Validate Key with Safe Backend Probe
                  </Button>
                </div>

                {probeResult && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor:
                        probeResult.status === 'SUCCESS' ? 'var(--status-verified-container)' : 'var(--status-revoked-container)',
                      border: `1px solid ${probeResult.status === 'SUCCESS' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
                      {probeResult.status === 'SUCCESS' ? (
                        <CheckCircle size={15} color="var(--status-verified)" />
                      ) : (
                        <AlertTriangle size={15} color="var(--status-revoked)" />
                      )}
                      <span>Backend Auth Probe: {probeResult.status}</span>
                      {probeResult.latency !== undefined && (
                        <span className="font-mono">({probeResult.latency}ms)</span>
                      )}
                      <DataTag type="LIVE" label="[A] GET /api/v1/identities/:did/exists" />
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                      {probeResult.message}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: CITIZEN ACCESS */}
        {activeTab === 'citizen' && (
          <div className="grid-2">
            <Card title="Application User Access">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Citizens interact with FabricID using self-sovereign application credentials. Application DIDs
                are handled by the backend service and do not possess Fabric MSP credentials.
              </p>

              <div className="form-group">
                <label className="form-label">Subject Decentralized Identifier (DID):</label>
                <input
                  type="text"
                  className="form-input font-mono"
                  value={citizenDid}
                  onChange={(e) => setCitizenDid(e.target.value)}
                  placeholder="did:example:..."
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                  Supported format: <span className="font-mono">did:example:[identifier]</span> (W3C DID Core 1.0 Compliant).
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <Button
                  variant="primary"
                  icon={<User size={14} />}
                  onClick={() => {
                    switchPersona('CITIZEN');
                    onNavigate('wallet');
                  }}
                >
                  Sign In to Citizen Wallet Session
                </Button>
                <Button variant="secondary" onClick={() => onNavigate('wallet')}>
                  Inspect Citizen Wallet
                </Button>
              </div>
            </Card>

            <Card title="Biometrics &amp; Future Passkey Roadmap" accent="cyan">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <Fingerprint size={24} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    WebAuthn / Passkey Biometrics
                  </div>
                  <Badge variant="suspended" style={{ marginTop: 4 }}>
                    [Future Enhancement — Planned v2.0]
                  </Badge>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                    Hardware-bound FIDO2 credential anchoring on roadmap. Direct cryptographic hardware signatures
                    will allow citizens to authorize selective disclosure without transmitting master credentials.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* TAB 3: PUBLIC VERIFIER MODE */}
        {activeTab === 'verifier' && (
          <Card title="Public Verifier Portal Mode" accent="green">
            <div style={{ maxWidth: 700 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Relying parties and external verifiers validate identity credentials against on-chain SHA-256
                commitments without gaining access to private subject attributes or custodial MSP certificates.
              </p>

              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--bg-surface-lowest)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-structural)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                <div>
                  <strong>Allowed Operations:</strong> Read Credential Status, Evaluate Cryptographic Commitment
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>Access Policy:</strong> Zero PII Transmission (SHA-256 Hashes Only)
                </div>
              </div>

              <Button
                variant="primary"
                icon={<ExternalLink size={14} />}
                onClick={() => {
                  switchPersona('VERIFIER');
                  onNavigate('verify');
                }}
              >
                Open Verification Terminal Pipeline
              </Button>
            </div>
          </Card>
        )}

        {/* TAB 4: ORDERER ADMINISTRATION */}
        {activeTab === 'orderer' && (
          <Card title="Consortium Orderer Administrator Notice" accent="amber">
            <div style={{ maxWidth: 700 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
                Consensus on <span className="font-mono">identity-channel</span> is maintained by a 3-node
                Crash Fault Tolerant (CFT) Raft cluster. Ordering nodes batch endorsed transaction proposals into
                blocks with deterministic sequence finality without forks.
              </p>

              <div
                style={{
                  padding: 14,
                  backgroundColor: 'var(--bg-surface-lowest)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-structural)',
                  fontSize: 12,
                  marginBottom: 20,
                }}
              >
                <div>
                  <strong>Orderer Nodes:</strong> orderer1.gov (7050), orderer2.university (8050), orderer3.bank (9050)
                </div>
                <div style={{ marginTop: 4 }}>
                  <strong>Consensus Model:</strong> Raft CFT (Crash Fault Tolerant, Single-Partition Tolerance)
                </div>
                <div style={{ marginTop: 4, color: 'var(--status-suspended)' }}>
                  <strong>Note:</strong> EmployerMSP is strictly an endorsing peer organization and is NOT an orderer consenter.
                </div>
              </div>

              <Button variant="secondary" icon={<ExternalLink size={14} />} onClick={() => onNavigate('network')}>
                Inspect Network Topology Explorer
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
