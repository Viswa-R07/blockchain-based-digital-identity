import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import { AppLayout } from './components/layout/AppLayout';

// 12 Page Shells
import { LandingPage } from './pages/LandingPage';
import { AuthGatewayPage } from './pages/AuthGatewayPage';
import { CitizenWalletPage } from './pages/CitizenWalletPage';
import { VaultInspectorPage } from './pages/VaultInspectorPage';
import { VerificationPage } from './pages/VerificationPage';
import { ConsortiumPortalPage } from './pages/ConsortiumPortalPage';
import { IssuanceWizardPage } from './pages/IssuanceWizardPage';
import { LifecycleCenterPage } from './pages/LifecycleCenterPage';
import { NetworkExplorerPage } from './pages/NetworkExplorerPage';
import { AuditLedgerPage } from './pages/AuditLedgerPage';
import { SecurityCenterPage } from './pages/SecurityCenterPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

export type AppRoute =
  | 'landing'
  | 'auth'
  | 'wallet'
  | 'vault'
  | 'verify'
  | 'portal'
  | 'issue'
  | 'lifecycle'
  | 'network'
  | 'audit'
  | 'security'
  | 'analytics';

const routePathMap: Record<AppRoute, string> = {
  landing: '/',
  auth: '/auth',
  wallet: '/wallet',
  vault: '/vault',
  verify: '/verify',
  portal: '/portal',
  issue: '/issue',
  lifecycle: '/lifecycle',
  network: '/network',
  audit: '/audit',
  security: '/security',
  analytics: '/analytics',
};

// Comprehensive route alias resolver supporting /consortium and /performance
const resolveRoute = (input: string): AppRoute => {
  const clean = input.toLowerCase().replace(/^[#/]+/, '').split('?')[0].split('/')[0];
  switch (clean) {
    case '':
    case 'landing':
      return 'landing';
    case 'auth':
      return 'auth';
    case 'wallet':
      return 'wallet';
    case 'vault':
      return 'vault';
    case 'verify':
      return 'verify';
    case 'portal':
    case 'consortium':
      return 'portal';
    case 'issue':
    case 'issuance':
      return 'issue';
    case 'lifecycle':
    case 'revocation':
      return 'lifecycle';
    case 'network':
    case 'explorer':
      return 'network';
    case 'audit':
    case 'ledger':
      return 'audit';
    case 'security':
      return 'security';
    case 'analytics':
    case 'performance':
      return 'analytics';
    default:
      return 'landing';
  }
};

const getRouteFromUrl = (): AppRoute => {
  const hash = window.location.hash;
  if (hash) {
    const resolved = resolveRoute(hash);
    if (resolved !== 'landing' || hash === '#' || hash === '#/') return resolved;
  }
  const path = window.location.pathname;
  return resolveRoute(path);
};

export const App: React.FC = () => {
  React.useEffect(() => {
    document.title = 'FabricID — Blockchain-Based Digital Identity Verification System';
  }, []);

  const [currentRoute, setCurrentRoute] = useState<AppRoute>(getRouteFromUrl());

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getRouteFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const handleNavigate = (route: AppRoute) => {
    setCurrentRoute(route);
    const path = routePathMap[route] || '/';
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  };

  const renderCurrentPage = () => {
    switch (currentRoute) {
      case 'landing':
        return <LandingPage onNavigate={handleNavigate} />;
      case 'auth':
        return <AuthGatewayPage onNavigate={handleNavigate} />;
      case 'wallet':
        return <CitizenWalletPage onNavigate={handleNavigate} />;
      case 'vault':
        return <VaultInspectorPage onNavigate={handleNavigate} />;
      case 'verify':
        return <VerificationPage onNavigate={handleNavigate} />;
      case 'portal':
        return <ConsortiumPortalPage onNavigate={handleNavigate} />;
      case 'issue':
        return <IssuanceWizardPage onNavigate={handleNavigate} />;
      case 'lifecycle':
        return <LifecycleCenterPage onNavigate={handleNavigate} />;
      case 'network':
        return <NetworkExplorerPage onNavigate={handleNavigate} />;
      case 'audit':
        return <AuditLedgerPage onNavigate={handleNavigate} />;
      case 'security':
        return <SecurityCenterPage onNavigate={handleNavigate} />;
      case 'analytics':
        return <AnalyticsPage onNavigate={handleNavigate} />;
      default:
        return <LandingPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AuthProvider>
      <NetworkProvider>
        <AppLayout currentRoute={currentRoute} onNavigate={handleNavigate}>
          {renderCurrentPage()}
        </AppLayout>
      </NetworkProvider>
    </AuthProvider>
  );
};

export default App;
