import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNetwork } from '../../context/NetworkContext';
import { DataTag } from '../common/DataTag';
import { Badge } from '../common/Badge';
import { ShieldCheck, User } from 'lucide-react';
import { AppRoute } from '../../App';

interface NavbarProps {
  onNavigate: (route: AppRoute) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const { currentPersona } = useAuth();
  const { isConnected, isConnecting, latencyMs } = useNetwork();

  return (
    <header className="navbar-container">
      {/* Left: Brand Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          onClick={() => onNavigate('landing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #082F49 0%, #0369A1 100%)',
              border: '1px solid var(--accent-cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-cyan-glow)',
            }}
          >
            <ShieldCheck size={18} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: '#F8FAFC' }}>
              Fabric<span style={{ color: 'var(--accent-cyan)' }}>ID</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1, letterSpacing: '0.02em' }}>
              Digital Identity System
            </div>
          </div>
        </div>

        <div style={{ marginLeft: 16, height: 20, width: 1, backgroundColor: 'var(--border-structural)' }} />

        {/* Global Architecture Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Network:</span>
          <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            identity-channel
          </span>
          <Badge variant="cyan" className="font-mono">
            HLF 2.5.16
          </Badge>
          <DataTag type="STATIC" label="[C] 3-of-4 Org Policy" />
        </div>
      </div>

      {/* Right: Live Network Pulse & Active Persona */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            backgroundColor: 'var(--bg-surface-lowest)',
            border: '1px solid var(--border-structural)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span
            className={`pulse-dot ${
              isConnected ? 'pulse-dot-green' : isConnecting ? 'pulse-dot-amber' : 'pulse-dot-red'
            }`}
          />
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {isConnected ? 'Gateway Online' : isConnecting ? 'Probing...' : 'Gateway Offline'}
          </span>
          {isConnected && (
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>
              {latencyMs}ms
            </span>
          )}
          <DataTag type="LIVE" label="[A]" />
        </div>

        <div
          onClick={() => onNavigate('auth')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '5px 12px',
            backgroundColor: 'var(--bg-surface-highest)',
            border: '1px solid var(--border-interactive)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
          title="Click to switch Prototype Demonstration Persona"
        >
          <User size={15} color="var(--accent-cyan)" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {currentPersona.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {currentPersona.mspId} • {currentPersona.roleTitle}
            </div>
          </div>
          <Badge variant={currentPersona.badgeColor}>Demo</Badge>
        </div>
      </div>
    </header>
  );
};
