import React from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { AppRoute } from '../../App';

interface AppLayoutProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentRoute,
  onNavigate,
  children,
}) => {
  return (
    <div className="app-shell">
      <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />
      <div className="main-content-wrapper">
        <Navbar onNavigate={onNavigate} />
        <main className="page-body-container">{children}</main>
      </div>
    </div>
  );
};
