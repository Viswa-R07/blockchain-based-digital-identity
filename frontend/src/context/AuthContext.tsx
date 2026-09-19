import React, { createContext, useContext, useState, useEffect } from 'react';
import { PersonaConfig, PersonaType } from '../types';
import { DEMO_PERSONAS, getDemoApiKeyForPersona } from '../services/authService';
import { apiClient } from '../services/apiClient';

interface AuthContextType {
  currentPersona: PersonaConfig;
  currentApiKey: string;
  isAuthenticated: boolean;
  switchPersona: (persona: PersonaType, customApiKey?: string) => void;
  setCustomApiKey: (key: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPersonaType, setCurrentPersonaType] = useState<PersonaType>('GOV');
  const [apiKey, setApiKey] = useState<string>(getDemoApiKeyForPersona('GOV'));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);

  useEffect(() => {
    apiClient.setApiKey(apiKey);
    setIsAuthenticated(Boolean(apiKey) || currentPersonaType === 'CITIZEN');
  }, [apiKey, currentPersonaType]);

  const switchPersona = (persona: PersonaType, customKey?: string) => {
    setCurrentPersonaType(persona);
    const resolvedKey = customKey !== undefined ? customKey : getDemoApiKeyForPersona(persona);
    setApiKey(resolvedKey);
  };

  const setCustomApiKey = (key: string) => {
    setApiKey(key);
  };

  const logout = () => {
    setApiKey('');
    setIsAuthenticated(false);
    apiClient.setApiKey('');
  };

  return (
    <AuthContext.Provider
      value={{
        currentPersona: DEMO_PERSONAS[currentPersonaType],
        currentApiKey: apiKey,
        isAuthenticated,
        switchPersona,
        setCustomApiKey,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
