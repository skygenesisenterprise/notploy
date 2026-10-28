/**
 * Instances Provider for Notploy Voyager
 * 
 * Provides context for managing Notploy instances (connections).
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { instanceStorage } from '@/services/instance-storage';
import { secureStorage } from '@/services/secure-storage';
import type {
  Connection,
  ConnectionInput,
  ConnectionUpdate,
  ConnectionSummary,
} from '@/types/domain';
import type { InstanceWithAuth } from '@/services/instance-storage';

// ============================================================================
// Types
// ============================================================================

/** Instances context value */
interface InstancesContextValue {
  /** All configured instances */
  instances: ConnectionSummary[];
  /** Active instance */
  activeInstance?: ConnectionSummary;
  /** Whether instances are loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error?: Error;
  /** Refresh instances */
  refresh: () => Promise<void>;
  /** Add a new instance */
  addInstance: (input: ConnectionInput) => Promise<Connection>;
  /** Update an existing instance */
  updateInstance: (
    id: string,
    update: ConnectionUpdate,
  ) => Promise<Connection | undefined>;
  /** Remove an instance */
  removeInstance: (id: string) => Promise<void>;
  /** Set the active instance */
  setActiveInstance: (id: string) => Promise<void>;
  /** Get an instance by ID */
  getInstance: (id: string) => Promise<Connection | undefined>;
  /** Get the API token for an instance */
  getInstanceToken: (id: string) => Promise<string | null>;
  /** Set the API token for an instance */
  setInstanceToken: (id: string, token: string) => Promise<void>;
  /** Check if an instance has a token */
  hasInstanceToken: (id: string) => Promise<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const InstancesContext = createContext<InstancesContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Instances provider component.
 * Manages the state of configured Notploy instances.
 */
export function InstancesProvider({ children }: { children: React.ReactNode }) {
  const [instances, setInstances] = useState<ConnectionSummary[]>([]);
  const [activeInstance, setActiveInstanceState] = useState<ConnectionSummary | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  // Load instances on mount
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        
        const summaries = await instanceStorage.getSummaries();
        setInstances(summaries);

        const active = await instanceStorage.getActive();
        if (active) {
          const activeSummary = summaries.find((i) => i.id === active.id);
          setActiveInstanceState(activeSummary);
        } else if (summaries.length > 0) {
          // If no active instance, use the first one
          setActiveInstanceState(summaries[0]);
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    load();

    // Subscribe to storage changes (for future implementation)
    return () => {
      // Cleanup
    };
  }, []);

  // Refresh instances
  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);
      
      const summaries = await instanceStorage.getSummaries();
      setInstances(summaries);

      const active = await instanceStorage.getActive();
      if (active) {
        const activeSummary = summaries.find((i) => i.id === active.id);
        setActiveInstanceState(activeSummary);
      } else if (summaries.length > 0) {
        setActiveInstanceState(summaries[0]);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Add a new instance
  const addInstance = useCallback(async (input: ConnectionInput) => {
    const connection = await instanceStorage.add(input);
    await refresh();
    return connection;
  }, [refresh]);

  // Update an existing instance
  const updateInstance = useCallback(
    async (id: string, update: ConnectionUpdate) => {
      const connection = await instanceStorage.update(id, update);
      await refresh();
      return connection;
    },
    [refresh],
  );

  // Remove an instance
  const removeInstance = useCallback(async (id: string) => {
    await instanceStorage.remove(id);
    await refresh();
  }, [refresh]);

  // Set the active instance
  const setActiveInstance = useCallback(async (id: string) => {
    await instanceStorage.setActive(id);
    await refresh();
  }, [refresh]);

  // Get an instance by ID
  const getInstance = useCallback(async (id: string) => {
    return instanceStorage.get(id);
  }, []);

  // Get the API token for an instance
  const getInstanceToken = useCallback(async (id: string) => {
    return instanceStorage.getToken(id);
  }, []);

  // Set the API token for an instance
  const setInstanceToken = useCallback(async (id: string, token: string) => {
    await instanceStorage.setToken(id, token);
  }, []);

  // Check if an instance has a token
  const hasInstanceToken = useCallback(async (id: string) => {
    return instanceStorage.hasToken(id);
  }, []);

  const contextValue: InstancesContextValue = {
    instances,
    activeInstance,
    isLoading,
    error,
    refresh,
    addInstance,
    updateInstance,
    removeInstance,
    setActiveInstance,
    getInstance,
    getInstanceToken,
    setInstanceToken,
    hasInstanceToken,
  };

  return (
    <InstancesContext.Provider value={contextValue}>
      {children}
    </InstancesContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access instances context.
 */
export function useInstances(): InstancesContextValue {
  const context = useContext(InstancesContext);
  if (!context) {
    throw new Error('useInstances must be used within an InstancesProvider');
  }
  return context;
}
