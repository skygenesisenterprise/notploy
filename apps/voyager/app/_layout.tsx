/**
 * Root Layout for Notploy Voyager
 * 
 * This file defines the root navigation structure using Expo Router.
 * It sets up the tab navigation and stack navigation for the app.
 */

import { Stack, Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { Text, View, StyleSheet } from 'react-native';

// Icons (placeholder - we'll use actual icons later)
import { useColor } from '@/hooks/use-color';

/**
 * Root layout component.
 * Defines the navigation structure for the app.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { theme } = useTheme();
  const color = useColor();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          height: 60,
          paddingBottom: 5,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      {/* Home Tab */}
      <Tabs.Screen
        name="(tabs)"
        options={{
          headerShown: false,
        }}
      />
      
      {/* Authentication Stack */}
      <Tabs.Screen
        name="auth"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Instances Stack */}
      <Tabs.Screen
        name="instances"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Projects Stack */}
      <Tabs.Screen
        name="projects"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Deployments Stack */}
      <Tabs.Screen
        name="deployments"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Services Stack */}
      <Tabs.Screen
        name="services"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Logs Stack */}
      <Tabs.Screen
        name="logs"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Monitoring Stack */}
      <Tabs.Screen
        name="monitoring"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Activity Stack */}
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      
      {/* Settings Stack */}
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
  },
  tabBarLabel: {
    fontSize: 12,
  },
});
