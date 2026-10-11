/**
 * Tabs Layout for Notploy Voyager
 * 
 * This file defines the tab navigation structure at the bottom of the screen.
 * It provides access to the main sections of the app.
 */

import { Tabs } from 'expo-router';
import { useColor } from '@/hooks/use-color';
import { Text, View, StyleSheet } from 'react-native';
import { useTranslation } from '@/hooks/use-translation';

// Tab icons - using simple text placeholders for now
// In production, we'd use proper icon components
function HomeIcon({ focused }: { focused: boolean }) {
  const color = useColor();
  return (
    <Text style={{ color: focused ? color.primary : color.mutedForeground, fontSize: 20 }}>
      🏠
    </Text>
  );
}

function ProjectsIcon({ focused }: { focused: boolean }) {
  const color = useColor();
  return (
    <Text style={{ color: focused ? color.primary : color.mutedForeground, fontSize: 20 }}>
      📁
    </Text>
  );
}

function DeploymentsIcon({ focused }: { focused: boolean }) {
  const color = useColor();
  return (
    <Text style={{ color: focused ? color.primary : color.mutedForeground, fontSize: 20 }}>
      🚀
    </Text>
  );
}

function ServicesIcon({ focused }: { focused: boolean }) {
  const color = useColor();
  return (
    <Text style={{ color: focused ? color.primary : color.mutedForeground, fontSize: 20 }}>
      🧩
    </Text>
  );
}

function AlertsIcon({ focused }: { focused: boolean }) {
  const color = useColor();
  return (
    <Text style={{ color: focused ? color.primary : color.mutedForeground, fontSize: 20 }}>
      🔔
    </Text>
  );
}

function SettingsIcon({ focused }: { focused: boolean }) {
  const color = useColor();
  return (
    <Text style={{ color: focused ? color.primary : color.mutedForeground, fontSize: 20 }}>
      ⚙️
    </Text>
  );
}

/**
 * Tabs layout component.
 * Defines the bottom tab navigation.
 */
export default function TabsLayout() {
  const color = useColor();
  const t = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: HomeIcon,
        }}
      />

      {/* Projects Tab */}
      <Tabs.Screen
        name="projects"
        options={{
          title: t('tabs.projects'),
          tabBarIcon: ProjectsIcon,
        }}
      />

      {/* Deployments Tab */}
      <Tabs.Screen
        name="deployments"
        options={{
          title: t('tabs.deployments'),
          tabBarIcon: DeploymentsIcon,
        }}
      />

      {/* Services Tab */}
      <Tabs.Screen
        name="services"
        options={{
          title: t('tabs.services'),
          tabBarIcon: ServicesIcon,
        }}
      />

      {/* Activity/Alerts Tab */}
      <Tabs.Screen
        name="activity"
        options={{
          title: t('tabs.activity'),
          tabBarIcon: AlertsIcon,
        }}
      />
    </Tabs>
  );
}
