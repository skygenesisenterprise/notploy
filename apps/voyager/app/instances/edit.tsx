/**
 * Edit Instance Screen for Notploy Voyager
 * 
 * Allows users to edit an existing Notploy instance.
 */

import React, { useState, useEffect } from 'react';
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
import { useInstances } from '@/hooks/use-instances';
import { validateInstanceUrl } from '@/lib/sdk-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LoadingView } from '@/components/ui/loading-view';
import { ErrorView } from '@/components/ui/error-view';

// ============================================================================
// Component
// ============================================================================

/**
 * Edit instance screen component.
 */
export default function EditInstanceScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const color = useColor();
  const t = useTranslation();
  
  const { getInstance, updateInstance, isLoading: instancesLoading } = useInstances();

  // Form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [allowInsecureTls, setAllowInsecureTls] = useState(false);
  
  // Validation state
  const [nameError, setNameError] = useState<string | undefined>();
  const [urlError, setUrlError] = useState<string | undefined>();
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  // Instance state
  const [instance, setInstance] = useState<any | null>(null);

  // Load instance on mount
  useEffect(() => {
    const load = async () => {
      try {
        if (!params.id) return;

        setIsLoading(true);
        const inst = await getInstance(params.id);
        
        if (inst) {
          setInstance(inst);
          setName(inst.name);
          setUrl(inst.url);
          setAllowInsecureTls(inst.allowInsecureTls || false);
        } else {
          setError('Instance not found');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load instance');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [params.id]);

  // Validate form
  const validate = (): boolean => {
    let valid = true;

    if (!name.trim()) {
      setNameError('Instance name is required');
      valid = false;
    } else {
      setNameError(undefined);
    }

    const urlValidation = validateInstanceUrl(url);
    if (!urlValidation.valid) {
      setUrlError(urlValidation.error || 'Invalid URL');
      valid = false;
    } else {
      setUrlError(undefined);
    }

    return valid;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validate() || !params.id) return;

    try {
      setIsLoading(true);
      setError(undefined);

      await updateInstance(params.id, {
        name: name.trim(),
        url,
        apiKey: apiToken.trim() || null,
        allowInsecureTls,
      });

      // Navigate back
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update instance');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    // For now, just navigate back
    // In production, we'd show a confirmation dialog
    router.back();
  };

  // Combined loading state
  const loading = isLoading || instancesLoading;

  if (loading) {
    return (
      <LoadingView
        message={t('app.loading')}
        style={[styles.container, { paddingTop: insets.top }]}
      />
    );
  }

  if (!instance) {
    return (
      <ErrorView
        message={t('errors.notFound')}
        description={t('instances.instanceNotFound')}
        onRetry={() => router.back()}
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
            {t('instances.editInstance')}
          </Text>
          
          <Text style={[styles.subtitle, { color: color.mutedForeground }]}>
            {instance.name}
          </Text>
        </View>

        {/* Form */}
        <Card style={styles.card}>
          {/* Name Field */}
          <Input
            label={t('instances.name')}
            value={name}
            onChangeText={setName}
            placeholder={t('instances.namePlaceholder')}
            error={!!nameError}
            errorMessage={nameError}
            autoCapitalize="words"
            autoCorrect={false}
          />

          {/* URL Field */}
          <Input
            label={t('instances.url')}
            value={url}
            onChangeText={setUrl}
            placeholder={t('instances.urlPlaceholder')}
            error={!!urlError}
            errorMessage={urlError}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          {/* API Token Field */}
          <Input
            label={t('instances.token')}
            value={apiToken}
            onChangeText={setApiToken}
            placeholder={t('instances.tokenPlaceholder')}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* TLS Option */}
          <View style={styles.option}>
            <TouchableOpacity
              style={[styles.checkboxContainer, { borderColor: color.border }]}
              onPress={() => setAllowInsecureTls(!allowInsecureTls)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, allowInsecureTls && { backgroundColor: color.primary }]}>
                {allowInsecureTls && (
                  <Text style={styles.checkboxIcon}>✓</Text>
                )}
              </View>
              
              <Text style={[styles.checkboxLabel, { color: color.foreground }]}>
                {t('instances.allowInsecureTls')}
              </Text>
            </TouchableOpacity>
            
            <Text style={[styles.optionDescription, { color: color.mutedForeground }]}>
              {t('instances.insecureTlsWarning')}
            </Text>
          </View>
        </Card>

        {/* Error Message */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: color.error + '10' }]}>
            <Text style={[styles.errorText, { color: color.error }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <Button
            onPress={handleDelete}
            variant="outline"
            size="md"
            style={[styles.deleteButton, { borderColor: color.error }]}
          >
            <Text style={{ color: color.error }}>{t('app.delete')}</Text>
          </Button>

          <Button
            onPress={handleSubmit}
            disabled={!name.trim() || !!urlError}
            isLoading={isLoading}
            size="lg"
          >
            {t('app.save')}
          </Button>
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  card: {
    marginBottom: 20,
  },
  option: {
    marginTop: 12,
    gap: 4,
  },
  optionDescription: {
    fontSize: 12,
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
  buttonsContainer: {
    gap: 12,
  },
  deleteButton: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxIcon: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
  },
});
