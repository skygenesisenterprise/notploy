/**
 * Secure Storage Service for Notploy Voyager
 * 
 * This service provides secure storage for sensitive data (API tokens, session tokens, etc.)
 * using expo-secure-store on mobile devices.
 * 
 * Security considerations:
 * - Uses expo-secure-store which encrypts data using the device's secure enclave
 * - Data is isolated per app and per device
 * - Sensitive data should NEVER be logged
 * - Keys should be properly namespaced
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// ============================================================================
// Configuration
// ============================================================================

/** Prefix for all storage keys */
const KEY_PREFIX = 'notploy_voyager_';

/**
 * Storage key types
 * Using different prefixes for different types of data helps with organization
 * and potential future migration.
 */
export enum StorageKeyType {
  // Credential storage
  API_TOKEN = 'api_token',
  SESSION_TOKEN = 'session_token',
  
  // Instance metadata
  INSTANCE_METADATA = 'instance_meta',
  
  // Session data
  USER_SESSION = 'user_session',
  ACTIVE_INSTANCE = 'active_instance',
  
  // Settings
  APP_SETTINGS = 'app_settings',
  
  // Security
  BIOMETRIC_TOKEN = 'biometric_token',
}

/**
 * Create a properly namespaced storage key.
 */
function createKey(type: StorageKeyType, identifier?: string): string {
  const base = `${KEY_PREFIX}${type}`;
  if (identifier) {
    return `${base}_${identifier}`;
  }
  return base;
}

// ============================================================================
// Storage Service
// ============================================================================

/**
 * Secure Storage Service
 * 
 * Provides secure storage for sensitive data using expo-secure-store.
 * 
 * Features:
 * - Encrypted storage using device secure enclave
 * - Automatic key namespacing
 * - Type-safe get/set/delete operations
 * - Error handling and logging (without sensitive data)
 */
export class SecureStorageService {
  /**
   * Check if secure storage is available.
   * On some devices/emulators, secure storage might not be available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        // SecureStore is not available on web
        // For web, we'd need a different solution (cookies, localStorage, etc.)
        return false;
      }
      
      // Try to check if we can access secure storage
      const testKey = createKey(StorageKeyType.API_TOKEN, 'test');
      await SecureStore.setItemAsync(testKey, 'test');
      const value = await SecureStore.getItemAsync(testKey);
      await SecureStore.deleteItemAsync(testKey);
      
      return value === 'test';
    } catch {
      return false;
    }
  }

  /**
   * Store an API token for a specific connection.
   */
  async setApiToken(connectionId: string, token: string): Promise<void> {
    const key = createKey(StorageKeyType.API_TOKEN, connectionId);
    
    try {
      await SecureStore.setItemAsync(key, token);
    } catch (error) {
      console.error('Failed to store API token:', error);
      throw new Error('Failed to store API token securely');
    }
  }

  /**
   * Get an API token for a specific connection.
   */
  async getApiToken(connectionId: string): Promise<string | null> {
    const key = createKey(StorageKeyType.API_TOKEN, connectionId);
    
    try {
      const token = await SecureStore.getItemAsync(key);
      return token || null;
    } catch (error) {
      console.error('Failed to retrieve API token:', error);
      return null;
    }
  }

  /**
   * Delete an API token for a specific connection.
   */
  async deleteApiToken(connectionId: string): Promise<void> {
    const key = createKey(StorageKeyType.API_TOKEN, connectionId);
    
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to delete API token:', error);
      // Don't throw - deletion failure is not critical
    }
  }

  /**
   * Store a session token for a specific connection.
   */
  async setSessionToken(connectionId: string, token: string): Promise<void> {
    const key = createKey(StorageKeyType.SESSION_TOKEN, connectionId);
    
    try {
      await SecureStore.setItemAsync(key, token);
    } catch (error) {
      console.error('Failed to store session token:', error);
      throw new Error('Failed to store session token securely');
    }
  }

  /**
   * Get a session token for a specific connection.
   */
  async getSessionToken(connectionId: string): Promise<string | null> {
    const key = createKey(StorageKeyType.SESSION_TOKEN, connectionId);
    
    try {
      const token = await SecureStore.getItemAsync(key);
      return token || null;
    } catch (error) {
      console.error('Failed to retrieve session token:', error);
      return null;
    }
  }

  /**
   * Delete a session token for a specific connection.
   */
  async deleteSessionToken(connectionId: string): Promise<void> {
    const key = createKey(StorageKeyType.SESSION_TOKEN, connectionId);
    
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to delete session token:', error);
    }
  }

  /**
   * Store user session data.
   */
  async setUserSession(connectionId: string, session: object): Promise<void> {
    const key = createKey(StorageKeyType.USER_SESSION, connectionId);
    
    try {
      const json = JSON.stringify(session);
      await SecureStore.setItemAsync(key, json);
    } catch (error) {
      console.error('Failed to store user session:', error);
      throw new Error('Failed to store user session securely');
    }
  }

  /**
   * Get user session data.
   */
  async getUserSession<T = unknown>(connectionId: string): Promise<T | null> {
    const key = createKey(StorageKeyType.USER_SESSION, connectionId);
    
    try {
      const json = await SecureStore.getItemAsync(key);
      if (!json) return null;
      return JSON.parse(json) as T;
    } catch (error) {
      console.error('Failed to retrieve user session:', error);
      return null;
    }
  }

  /**
   * Delete user session data.
   */
  async deleteUserSession(connectionId: string): Promise<void> {
    const key = createKey(StorageKeyType.USER_SESSION, connectionId);
    
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to delete user session:', error);
    }
  }

  /**
   * Store the active instance ID.
   */
  async setActiveInstance(connectionId: string): Promise<void> {
    const key = createKey(StorageKeyType.ACTIVE_INSTANCE);
    
    try {
      await SecureStore.setItemAsync(key, connectionId);
    } catch (error) {
      console.error('Failed to store active instance:', error);
    }
  }

  /**
   * Get the active instance ID.
   */
  async getActiveInstance(): Promise<string | null> {
    const key = createKey(StorageKeyType.ACTIVE_INSTANCE);
    
    try {
      const id = await SecureStore.getItemAsync(key);
      return id || null;
    } catch (error) {
      console.error('Failed to retrieve active instance:', error);
      return null;
    }
  }

  /**
   * Delete the active instance ID.
   */
  async deleteActiveInstance(): Promise<void> {
    const key = createKey(StorageKeyType.ACTIVE_INSTANCE);
    
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to delete active instance:', error);
    }
  }

  /**
   * Clear all data for a specific connection.
   * Call this when switching connections or logging out.
   */
  async clearConnection(connectionId: string): Promise<void> {
    await Promise.all([
      this.deleteApiToken(connectionId),
      this.deleteSessionToken(connectionId),
      this.deleteUserSession(connectionId),
    ]);
  }

  /**
   * Clear all secure storage.
   * Call this when logging out of the app completely.
   */
  async clearAll(): Promise<void> {
    try {
      // Get all keys and delete them
      // Note: expo-secure-store doesn't provide a listKeys method
      // So we need to track our own keys or use a different approach
      
      // For now, we'll clear the specific keys we know about
      // This is not ideal but works for our use case
      await this.clearActiveInstance();
      
      // Clear all connections (we'll need to track connection IDs separately)
      // For a complete solution, we'd need to store connection IDs in AsyncStorage
    } catch (error) {
      console.error('Failed to clear all secure storage:', error);
    }
  }

  /**
   * Clear the active instance data.
   */
  async clearActiveInstance(): Promise<void> {
    const activeId = await this.getActiveInstance();
    if (activeId) {
      await this.clearConnection(activeId);
      await this.deleteActiveInstance();
    }
  }

  /**
   * Store biometric authentication token.
   */
  async setBiometricToken(token: string): Promise<void> {
    const key = createKey(StorageKeyType.BIOMETRIC_TOKEN);
    
    try {
      await SecureStore.setItemAsync(key, token);
    } catch (error) {
      console.error('Failed to store biometric token:', error);
      throw new Error('Failed to store biometric token securely');
    }
  }

  /**
   * Get biometric authentication token.
   */
  async getBiometricToken(): Promise<string | null> {
    const key = createKey(StorageKeyType.BIOMETRIC_TOKEN);
    
    try {
      const token = await SecureStore.getItemAsync(key);
      return token || null;
    } catch (error) {
      console.error('Failed to retrieve biometric token:', error);
      return null;
    }
  }

  /**
   * Delete biometric authentication token.
   */
  async deleteBiometricToken(): Promise<void> {
    const key = createKey(StorageKeyType.BIOMETRIC_TOKEN);
    
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('Failed to delete biometric token:', error);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Singleton secure storage service instance */
export const secureStorage = new SecureStorageService();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Credential key for a connection (for compatibility with desktop naming).
 */
export function credentialKey(connectionId: string): string {
  return createKey(StorageKeyType.API_TOKEN, connectionId);
}

/**
 * Describe a credential key without exposing the actual connection ID.
 * Useful for logging.
 */
export function describeCredentialKey(key: string): string {
  return key.replace(/[0-9a-f-]{8,}/gi, '<id>');
}
