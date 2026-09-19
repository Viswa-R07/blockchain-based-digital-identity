import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  elevated?: boolean;
  accent?: 'cyan' | 'green' | 'amber' | 'red';
  title?: React.ReactNode;
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  style,
  elevated = false,
  accent,
  title,
  headerAction,
}) => {
  const elevatedClass = elevated ? 'card-elevated' : '';
  const accentClass = accent ? `card-accent-${accent}` : '';

  return (
    <div className={`card ${elevatedClass} ${accentClass} ${className}`} style={style}>
      {(title || headerAction) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          {title && <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h3>}
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
