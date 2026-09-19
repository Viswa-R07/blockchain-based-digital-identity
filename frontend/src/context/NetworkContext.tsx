import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { HealthResponse } from '../types';
import { apiClient } from '../services/apiClient';

interface NetworkContextType {
  isConnected: boolean;
  isConnecting: boolean;
  healthData: HealthResponse | null;
  lastChecked: string;
  latencyMs: number;
  refreshHealth: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('Never');
  const [latencyMs, setLatencyMs] = useState<number>(0);

  const refreshHealth = useCallback(async () => {
    setIsConnecting(true);
    const result = await apiClient.get<HealthResponse>('/health');
    setIsConnecting(false);
    setLatencyMs(result.latencyMs);
    setLastChecked(new Date().toLocaleTimeString());

    if (result.status === 200 && result.data) {
      setIsConnected(true);
      setHealthData(result.data);
    } else {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 30000);
    return () => clearInterval(interval);
  }, [refreshHealth]);

  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        isConnecting,
        healthData,
        lastChecked,
        latencyMs,
        refreshHealth,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = (): NetworkContextType => {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};
