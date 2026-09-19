import React from 'react';

export type BadgeVariant = 'verified' | 'suspended' | 'revoked' | 'neutral' | 'cyan';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
  style,
}) => {
  return <span className={`badge badge-${variant} ${className}`} style={style}>{children}</span>;
};
