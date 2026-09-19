import { PersonaConfig, PersonaType } from '../types';
import { apiClient } from './apiClient';

export const DEMO_PERSONAS: Record<PersonaType, PersonaConfig> = {
  GOV: {
    id: 'GOV',
    name: 'Government Identity Authority',
    roleTitle: 'National Registrar',
    mspId: 'GovMSP',
    issuerDid: 'did:example:gov:authority',
    description: 'Registers Subject DIDs and issues National Identity credentials.',
    allowedCredentialTypes: ['government-id'],
    badgeColor: 'cyan',
  },
  UNI: {
    id: 'UNI',
    name: 'Apex Technical University',
    roleTitle: 'University Registrar',
    mspId: 'UniversityMSP',
    issuerDid: 'did:example:university:registrar',
    description: 'Issues accredited academic degree and diploma credentials.',
    allowedCredentialTypes: ['academic'],
    badgeColor: 'verified',
  },
  BANK: {
    id: 'BANK',
    name: 'Global Reserve Trust',
    roleTitle: 'Compliance Officer',
    mspId: 'BankMSP',
    issuerDid: 'did:example:bank:compliance',
    description: 'Issues Tier 1-3 KYC verification and AML compliance credentials.',
    allowedCredentialTypes: ['kyc'],
    badgeColor: 'suspended',
  },
  EMP: {
    id: 'EMP',
    name: 'OmniCorp Enterprise HR',
    roleTitle: 'Human Resources Director',
    mspId: 'EmployerMSP',
    issuerDid: 'did:example:employer:hr',
    description: 'Issues verified employment records and corporate tenure credentials.',
    allowedCredentialTypes: ['employment'],
    badgeColor: 'neutral',
  },
  VERIFIER: {
    id: 'VERIFIER',
    name: 'Enterprise Security Verifier',
    roleTitle: 'Relying Party / Auditor',
    mspId: 'VerifierOrg',
    description: 'Executes cryptographic zero-knowledge and on-chain commitment verification.',
    allowedCredentialTypes: [],
    badgeColor: 'cyan',
  },
  CITIZEN: {
    id: 'CITIZEN',
    name: 'Elena Vance (Subject)',
    roleTitle: 'Citizen / Wallet Holder',
    mspId: 'Public',
    description: 'Manages personal DID, views off-chain encrypted vault, and inspects status.',
    allowedCredentialTypes: [],
    badgeColor: 'neutral',
  },
};

export const getDemoApiKeyForPersona = (persona: PersonaType): string => {
  const env = import.meta.env;
  switch (persona) {
    case 'GOV':
      return env.VITE_DEMO_KEY_GOV || 'gov-admin-api-key-2026-prod';
    case 'UNI':
      return env.VITE_DEMO_KEY_UNI || 'uni-registrar-api-key-2026-prod';
    case 'BANK':
      return env.VITE_DEMO_KEY_BANK || 'bank-compliance-api-key-2026-prod';
    case 'EMP':
      return env.VITE_DEMO_KEY_EMP || 'emp-hr-api-key-2026-prod';
    case 'VERIFIER':
      return env.VITE_DEMO_KEY_VERIFIER || 'verifier-portal-api-key-2026-prod';
    case 'CITIZEN':
      return '';
    default:
      return '';
  }
};

export const validateApiKeyWithBackend = async (
  apiKey: string
): Promise<{ valid: boolean; message: string; latencyMs: number }> => {
  if (!apiKey) {
    return { valid: false, message: 'API key is required', latencyMs: 0 };
  }

  const prevKey = apiClient.getApiKey();
  apiClient.setApiKey(apiKey);

  const result = await apiClient.get('/identities/did:example:probe/exists');
  apiClient.setApiKey(prevKey);

  if (result.status === 401 || result.status === 403) {
    return {
      valid: false,
      message: 'Invalid API key or unauthorized institutional credential',
      latencyMs: result.latencyMs,
    };
  }

  return {
    valid: result.status === 200,
    message: result.status === 200 ? 'Authenticated successfully' : (result.error || 'Validation failed'),
    latencyMs: result.latencyMs,
  };
};
