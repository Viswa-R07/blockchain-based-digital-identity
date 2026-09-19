import React from 'react';
import { DataClassification } from '../../types';

interface DataTagProps {
  type: DataClassification;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const DataTag: React.FC<DataTagProps> = ({ type, label, className = '', style }) => {
  const getTagClass = () => {
    switch (type) {
      case 'LIVE':
        return 'data-tag-live';
      case 'DERIVED':
        return 'data-tag-derived';
      case 'STATIC':
        return 'data-tag-static';
      case 'SAMPLE':
        return 'data-tag-sample';
      default:
        return 'data-tag-static';
    }
  };

  const getTagText = () => {
    if (label) return label;
    switch (type) {
      case 'LIVE':
        return '[A] Live Backend Data';
      case 'DERIVED':
        return '[B] Derived Frontend Data';
      case 'STATIC':
        return '[C] Static Architectural Info';
      case 'SAMPLE':
        return '[D] Sample / Placeholder Data';
    }
  };

  return <span className={`data-tag ${getTagClass()} ${className}`} style={style}>{getTagText()}</span>;
};
