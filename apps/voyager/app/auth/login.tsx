/**
 * Login Screen for Notploy Voyager
 * 
 * Allows users to authenticate with a Notploy instance.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useColor } from '@/hooks/use-color';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';
import { useInstances } from '@/hooks/use-instances';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingView } from '@/components/ui/loading-view';
import { ErrorView } from '@/components/ui/error-view';
import { Card } from '@/components/ui/card';

// ============================================================================
// Component
// ============================================================================

/**
 * Login screen component.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ instanceId?: string }>();
  const color = useColor();
  const t = useTranslation();
  
  const { login, isLoading: authLoading, error: authError } = useAuth();
  const { getInstance, instances, isLoading: instancesLoading } = useInstances();

  // Local state
  const [token, setToken] = useState('');
  const [instanceId, setInstanceId] = useState<string | undefined>(params.instanceId);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // If we have an instanceId from params, use it
  const instance = instanceId ? instances.find((i) => i.id === instanceId) : undefined;

  // Handle login
  const handleLogin = async () => {
    if (!token.trim()) {
      setError('Please enter your API token');
      return;
    }

    if (!instanceId) {
      setError('Please select an instance');
      return;
    }

    try {
      setIsLoading(true);
      setError(undefined);

      const success = await login(instanceId, token.trim(), 'api-key');
      
      if (success) {
        // Login successful, navigate to home
        router.replace('/(tabs)');
      } else {
        setError('Login failed. Please check your token and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle instance selection
  const handleSelectInstance = (id: string) => {
    setInstanceId(id);
    setError(undefined);
  };

  // Combined loading state
  const loading = isLoading || authLoading || instancesLoading;
  const hasError = error || authError?.message;

  if (loading) {
    return (
      <LoadingView
        message={t('auth.login')}
        style={[styles.container, { paddingTop: insets.top }]}
      />
    );
  }

  if (hasError && !token) {
    return (
      <ErrorView
        message={t('auth.loginFailed')}
        description={error}
        onRetry={() => setError(undefined)}
        style={[styles.container, { paddingTop: insets.top }]}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: color.foreground }]}>
            {t('auth.login')}
          </Text>
          
          <Text style={[styles.subtitle, { color: color.mutedForeground }]}>
            {t('auth.login')}{' '}{t('home.to')}{' '}Notploy
          </Text>
        </View>

        {/* Instance Selection */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: color.foreground }]}>
            {t('instances.switchInstance')}
          </Text>
          
          <View style={styles.instanceList}>
            {instances.map((i) => (
              <TouchableOpacity
                key={i.id}
                style={[\n                  styles.instanceItem,
                  instanceId === i.id && styles.instanceItemSelected,
                  { borderColor: color.border },
                ]}
                onPress={() => handleSelectInstance(i.id)}
              >
                <View style={styles.instanceInfo}>
                  <Text style={[styles.instanceName, { color: color.foreground }]}>
                    {i.name}
                  </Text>
                  <Text 
                    style={[styles.instanceUrl, { color: color.mutedForeground }]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {i.url}
                  </Text>
                </View>
                
                {instanceId === i.id && (
                  <View style={[styles.selectedIndicator, { backgroundColor: color.primary }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          
          <Button
            onPress={() => router.push('/instances/add')}
            variant="outline"
            size="sm"
            style={styles.addButton}
          >
            {t('instances.add')}
          </Button>
        </Card>

        {/* Token Input */}
        <Card style={styles.card}>
          <Text style={[styles.label, { color: color.foreground }]}>
            {t('auth.token')}
          </Text>
          
          <Input
            value={token}
            onChangeText={setToken}
            placeholder={t('auth.tokenPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={styles.tokenInput}
          />
          
          <Text style={[styles.tokenHint, { color: color.mutedForeground }]}>
            {t('home.getTokenFrom')}{' '}{' '}
            <Text style={{ color: color.primary }}>
              Notploy Dashboard → Settings → API Keys
            </Text>
          </Text>
        </Card>

        {/* Error Message */}
        {hasError && (
          <View style={[styles.errorContainer, { backgroundColor: color.error + '10' }]}>
            <Text style={[styles.errorText, { color: color.error }]}>
              {error || authError?.message}
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <Button
          onPress={handleLogin}
          disabled={!instanceId || !token.trim()}
          isLoading={isLoading}
          size="lg"
        >
          {t('auth.login')}
        </Button>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: color.mutedForeground }]}>
            {t('auth.noAccount')}{' '}
            <Text 
              style={[styles.footerLink, { color: color.primary }]}
              onPress={() => {
                // Open documentation link
              }}
            >
              {t('home.learnMore')}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  instanceList: {
    gap: 8,
    marginBottom: 12,
  },
  instanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  instanceItemSelected: {
    borderWidth: 2,
  },
  instanceInfo: {
    flex: 1,
  },
  instanceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  instanceUrl: {
    fontSize: 12,
  },
  selectedIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  addButton: {
    marginTop: 8,
  },
  tokenInput: {
    minHeight: 100,
  },
  tokenHint: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
