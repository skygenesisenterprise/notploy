/**
 * Projects Screen for Notploy Voyager
 * 
 * Displays the list of projects from the active Notploy instance.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColor } from '@/hooks/use-color';
import { useTranslation } from '@/hooks/use-translation';
import { useAuth } from '@/hooks/use-auth';
import { LoadingView } from '@/components/ui/loading-view';
import { ErrorView } from '@/components/ui/error-view';
import { EmptyView } from '@/components/ui/empty-view';
import { Card } from '@/components/ui/card';

// ============================================================================
// Component
// ============================================================================

/**
 * Projects screen component.
 */
export default function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const color = useColor();
  const t = useTranslation();
  
  const { authStatus, activeInstance, checkAuth } = useAuth();

  // State
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>();

  // Load projects
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setError(undefined);

        // Check if authenticated
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
          router.push('/auth/login');
          return;
        }

        // TODO: Fetch projects from API
        // For now, we'll use mock data
        setProjects([]);
      } catch (err) {
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [activeInstance]);

  // Handle refresh
  const onRefresh = async () => {
    // TODO: Refresh projects from API
  };

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
            {t('projects.title')}
          </Text>
          
          <Text style={[styles.subtitle, { color: color.mutedForeground }]}>
            {t('projects.noProjectsDescription')}
          </Text>
        </View>

        {/* Projects List */}
        <View style={styles.listContainer}>
          {projects.length > 0 ? (
            <>
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onPress={() => router.push(`/projects/${project.id}`)}
                />
              ))}
            </>
          ) : (
            <EmptyView
              icon="📁"
              message={t('projects.noProjects')}
              description={t('projects.noProjectsDescription')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Project Card Component
// ============================================================================

interface ProjectCardProps {
  project: any;
  onPress: () => void;
}

function ProjectCard({ project, onPress }: ProjectCardProps) {
  const color = useColor();

  return (
    <Card style={[styles.card, { borderColor: color.border }]}>
      <TouchableOpacity onPress={onPress} style={styles.cardContent}>
        <Text style={[styles.projectName, { color: color.foreground }]}>
          {project.name}
        </Text>
        
        <Text 
          style={[styles.projectDescription, { color: color.mutedForeground }]}
          numberOfLines={2}
        >
          {project.description || 'No description'}
        </Text>
        
        <View style={styles.projectMeta}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status, color) }]}>
            <Text style={styles.statusText}>
              {project.status}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getStatusColor(status: string, color: any) {
  switch (status?.toLowerCase()) {
    case 'running':
    case 'active':
      return color.success + '20';
    case 'stopped':
    case 'inactive':
      return color.mutedForeground + '20';
    case 'building':
    case 'deploying':
      return color.info + '20';
    case 'error':
      return color.error + '20';
    default:
      return color.border;
  }
}

// ============================================================================
// Import TouchableOpacity
// ============================================================================

import { TouchableOpacity } from 'react-native';

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
  listContainer: {
    flex: 1,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  cardContent: {
    padding: 16,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  projectDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  projectMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
