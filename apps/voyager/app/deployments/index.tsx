/**
 * Deployments Screen for Notploy Voyager
 *
 * Displays the list of deployments from the active Notploy instance.
 */

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "@/components/ui/card";
import { EmptyView } from "@/components/ui/empty-view";
import { ErrorView } from "@/components/ui/error-view";
import { LoadingView } from "@/components/ui/loading-view";
import { useAuth } from "@/hooks/use-auth";
import { useColor } from "@/hooks/use-color";
import { useTranslation } from "@/hooks/use-translation";

// ============================================================================
// Component
// ============================================================================

/**
 * Deployments screen component.
 */
export default function DeploymentsScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const color = useColor();
	const t = useTranslation();

	const { checkAuth } = useAuth();

	// State
	const [deployments, setDeployments] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | undefined>();

	// Load deployments
	useEffect(() => {
		const load = async () => {
			try {
				setIsLoading(true);
				setError(undefined);

				// Check if authenticated
				const isAuthenticated = await checkAuth();
				if (!isAuthenticated) {
					router.push("/auth/login");
					return;
				}

				// TODO: Fetch deployments from API
				// For now, we'll use mock data
				setDeployments([]);
			} catch (err) {
				setError(err as Error);
			} finally {
				setIsLoading(false);
			}
		};

		load();
	}, [router.push, checkAuth]);

	// Handle refresh
	const onRefresh = async () => {
		// TODO: Refresh deployments from API
	};

	if (isLoading) {
		return (
			<LoadingView
				message={t("home.loading")}
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
					<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={color.primary} />
				}
			>
				{/* Header */}
				<View style={styles.header}>
					<Text style={[styles.title, { color: color.foreground }]}>{t("deployments.title")}</Text>

					<Text style={[styles.subtitle, { color: color.mutedForeground }]}>
						{t("deployments.noDeploymentsDescription")}
					</Text>
				</View>

				{/* Deployments List */}
				<View style={styles.listContainer}>
					{deployments.length > 0 ? (
						deployments.map((deployment) => (
							<DeploymentCard
								key={deployment.id}
								deployment={deployment}
								onPress={() => router.push(`/deployments/${deployment.id}`)}
							/>
						))
					) : (
						<EmptyView
							icon="🚀"
							message={t("deployments.noDeployments")}
							description={t("deployments.noDeploymentsDescription")}
						/>
					)}
				</View>
			</ScrollView>
		</View>
	);
}

// ============================================================================
// Deployment Card Component
// ============================================================================

interface DeploymentCardProps {
	deployment: any;
	onPress: () => void;
}

function DeploymentCard({ deployment, onPress }: DeploymentCardProps) {
	const color = useColor();
	const t = useTranslation();

	return (
		<Card style={[styles.card, { borderColor: color.border }]}>
			<TouchableOpacity onPress={onPress} style={styles.cardContent}>
				<View style={styles.deploymentHeader}>
					<Text style={[styles.deploymentName, { color: color.foreground }]}>
						{deployment.projectName || deployment.name}
					</Text>

					<View
						style={[
							styles.statusBadge,
							{ backgroundColor: getStatusColor(deployment.status, color) },
						]}
					>
						<Text style={styles.statusText}>
							{t(`deployments.${deployment.status?.toLowerCase() || "unknown"}`)}
						</Text>
					</View>
				</View>

				<Text style={[styles.deploymentInfo, { color: color.mutedForeground }]} numberOfLines={1}>
					{deployment.commitMessage || deployment.trigger || "No details"}
				</Text>

				<View style={styles.deploymentMeta}>
					<Text style={[styles.metaText, { color: color.mutedForeground }]}>
						{deployment.startedAt ? new Date(deployment.startedAt).toLocaleString() : ""}
					</Text>

					{deployment.duration && (
						<Text style={[styles.metaText, { color: color.mutedForeground }]}>
							{formatDuration(deployment.duration)}
						</Text>
					)}
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
		case "running":
		case "completed":
		case "successful":
			return `${color.success}20`;
		case "failed":
			return `${color.error}20`;
		case "building":
		case "deploying":
		case "inprogress":
		case "in_progress":
			return `${color.info}20`;
		case "cancelled":
			return `${color.warning}20`;
		default:
			return color.border;
	}
}

function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${seconds}s`;
	}
	if (seconds < 3600) {
		return `${Math.floor(seconds / 60)}m`;
	}
	return `${Math.floor(seconds / 3600)}h`;
}

// ============================================================================
// Import TouchableOpacity
// ============================================================================

import { TouchableOpacity } from "react-native";

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
		fontWeight: "bold",
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
	deploymentHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		marginBottom: 8,
	},
	deploymentName: {
		fontSize: 16,
		fontWeight: "600",
	},
	deploymentInfo: {
		fontSize: 14,
		marginBottom: 12,
		lineHeight: 20,
	},
	deploymentMeta: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: 8,
	},
	metaText: {
		fontSize: 12,
	},
	statusBadge: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
	},
	statusText: {
		fontSize: 12,
		fontWeight: "500",
	},
});
