/**
 * Instances List Screen for Notploy Voyager
 * 
 * Shows the list of configured Notploy instances and allows managing them.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColor } from '@/hooks/use-color';
import { useTranslation } from '@/hooks/use-translation';
import { useInstances } from '@/hooks/use-instances';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingView } from '@/components/ui/loading-view';
import { ErrorView } from '@/components/ui/error-view';
import { EmptyView } from '@/components/ui/empty-view';

// ============================================================================
// Component
// ============================================================================

/**
 * Instances list screen component.
 */
export default function InstancesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const color = useColor();
  const t = useTranslation();
  
  const {
    instances,
    activeInstance,
    isLoading,
    error,
    refresh,
    setActiveInstance,
    removeInstance,
  } = useInstances();
  
  const { authStatus, switchInstance } = useAuth();

  // Handle refresh
  const onRefresh = async () => {
    await refresh();
  };

  // Handle switch instance
  const handleSwitch = async (id: string) => {
    await setActiveInstance(id);
    await switchInstance(id);
  };

  // Handle delete instance
  const handleDelete = async (id: string) => {
    // For now, just remove the instance
    // In production, we'd show a confirmation dialog
    await removeInstance(id);
  };

  // Render instance item
  const renderInstance = ({ item }: { item: any }) => (
    <Card style={[styles.instanceCard, { borderColor: color.border }]}>
      <TouchableOpacity
        style={styles.instanceTouchArea}
        onPress={() => handleSwitch(item.id)}
      >
        <View style={styles.instanceInfo}>
          <View style={styles.instanceDetails}>
            <Text style={[styles.instanceName, { color: color.foreground }]}>
              {item.name}
            </Text>
            
            <Text 
              style={[styles.instanceUrl, { color: color.mutedForeground }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {item.url}
            </Text>
            
            <View style={styles.instanceMeta}>
              {item.active && (
                <View style={[styles.badge, { backgroundColor: color.primary + '20' }]}>
                  <Text style={[styles.badgeText, { color: color.primary }]}>
                    {t('instances.active')}
                  </Text>
                </View>
              )}
              
              {item.hasCredential && (
                <View style={[styles.badge, { backgroundColor: color.success + '20' }]}>
                  <Text style={[styles.badgeText, { color: color.success }]}>
                    Authenticated
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {activeInstance?.id === item.id && (
            <View style={[styles.activeIndicator, { backgroundColor: color.primary }]} />
          )}
        </View>
      </TouchableOpacity>
      
      <View style={styles.instanceActions}>
        <Button
          onPress={() => router.push(`/instances/edit?id=${item.id}`)}
          variant="ghost"
          size="sm"
        >
          {t('app.edit')}
        </Button>
        
        <Button
          onPress={() => handleDelete(item.id)}
          variant="ghost"
          size="sm"
          style={{ color: color.error }}
        >
          {t('app.delete')}
        </Button>
      </View>
    </Card>
  );

  if (isLoading) {
    return (
      <LoadingView
        message={t('home.loading')}
        style={[styles.container, { paddingTop: insets.top }]}
      />
    );
  }

  if (error) {
    return (
      <ErrorView
        message={error.message}
        onRetry={onRefresh}
        style={[styles.container, { paddingTop: insets.top }]}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={color.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: color.foreground }]}>
            {t('instances.title')}
          </Text>
          
          <Text style={[styles.subtitle, { color: color.mutedForeground }]}>
            {t('instances.manageInstances')}
          </Text>
        </View>

        {/* Add Instance Button */}
        <Button
          onPress={() => router.push('/instances/add')}
          size="lg"
          style={styles.addButton}
        >
          {t('instances.add')}
        </Button>

        {/* Instances List */}
        <View style={styles.listContainer}>
          {instances.length > 0 ? (
            <FlatList
              data={instances}
              renderItem={renderInstance}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <EmptyView
              icon="🌐"
              message={t('instances.noInstances')}
              description={t('instances.noInstancesDescription')}
              showAction
              onAction={() => router.push('/instances/add')}
            />
          )}
        </View>
      </ScrollView>
    </View>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  addButton: {
    marginBottom: 20,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    gap: 12,
  },
  instanceCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  instanceTouchArea: {
    flex: 1,
  },
  instanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  instanceDetails: {
    flex: 1,
  },
  instanceName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  instanceUrl: {
    fontSize: 12,
    marginBottom: 8,
  },
  instanceMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 12,
  },
  instanceActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
