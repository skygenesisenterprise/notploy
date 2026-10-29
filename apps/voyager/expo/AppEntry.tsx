/**
 * Notploy Voyager - App Entry Point
 *
 * This is the main entry point for the Expo application.
 * It wraps the root component with providers and handles initialization.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppProvider } from "@/providers/app-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { InstancesProvider } from "@/providers/instances-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import RootLayout from "../app/_layout";

// Create a QueryClient instance
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000, // 5 minutes
		},
	},
});

/**
 * Main application component.
 * Wraps the entire app with all necessary providers.
 */
export default function App() {
	return (
		<SafeAreaProvider>
			<GestureHandlerRootView style={styles.container}>
				<QueryClientProvider client={queryClient}>
					<ThemeProvider>
						<AppProvider>
							<InstancesProvider>
								<AuthProvider>
									<StatusBar style="auto" />
									<RootLayout />
									{/* React Query Devtools - only in development */}
									{__DEV__ && <ReactQueryDevtools initialIsOpen={false} />}
								</AuthProvider>
							</InstancesProvider>
						</AppProvider>
					</ThemeProvider>
				</QueryClientProvider>
			</GestureHandlerRootView>
		</SafeAreaProvider>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
});
