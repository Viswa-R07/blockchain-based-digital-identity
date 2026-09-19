import React from 'react';
import { AppRoute } from '../../App';
import {
  Home,
  Key,
  Wallet,
  Lock,
  CheckCircle2,
  Building2,
  FilePlus,
  RefreshCw,
  Network,
  History,
  Shield,
  BarChart3,
} from 'lucide-react';

interface SidebarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

interface NavItem {
  route: AppRoute;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, onNavigate }) => {
  const sections: NavSection[] = [
    {
      title: 'PLATFORM OVERVIEW',
      items: [
        { route: 'landing', label: '1. Overview & Consortium', icon: <Home size={16} /> },
      ],
    },
    {
      title: 'IDENTITY & CITIZEN WALLET',
      items: [
        { route: 'auth', label: '2. Auth Gateway', icon: <Key size={16} />, badge: 'Demo' },
        { route: 'wallet', label: '3. Citizen Wallet', icon: <Wallet size={16} /> },
        { route: 'vault', label: '4. Encrypted Vault', icon: <Lock size={16} /> },
        { route: 'verify', label: '5. Verification Terminal', icon: <CheckCircle2 size={16} /> },
      ],
    },
    {
      title: 'CONSORTIUM OPERATIONS',
      items: [
        { route: 'portal', label: '6. Institutional Portal', icon: <Building2 size={16} /> },
        { route: 'issue', label: '7. Credential Issuance', icon: <FilePlus size={16} />, badge: 'Issuer' },
        { route: 'lifecycle', label: '8. Lifecycle Center', icon: <RefreshCw size={16} />, badge: 'ABAC' },
      ],
    },
    {
      title: 'NETWORK & GOVERNANCE',
      items: [
        { route: 'network', label: '9. Network Explorer', icon: <Network size={16} /> },
        { route: 'audit', label: '10. Audit Ledger', icon: <History size={16} /> },
        { route: 'security', label: '11. Security Center', icon: <Shield size={16} /> },
        { route: 'analytics', label: '12. Performance Analytics', icon: <BarChart3 size={16} />, badge: 'M10' },
      ],
    },
  ];

  return (
    <aside className="sidebar-container">
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-structural)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            CONSORTIUM CLIENT
          </span>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
            Hyperledger Fabric v2.5
          </div>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--bg-surface-highest)',
            color: 'var(--accent-cyan)',
            border: '1px solid var(--border-interactive)',
          }}
        >
          v3.0
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {sections.map((section) => (
          <div key={section.title} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                padding: '4px 10px 8px',
              }}
            >
              {section.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item) => {
                const isActive = currentRoute === item.route;
                return (
                  <button
                    key={item.route}
                    onClick={() => onNavigate(item.route)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: isActive ? 'var(--accent-cyan-container)' : 'transparent',
                      color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: isActive ? 'var(--accent-cyan)' : 'var(--bg-surface-highest)',
                          color: isActive ? '#082f49' : 'var(--text-muted)',
                          fontWeight: 600,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-structural)',
          backgroundColor: 'var(--bg-surface-lowest)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Endorsement:</span>
          <span style={{ color: 'var(--text-secondary)' }}>3-of-4 Orgs</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Raft Nodes:</span>
          <span style={{ color: 'var(--text-secondary)' }}>3 Orderers</span>
        </div>
      </div>
    </aside>
  );
};
