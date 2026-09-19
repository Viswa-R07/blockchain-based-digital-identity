/*
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/common/Card';
import { DataTag } from '../components/common/DataTag';
import { Badge } from '../components/common/Badge';
import { AppRoute } from '../App';
import {
  Zap,
  Clock,
  Layers,
  Activity,
  Server,
  Database,
  ShieldAlert,
  BarChart3,
  TrendingUp,
  Cpu,
  CheckCircle2,
} from 'lucide-react';

interface AnalyticsPageProps {
  onNavigate: (route: AppRoute) => void;
}

// ── M10 Benchmark Dataset Constants ──────────────────────────────────────────

const READ_BENCHMARKS = [
  { operation: 'IdentityExists', meanMs: 8.55, note: 'Warm-up excluded mean: 7.91 ms' },
  { operation: 'ReadIdentity', meanMs: 7.77, note: 'Authoritative DID record query' },
  { operation: 'CredentialExists', meanMs: 7.47, note: 'Key existence lookup' },
  { operation: 'ReadCredential', meanMs: 7.59, note: 'Ledger credential commitment read' },
  { operation: 'VerifyCredential', meanMs: 7.86, note: 'Commitment & temporal status check' },
  { operation: 'GetStatusHistory', meanMs: 7.93, note: 'CouchDB state index history' },
];

const WRITE_BENCHMARKS = [
  { operation: 'RegisterIdentity', e2eMs: 1067.62, gatewayMs: 1065.00, appMs: 2.62 },
  { operation: 'Academic Degree', e2eMs: 1078.24, gatewayMs: 1075.80, appMs: 2.44 },
  { operation: 'KYC Credential', e2eMs: 1082.21, gatewayMs: 1079.40, appMs: 2.81 },
  { operation: 'Employment Credential', e2eMs: 1076.80, gatewayMs: 1073.75, appMs: 3.05 },
  { operation: 'Government ID', e2eMs: 1065.05, gatewayMs: 1062.10, appMs: 2.95 },
  { operation: 'Suspend Credential', e2eMs: 1065.13, gatewayMs: 1061.65, appMs: 3.48 },
  { operation: 'Reinstate Credential', e2eMs: 1061.93, gatewayMs: 1059.00, appMs: 2.93 },
  { operation: 'Revoke Credential', e2eMs: 1062.20, gatewayMs: 1059.25, appMs: 2.95 },
];

const CONCURRENCY_DATA = [
  { concurrency: 'C1', success: '50/50', meanMs: 7.72, p95Ms: 10.65, tps: 129.22, note: 'Baseline concurrency' },
  { concurrency: 'C5', success: '50/50', meanMs: 18.59, p95Ms: 22.40, tps: 260.75, note: 'Optimal read saturation' },
  { concurrency: 'C10', success: '50/50', meanMs: 37.75, p95Ms: 44.10, tps: 251.43, note: 'Stable gateway queue' },
  { concurrency: 'C25', success: '50/50', meanMs: 118.66, p95Ms: 142.30, tps: 204.89, note: 'Queue buffering' },
  { concurrency: 'C50', success: '50/50', meanMs: 1205.78, p95Ms: 2525.53, tps: 19.79, note: 'Observed anomaly (reported neutrally)' },
  { concurrency: 'C100', success: '50/50', meanMs: 293.18, p95Ms: 298.70, tps: 327.59, note: 'Peak pipeline throughput' },
];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = () => {
  const [activeTab, setActiveTab] = useState<'latency' | 'concurrency' | 'resources'>('latency');

  return (
    <div>
      <PageHeader
        title="Performance Analytics & Empirical Benchmarks"
        subtitle="Empirical Evaluation of Hyperledger Fabric v2.5.16 & Express Gateway Latencies"
        dataClassification="STATIC"
        dataTagLabel="[C] Empirical M10 Benchmark Data"
      />

      {/* ── Key Performance Metrics Overview ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card accent="cyan">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Read / Evaluate Latency</span>
            <Zap size={15} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            7.86 ms
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 4 }}>
            Mean CouchDB Evaluation
          </div>
        </Card>

        <Card accent="green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Write / Commit Latency</span>
            <Clock size={15} color="var(--status-verified)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            1,071 ms
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-verified)', marginTop: 4 }}>
            3-of-4 Endorsement + Raft Consensus
          </div>
        </Card>

        <Card accent="cyan">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Peak Concurrency TPS</span>
            <TrendingUp size={15} color="var(--accent-cyan)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            327.59
          </div>
          <div style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 4 }}>
            Transactions Per Second (C100)
          </div>
        </Card>

        <Card accent="green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ledger Reconciliation</span>
            <CheckCircle2 size={15} color="var(--status-verified)" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            200 / 200
          </div>
          <div style={{ fontSize: 11, color: 'var(--status-verified)', marginTop: 4 }}>
            1.00 Tx/Block (Blocks 413 → 613)
          </div>
        </Card>
      </div>

      {/* ── Navigation Tabs ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('latency')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: activeTab === 'latency' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-structural)',
            backgroundColor: activeTab === 'latency' ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
            color: activeTab === 'latency' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'latency' ? 600 : 500,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          1. Read & Write Latency Breakdown
        </button>
        <button
          onClick={() => setActiveTab('concurrency')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: activeTab === 'concurrency' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-structural)',
            backgroundColor: activeTab === 'concurrency' ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
            color: activeTab === 'concurrency' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'concurrency' ? 600 : 500,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          2. Concurrency Scaling & Rate Limiting
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: activeTab === 'resources' ? '1px solid var(--accent-cyan)' : '1px solid var(--border-structural)',
            backgroundColor: activeTab === 'resources' ? 'var(--accent-cyan-container)' : 'var(--bg-surface-lowest)',
            color: activeTab === 'resources' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'resources' ? 600 : 500,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          3. Resource Utilization & Containers
        </button>
      </div>

      {/* ── TAB 1: Latency Breakdown ── */}
      {activeTab === 'latency' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Read Latency Section */}
          <Card title="Read & Verification Operations (CouchDB Key-History Evaluation)" accent="cyan">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Evaluates ledger state via Gateway contract.evaluateTransaction (no orderer consensus needed).
              </span>
              <DataTag type="STATIC" label="[C] M10 Read Dataset" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {READ_BENCHMARKS.map((item) => {
                const percentage = (item.meanMs / 10) * 100;
                return (
                  <div key={item.operation} style={{ padding: '8px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="font-mono" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.operation}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {item.note}</span>
                      </div>
                      <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {item.meanMs.toFixed(2)} ms
                      </span>
                    </div>
                    {/* Visual Bar */}
                    <div style={{ height: 5, width: '100%', backgroundColor: 'var(--bg-surface-highest)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, percentage)}%`, backgroundColor: 'var(--accent-cyan)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Write Latency Section */}
          <Card title="Write & Mutation Operations (Full Consortium Endorsement + Raft Consensus)" accent="green">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Submit pipeline: Proposal → 3-of-4 Org Peer Endorsement → 3 Raft Orderers → Block Commit (T_e2e vs T_gateway).
              </span>
              <DataTag type="STATIC" label="[C] M10 Write Dataset" />
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-structural)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Operation</th>
                    <th style={{ padding: '8px 10px' }}>T_e2e (Total End-to-End)</th>
                    <th style={{ padding: '8px 10px' }}>T_gateway (Fabric Pipeline)</th>
                    <th style={{ padding: '8px 10px' }}>T_app (Express Overhead)</th>
                    <th style={{ padding: '8px 10px' }}>Consensus Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {WRITE_BENCHMARKS.map((item) => (
                    <tr key={item.operation} style={{ borderBottom: '1px solid var(--border-structural)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.operation}
                      </td>
                      <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--status-verified)', fontWeight: 700 }}>
                        {item.e2eMs.toFixed(2)} ms
                      </td>
                      <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                        {item.gatewayMs.toFixed(2)} ms
                      </td>
                      <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--accent-cyan)' }}>
                        {item.appMs.toFixed(2)} ms
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <Badge variant="cyan">3-of-4 Endorsement + Raft</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 14, padding: '10px 12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)', fontSize: 11, color: 'var(--text-muted)' }}>
              <strong>Application Latency Observation:</strong> T_app observed between 2.16 ms and 3.48 ms across all write operations, indicating minimal overhead in the Express gateway layer.
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 2: Concurrency & Rate Limiting ── */}
      {activeTab === 'concurrency' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Concurrency Scaling Table */}
          <Card title="Concurrency Scaling Matrix (C1 through C100)" accent="cyan">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Evaluates throughput and latency under concurrent worker threads (50 requests per concurrency level).
              </span>
              <DataTag type="STATIC" label="[C] M10 Concurrency Dataset" />
            </div>

            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-structural)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Concurrency Level</th>
                    <th style={{ padding: '8px 10px' }}>Success Ratio</th>
                    <th style={{ padding: '8px 10px' }}>Mean Latency</th>
                    <th style={{ padding: '8px 10px' }}>p95 Latency</th>
                    <th style={{ padding: '8px 10px' }}>Throughput (TPS)</th>
                    <th style={{ padding: '8px 10px' }}>Observations</th>
                  </tr>
                </thead>
                <tbody>
                  {CONCURRENCY_DATA.map((row) => (
                    <tr key={row.concurrency} style={{ borderBottom: '1px solid var(--border-structural)' }}>
                      <td className="font-mono" style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                        {row.concurrency}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <Badge variant="verified">{row.success}</Badge>
                      </td>
                      <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>
                        {row.meanMs.toFixed(2)} ms
                      </td>
                      <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                        {row.p95Ms.toFixed(2)} ms
                      </td>
                      <td className="font-mono" style={{ padding: '8px 10px', color: 'var(--status-verified)', fontWeight: 700 }}>
                        {row.tps.toFixed(2)} TPS
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                        {row.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Neutral C50 Anomaly Notice */}
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <ShieldAlert size={18} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--status-warning)' }}>Neutral Benchmark Report on C50 Level:</strong> In the M10 empirical dataset, C50 concurrency exhibited a mean latency of 1205.78 ms (p95 2525.53 ms, TPS 19.79), whereas C100 achieved 327.59 TPS at 293.18 ms. This anomaly is reported neutrally without hypothetical speculation. Primary concurrency tests achieved 0 HTTP 429 and 0 HTTP 5xx errors across all levels.
              </div>
            </div>
          </Card>

          {/* Rate Limiter Stress Test Results */}
          <Card title="Rate Limiter Stress Testing (In-Memory Tiered Throttling)" accent="amber">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Validation of SEC-API-01 sensitive write limiter and general route protection.
              </span>
              <DataTag type="STATIC" label="[C] M10 Rate Limit Matrix" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Sensitive Mutation Limiter
                  </span>
                  <Badge variant="suspended">20 req / min</Badge>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div>Burst test: <strong>30 rapid requests</strong></div>
                  <div>Admitted: <strong style={{ color: 'var(--status-verified)' }}>20 requests (HTTP 200/201)</strong></div>
                  <div>Throttled: <strong style={{ color: 'var(--status-revoked)' }}>10 requests (HTTP 429)</strong></div>
                  <div>First 429 triggered at: <strong>Request #21</strong></div>
                  <div>Retry-After header returned: <strong>39 seconds</strong></div>
                </div>
              </div>

              <div style={{ padding: '14px 16px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    General Read Limiter
                  </span>
                  <Badge variant="cyan">100 req / min</Badge>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div>Burst test: <strong>120 rapid requests</strong></div>
                  <div>Admitted: <strong style={{ color: 'var(--status-verified)' }}>100 requests (HTTP 200)</strong></div>
                  <div>Throttled: <strong style={{ color: 'var(--status-revoked)' }}>20 requests (HTTP 429)</strong></div>
                  <div>First 429 triggered at: <strong>Request #101</strong></div>
                  <div>Retry-After header returned: <strong>59 seconds</strong></div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── TAB 3: Resource Utilization & Containers ── */}
      {activeTab === 'resources' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Container Footprint Grid */}
          <Card title="Consortium Infrastructure Container Snapshots (27 Containers)" accent="cyan">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Empirical memory and CPU consumption across consortium peers, orderers, databases, and API backend.
              </span>
              <DataTag type="STATIC" label="[C] M10 Resource Snapshots" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 16 }}>
              {/* Express Backend */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Express Backend</span>
                  <Badge variant="cyan">Node.js</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>Baseline Heap: <strong className="font-mono">~48 MB</strong></div>
                  <div>Peak Load Heap: <strong className="font-mono">~62 MB</strong></div>
                  <div>Post-Run Heap: <strong className="font-mono">~49 MB</strong></div>
                </div>
              </div>

              {/* 8 Fabric Peers */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>8 Fabric Peers</span>
                  <Badge variant="verified">2 per Org</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>Memory: <strong className="font-mono">&lt; 105 MiB</strong></div>
                  <div>CPU Utilization: <strong className="font-mono">&lt; 2.5%</strong></div>
                  <div>Sync State: <strong style={{ color: 'var(--status-verified)' }}>Synchronized</strong></div>
                </div>
              </div>

              {/* 8 CouchDBs */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>8 CouchDB Instances</span>
                  <Badge variant="neutral">State DB</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>Memory: <strong className="font-mono">~67 – 71 MiB</strong></div>
                  <div>Instance Mapping: <strong>1 per Peer</strong></div>
                  <div>Query Mode: <strong>Key-History Index</strong></div>
                </div>
              </div>

              {/* 3 Orderers */}
              <div style={{ padding: '14px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>3 Raft Orderers</span>
                  <Badge variant="cyan">Gov/Uni/Bank</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>Memory: <strong className="font-mono">&lt; 35 MiB</strong></div>
                  <div>Consensus: <strong>Raft CFT</strong></div>
                  <div>Container Restarts: <strong style={{ color: 'var(--status-verified)' }}>0 Restarts</strong></div>
                </div>
              </div>
            </div>
          </Card>

          {/* Ledger Reconciliation Card */}
          <Card title="Fabric Block Height & Ledger Reconciliation" accent="green">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Channel reconciliation audit following 200 consecutive benchmark write transactions.
              </span>
              <DataTag type="STATIC" label="[C] Block Height Audit" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Initial Block Height</div>
                <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  Block 413
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Final Block Height</div>
                <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--status-verified)', marginTop: 2 }}>
                  Block 613
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Transactions Committed</div>
                <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 2 }}>
                  200 Transactions
                </div>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface-lowest)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-structural)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Block Density</div>
                <div className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  1.00 Tx / Block
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
