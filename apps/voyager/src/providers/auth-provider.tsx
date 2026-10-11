/**
 * Auth Provider for Notploy Voyager
 * 
 * Provides authentication context and session management.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { secureStorage } from '@/services/secure-storage';
import { instanceStorage } from '@/services/instance-storage';
import { clientManager } from '@/lib/sdk-client';
import type { AuthStatus, UserSession, AuthMethod } from '@/types/domain';
import { userSession } from '@notploy/sdk';

// ============================================================================
// Types
// ============================================================================

/** Auth context value */
interface AuthContextValue {
  /** Current authentication status */
  authStatus: AuthStatus;
  /** User session information */
  userSession?: UserSession;
  /** Current auth method */
  authMethod?: AuthMethod;
  /** Whether authentication is loading */
  isLoading: boolean;
  /** Error message if authentication failed */
  error?: Error;
  /** Active instance ID */
  activeInstanceId?: string;
  /** Active instance */
  activeInstance?: any; // Connection type
  /** Login to an instance */
  login: (instanceId: string, token: string, method?: AuthMethod) => Promise<boolean>;
  /** Logout from an instance */
  logout: (instanceId?: string) => Promise<void>;
  /** Logout from all instances */
  logoutAll: () => Promise<void>;
  /** Check authentication for active instance */
  checkAuth: () => Promise<boolean>;
  /** Switch active instance */
  switchInstance: (instanceId: string) => Promise<void>;
  /** Refresh session */
  refreshSession: (instanceId?: string) => Promise<boolean>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ============================================================================
// Provider Component
// ============================================================================

/**
 * Auth provider component.
 * Manages authentication state for Notploy instances.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('unauthenticated');
  const [userSession, setUserSession] = useState<UserSession | undefined>();
  const [authMethod, setAuthMethod] = useState<AuthMethod | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();
  const [activeInstanceId, setActiveInstanceId] = useState<string | undefined>();
  const [activeInstance, setActiveInstance] = useState<any | undefined>();

  // Load initial state
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(undefined);

        // Get active instance
        const activeId = await instanceStorage.getActiveId();
        const active = activeId ? await instanceStorage.get(activeId) : undefined;
        setActiveInstanceId(activeId);
        setActiveInstance(active);

        // If we have an active instance, check if we're authenticated
        if (activeId && active) {
          const hasToken = await instanceStorage.hasToken(activeId);
          if (hasToken) {
            // Try to validate the session
            const isValid = await validateSession(activeId);
            setAuthStatus(isValid ? 'authenticated' : 'expired');
          } else {
            setAuthStatus('unauthenticated');
          }
        } else {
          setAuthStatus('unauthenticated');
        }
      } catch (err) {
        setError(err as Error);
        setAuthStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  // Validate session with the server
  const validateSession = async (instanceId: string): Promise<boolean> => {
    try {
      const instance = await instanceStorage.get(instanceId);
      if (!instance) return false;

      const token = await instanceStorage.getToken(instanceId);
      if (!token) return false;

      // Use the SDK to check the session
      const client = clientManager.getClientWithAuth(instance, token);
      const response = await userSession({ client });

      if (response.data) {
        setUserSession(response.data as UserSession);
        setAuthMethod('api-key');
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  // Login to an instance
  const login = useCallback(
    async (instanceId: string, token: string, method: AuthMethod = 'api-key') => {
      try {
        setIsLoading(true);
        setError(undefined);

        // Store the token
        await instanceStorage.setToken(instanceId, token);

        // Validate the session
        const isValid = await validateSession(instanceId);

        if (isValid) {
          // Set as active instance
          await instanceStorage.setActive(instanceId);
          setActiveInstanceId(instanceId);
          setActiveInstance(await instanceStorage.get(instanceId));
          setAuthStatus('authenticated');
          setAuthMethod(method);
        } else {
          // Clear the token if validation failed
          await instanceStorage.deleteToken(instanceId);
          setAuthStatus('unauthenticated');
          return false;
        }

        return true;
      } catch (err) {
        setError(err as Error);
        setAuthStatus('error');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Logout from an instance
  const logout = useCallback(async (instanceId?: string) => {
    const targetId = instanceId || activeInstanceId;
    if (!targetId) return;

    try {
      setIsLoading(true);
      setError(undefined);

      // Clear the token
      await instanceStorage.deleteToken(targetId);

      // Clear session
      setUserSession(undefined);
      setAuthMethod(undefined);
      setAuthStatus('unauthenticated');

      // If we logged out from the active instance, clear it
      if (!instanceId) {
        setActiveInstanceId(undefined);
        setActiveInstance(undefined);
      }

      // Clear client cache
      clientManager.removeClient(targetId);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [activeInstanceId]);

  // Logout from all instances
  const logoutAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);

      // Clear all tokens
      const instances = await instanceStorage.getAll();
      await Promise.all(
        instances.map(async (i) => {
          await instanceStorage.deleteToken(i.id);
          clientManager.removeClient(i.id);
        }),
      );

      // Clear session
      setUserSession(undefined);
      setAuthMethod(undefined);
      setAuthStatus('unauthenticated');
      setActiveInstanceId(undefined);
      setActiveInstance(undefined);

      // Clear active instance
      await instanceStorage.setActive('');
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check authentication for active instance
  const checkAuth = useCallback(async () => {
    if (!activeInstanceId) {
      setAuthStatus('unauthenticated');
      return false;
    }

    try {
      const hasToken = await instanceStorage.hasToken(activeInstanceId);
      if (!hasToken) {
        setAuthStatus('unauthenticated');
        return false;
      }

      const isValid = await validateSession(activeInstanceId);
      setAuthStatus(isValid ? 'authenticated' : 'expired');
      return isValid;
    } catch (err) {
      setError(err as Error);
      setAuthStatus('error');
      return false;
    }
  }, [activeInstanceId]);

  // Switch active instance
  const switchInstance = useCallback(async (instanceId: string) => {
    try {
      setIsLoading(true);
      setError(undefined);

      // Switch to the new instance
      await instanceStorage.setActive(instanceId);
      setActiveInstanceId(instanceId);
      setActiveInstance(await instanceStorage.get(instanceId));

      // Check if we're authenticated with this instance
      const hasToken = await instanceStorage.hasToken(instanceId);
      if (hasToken) {
        const isValid = await validateSession(instanceId);
        setAuthStatus(isValid ? 'authenticated' : 'expired');
      } else {
        setAuthStatus('unauthenticated');
        setUserSession(undefined);
      }
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh session
  const refreshSession = useCallback(
    async (instanceId?: string) => {
      const targetId = instanceId || activeInstanceId;
      if (!targetId) return false;

      try {
        const isValid = await validateSession(targetId);
        setAuthStatus(isValid ? 'authenticated' : 'expired');
        return isValid;
      } catch {
        return false;
      }
    },
    [activeInstanceId],
  );

  const contextValue: AuthContextValue = {
    authStatus,
    userSession,
    authMethod,
    isLoading,
    error,
    activeInstanceId,
    activeInstance,
    login,
    logout,
    logoutAll,
    checkAuth,
    switchInstance,
    refreshSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access auth context.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
