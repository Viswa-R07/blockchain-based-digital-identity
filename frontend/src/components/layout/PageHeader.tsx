import React from 'react';
import { DataTag } from '../common/DataTag';
import { DataClassification } from '../../types';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  dataClassification: DataClassification;
  dataTagLabel?: string;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  dataClassification,
  dataTagLabel,
  actions,
}) => {
  return (
    <div className="page-header">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 className="page-title">{title}</h1>
          <DataTag type={dataClassification} label={dataTagLabel} />
        </div>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {actions && <div style={{ display: 'flex', gap: 10 }}>{actions}</div>}
    </div>
  );
};
