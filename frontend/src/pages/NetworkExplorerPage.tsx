import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { AppRoute } from '../App';
import { useNetwork } from '../context/NetworkContext';
import {
  Network,
  Server,
  Layers,
  Cpu,
  Filter,
  Eye,
  CheckCircle2,
  Shield,
  Activity,
  ArrowRight,
  Database,
} from 'lucide-react';

interface BlockRow {
  height: number;
  txId: string;
  submittingOrg: string;
  chaincode: string;
  timestamp: string;
  status: string;
}

export const NetworkExplorerPage: React.FC<{ onNavigate: (route: AppRoute) => void }> = ({ onNavigate }) => {
  const { isConnected, latencyMs, lastChecked } = useNetwork();
  const [filterOrg, setFilterOrg] = useState<string>('ALL');
  const [selectedBlock, setSelectedBlock] = useState<BlockRow | null>(null);

  // Verified Static Consortium Peer Roster
  const organizations = [
    {
      name: 'Government Identity Authority',
      mspId: 'GovMSP',
      peers: [
        { id: 'peer0.gov', name: 'peer0.gov.identity.example.com', port: 7051, role: 'Anchor / Endorser' },
        { id: 'peer1.gov', name: 'peer1.gov.identity.example.com', port: 7052, role: 'Endorser' },
      ],
      couchInstances: ['couchdb0.gov', 'couchdb1.gov'],
      tls: 'TLS 1.3 Server-Validated',
      badgeColor: 'cyan' as const,
    },
    {
      name: 'Higher Education Consortium',
      mspId: 'UniversityMSP',
      peers: [
        { id: 'peer0.uni', name: 'peer0.university.example.com', port: 8051, role: 'Anchor / Endorser' },
        { id: 'peer1.uni', name: 'peer1.university.example.com', port: 8052, role: 'Endorser' },
      ],
      couchInstances: ['couchdb0.uni', 'couchdb1.uni'],
      tls: 'TLS 1.3 Server-Validated',
      badgeColor: 'verified' as const,
    },
    {
      name: 'Banking & Financial Consortium',
      mspId: 'BankMSP',
      peers: [
        { id: 'peer0.bank', name: 'peer0.bank.example.com', port: 9051, role: 'Anchor / Endorser' },
        { id: 'peer1.bank', name: 'peer1.bank.example.com', port: 9052, role: 'Endorser' },
      ],
      couchInstances: ['couchdb0.bank', 'couchdb1.bank'],
      tls: 'TLS 1.3 Server-Validated',
      badgeColor: 'suspended' as const,
    },
    {
      name: 'Enterprise Employer Trust',
      mspId: 'EmployerMSP',
      peers: [
        { id: 'peer0.emp', name: 'peer0.employer.example.com', port: 10051, role: 'Anchor / Endorser' },
        { id: 'peer1.emp', name: 'peer1.employer.example.com', port: 10052, role: 'Endorser' },
      ],
      couchInstances: ['couchdb0.emp', 'couchdb1.emp'],
      tls: 'TLS 1.3 Server-Validated',
      badgeColor: 'neutral' as const,
    },
  ];

  // Verified Static Raft Orderers
  const orderers = [
    { id: 'orderer1.gov', name: 'orderer1.gov.identity.example.com', port: 7050, msp: 'GovMSP', role: 'Leader / Consenter' },
    { id: 'orderer2.uni', name: 'orderer2.university.example.com', port: 8050, msp: 'UniversityMSP', role: 'Follower / Consenter' },
    { id: 'orderer3.bank', name: 'orderer3.bank.example.com', port: 9050, msp: 'BankMSP', role: 'Follower / Consenter' },
  ];

  // Sample Block Records (Explicitly Labeled: [Sample / Placeholder Data])
  const sampleBlocks: BlockRow[] = [
    {
      height: 613,
      txId: 'tx_9f14b8a2c00e1672ab819201f928',
      submittingOrg: 'UniversityMSP',
      chaincode: 'identity-registry v3.0',
      timestamp: '2026-09-14 11:28:46 UTC',
      status: 'TxValidationCode_VALID (0)',
    },
    {
      height: 612,
      txId: 'tx_8e02d7c1b11f9281ba708102e817',
      submittingOrg: 'BankMSP',
      chaincode: 'identity-registry v3.0',
      timestamp: '2026-09-14 11:26:10 UTC',
      status: 'TxValidationCode_VALID (0)',
    },
    {
      height: 611,
      txId: 'tx_7d91c6b0a00e8170aa6f7091d706',
      submittingOrg: 'EmployerMSP',
      chaincode: 'identity-registry v3.0',
      timestamp: '2026-09-14 11:24:18 UTC',
      status: 'TxValidationCode_VALID (0)',
    },
    {
      height: 610,
      txId: 'tx_6c80b5a9999d706f995e6980c695',
      submittingOrg: 'GovMSP',
      chaincode: 'identity-registry v3.0',
      timestamp: '2026-09-14 11:21:55 UTC',
      status: 'TxValidationCode_VALID (0)',
    },
    {
      height: 609,
      txId: 'tx_5b79a498888c695e884d5879b584',
      submittingOrg: 'GovMSP',
      chaincode: 'identity-registry v3.0',
      timestamp: '2026-09-14 11:19:40 UTC',
      status: 'TxValidationCode_VALID (0)',
    },
  ];

  const filteredBlocks =
    filterOrg === 'ALL'
      ? sampleBlocks
      : sampleBlocks.filter((b) => b.submittingOrg === filterOrg);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <PageHeader
        title="FabricID Hyperledger Fabric Network Explorer"
        subtitle="Consortium Topology, Channel Configuration, Peer Endorsement Grid, and Raft CFT Consensus"
        dataClassification="STATIC"
        dataTagLabel="[C] Static Network Architecture"
      />

      {/* Top Architecture Summary Cards */}
      <div className="grid-4">
        <Card accent="cyan">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Channel Architecture</span>
            <DataTag type="STATIC" label="[C]" />
          </div>
          <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
            identity-channel
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 4 }}>
            4 MSPs • 8 Peers • 8 CouchDB
          </div>
        </Card>

        <Card accent="green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Active Chaincode</span>
            <DataTag type="STATIC" label="[C]" />
          </div>
          <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
            identity-registry v3.0
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-verified)', marginTop: 4 }}>
            Sequence: 3 • Policy: MAJORITY
          </div>
        </Card>

        <Card accent="amber">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Consensus Cluster</span>
            <DataTag type="STATIC" label="[C]" />
          </div>
          <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
            3 Raft Orderers (CFT)
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-suspended)', marginTop: 4 }}>
            Quorum: 3/3 Active Consenters
          </div>
        </Card>

        <Card accent="cyan">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live Gateway Probe</span>
            <DataTag type="LIVE" label="[A]" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8 }}>
            {isConnected ? 'Online' : 'Probing...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 4 }}>
            Latency: {latencyMs}ms • {lastChecked}
          </div>
        </Card>
      </div>

      {/* Consortium Peer Endorsement Grid */}
      <section>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Consortium Endorsement Grid (8 Peers across 4 Organizations)
            </h2>
            <DataTag type="STATIC" label="[C] Static Network Architecture" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Endorsement policy requires signatures from a <span className="font-mono">MAJORITY</span> (3 of 4
            organizations) before a transaction envelope can be committed to ledger blocks.
          </p>
        </div>

        <div className="grid-2">
          {organizations.map((org) => (
            <Card key={org.mspId} accent={org.badgeColor === 'cyan' ? 'cyan' : org.badgeColor === 'verified' ? 'green' : 'amber'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{org.name}</h3>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>
                    MSP ID: {org.mspId}
                  </span>
                </div>
                <Badge variant={org.badgeColor}>{org.tls}</Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                {org.peers.map((peer) => (
                  <div
                    key={peer.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-surface-lowest)',
                      border: '1px solid var(--border-structural)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: 12,
                    }}
                  >
                    <div>
                      <span className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {peer.name}
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Role: {peer.role}</div>
                    </div>
                    <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                      Port {peer.port}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Raft Consensus Ordering Service */}
      <section>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Raft Consensus &amp; Ordering Service Architecture
            </h2>
            <DataTag type="STATIC" label="[C] CFT Consensus Topology" />
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Raft provides <strong>Crash Fault Tolerance (CFT)</strong> with single partition tolerance and leader-based
            log replication. It guarantees deterministic ordering and finality without forks or state reorganization.
            <em>EmployerMSP is strictly an endorsing peer organization and does NOT participate as an orderer consenter.</em>
          </p>
        </div>

        <div className="grid-3">
          {orderers.map((ord) => (
            <Card key={ord.id} accent="amber">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {ord.id}
                </span>
                <Badge variant="suspended">Raft CFT</Badge>
              </div>
              <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {ord.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                Affiliation: <span className="font-mono">{ord.msp}</span> • Port {ord.port}
              </div>
              <div style={{ fontSize: 11, color: 'var(--status-suspended)', marginTop: 4 }}>
                Role: {ord.role}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Sample Block Explorer Feed */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                Consortium Block &amp; Transaction Explorer
              </h2>
              <DataTag type="SAMPLE" label="[D] Sample / Placeholder Data" />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Deterministic block progression on channel <span className="font-mono">identity-channel</span>.
              (Live block streaming API is not part of backend scope; records labeled as sample demonstration data).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              className="form-select"
              style={{ width: 170, fontSize: 12, padding: '5px 10px' }}
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
            >
              <option value="ALL">All Organizations</option>
              <option value="GovMSP">GovMSP</option>
              <option value="UniversityMSP">UniversityMSP</option>
              <option value="BankMSP">BankMSP</option>
              <option value="EmployerMSP">EmployerMSP</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Block Height</th>
                <th>Transaction ID</th>
                <th>Submitting Org</th>
                <th>Chaincode Target</th>
                <th>Timestamp (UTC)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBlocks.map((b) => (
                <tr key={b.height}>
                  <td className="font-mono" style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    Block #{b.height}
                  </td>
                  <td className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {b.txId}
                  </td>
                  <td>
                    <Badge variant="neutral">{b.submittingOrg}</Badge>
                  </td>
                  <td className="font-mono" style={{ fontSize: 12 }}>
                    {b.chaincode}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.timestamp}</td>
                  <td>
                    <Badge variant="verified">VALID (0)</Badge>
                  </td>
                  <td>
                    <Button variant="outline" size="sm" icon={<Eye size={12} />} onClick={() => setSelectedBlock(b)}>
                      Inspect
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Block Details Inspection Modal */}
      {selectedBlock && (
        <Modal
          isOpen={Boolean(selectedBlock)}
          onClose={() => setSelectedBlock(null)}
          title={`Block #${selectedBlock.height} Details [Sample Data]`}
          maxWidth={640}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Channel: identity-channel</span>
              <DataTag type="SAMPLE" label="[D] Sample Block" />
            </div>

            <pre className="code-terminal" style={{ fontSize: 11 }}>
              {JSON.stringify(
                {
                  channelId: 'identity-channel',
                  blockNumber: selectedBlock.height,
                  transactionId: selectedBlock.txId,
                  validationCode: 'TxValidationCode_VALID (0)',
                  creatorMSP: selectedBlock.submittingOrg,
                  targetChaincode: selectedBlock.chaincode,
                  endorsementQuorum: '3-of-4 MSP Endorsements Verified',
                  timestamp: selectedBlock.timestamp,
                  orderingNode: 'orderer1.gov.identity.example.com:7050',
                },
                null,
                2
              )}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Button variant="secondary" onClick={() => setSelectedBlock(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
