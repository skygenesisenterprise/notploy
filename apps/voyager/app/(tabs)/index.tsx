/**
 * Home Screen for Notploy Voyager
 * 
 * This is the main dashboard screen that shows an overview of:
 * - Connected instances
 * - Recent deployments
 * - Alerts
 * - Quick actions
 */

import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColor } from '@/hooks/use-color';
import { useTranslation } from '@/hooks/use-translation';
import { useInstances } from '@/hooks/use-instances';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingView } from '@/components/ui/loading-view';
import { ErrorView } from '@/components/ui/error-view';
import { EmptyView } from '@/components/ui/empty-view';
import { useRouter } from 'expo-router';

/**
 * Home screen component.
 */
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const color = useColor();
  const t = useTranslation();
  const router = useRouter();
  
  const { instances, isLoading, error, refresh } = useInstances();
  const { authStatus, activeInstance } = useAuth();

  const isAuthenticated = authStatus === 'authenticated';
  const isUnauthenticated = authStatus === 'unauthenticated';

  const onRefresh = async () => {
    await refresh();
  };

  if (isUnauthenticated) {
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
          <Text style={[styles.title, { color: color.foreground }]}>
            {t('home.welcome')}
          </Text>
          
          <Text style={[styles.subtitle, { color: color.mutedForeground }]}>
            {t('home.subtitle')}
          </Text>

          <View style={styles.actionsContainer}>
            <Button
              onPress={() => router.push('/auth/login')}
              size="lg"
            >
              {t('auth.login')}
            </Button>
          </View>

          <View style={styles.featuresContainer}>
            <Text style={[styles.sectionTitle, { color: color.foreground }]}>
              {t('home.features')}
            </Text>
            
            <View style={styles.featuresGrid}>
              <Card style={styles.featureCard}>
                <Text style={{ fontSize: 24 }}>📱</Text>
                <Text style={[styles.featureTitle, { color: color.foreground }]}>
                  {t('home.feature1Title')}
                </Text>
                <Text style={[styles.featureDescription, { color: color.mutedForeground }]}>
                  {t('home.feature1Description')}
                </Text>
              </Card>

              <Card style={styles.featureCard}>
                <Text style={{ fontSize: 24 }}>🔒</Text>
                <Text style={[styles.featureTitle, { color: color.foreground }]}>
                  {t('home.feature2Title')}
                </Text>
                <Text style={[styles.featureDescription, { color: color.mutedForeground }]}>
                  {t('home.feature2Description')}
                </Text>
              </Card>

              <Card style={styles.featureCard}>
                <Text style={{ fontSize: 24 }}>⚡</Text>
                <Text style={[styles.featureTitle, { color: color.foreground }]}>
                  {t('home.feature3Title')}
                </Text>
                <Text style={[styles.featureDescription, { color: color.mutedForeground }]}>
                  {t('home.feature3Description')}
                </Text>
              </Card>

              <Card style={styles.featureCard}>
                <Text style={{ fontSize: 24 }}>📊</Text>
                <Text style={[styles.featureTitle, { color: color.foreground }]}>
                  {t('home.feature4Title')}
                </Text>
                <Text style={[styles.featureDescription, { color: color.mutedForeground }]}>
                  {t('home.feature4Description')}
                </Text>
              </Card>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

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
            {activeInstance?.name || t('home.title')}
          </Text>
          
          <Text style={[styles.subtitle, { color: color.mutedForeground }]}>
            {t('home.welcomeBack')}
          </Text>
        </View>

        {/* Instance Status */}
        {activeInstance && (
          <Card style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: color.foreground }]}>
              {t('home.instanceStatus')}
            </Text>
            
            <View style={styles.instanceInfo}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: color.mutedForeground }]}>
                  {t('home.instanceName')}
                </Text>
                <Text style={[styles.infoValue, { color: color.foreground }]}>
                  {activeInstance.name}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: color.mutedForeground }]}>
                  {t('home.instanceUrl')}
                </Text>
                <Text 
                  style={[styles.infoValue, { color: color.foreground }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {activeInstance.url}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: color.mutedForeground }]}>
                  {t('home.connectionStatus')}
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: color.success }]}>
                  <Text style={styles.statusText}>{t('home.connected')}</Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Quick Actions */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: color.foreground }]}>
            {t('home.quickActions')}
          </Text>
          
          <View style={styles.actionsContainer}>
            <Button
              onPress={() => router.push('/projects')}
              variant="outline"
              size="sm"
            >
              {t('home.viewProjects')}
            </Button>
            
            <Button
              onPress={() => router.push('/deployments')}
              variant="outline"
              size="sm"
            >
              {t('home.viewDeployments')}
            </Button>
            
            <Button
              onPress={() => router.push('/services')}
              variant="outline"
              size="sm"
            >
              {t('home.viewServices')}
            </Button>
          </View>
        </Card>

        {/* Recent Deployments */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: color.foreground }]}>
            {t('home.recentDeployments')}
          </Text>
          
          <EmptyView
            message={t('home.noDeployments')}
            description={t('home.noDeploymentsDescription')}
          />
        </Card>

        {/* Alerts */}
        <Card style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: color.foreground }]}>
            {t('home.alerts')}
          </Text>
          
          <EmptyView
            message={t('home.noAlerts')}
            description={t('home.noAlertsDescription')}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionCard: {
    marginBottom: 16,
  },
  instanceInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
  },
  infoValue: {
    flex: 2,
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featuresContainer: {
    marginTop: 32,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    flex: 1,
    minWidth: '48%',
    padding: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  featureDescription: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
});
