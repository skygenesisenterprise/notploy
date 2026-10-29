/**
 * Add Instance Screen for Notploy Voyager
 *
 * Allows users to add a new Notploy instance.
 */

import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingView } from "@/components/ui/loading-view";
import { useColor } from "@/hooks/use-color";
import { useInstances } from "@/hooks/use-instances";
import { useTranslation } from "@/hooks/use-translation";
import { validateInstanceUrl } from "@/lib/sdk-client";

// ============================================================================
// Component
// ============================================================================

/**
 * Add instance screen component.
 */
export default function AddInstanceScreen() {
	const insets = useSafeAreaInsets();
	const router = useRouter();
	const color = useColor();
	const t = useTranslation();

	const { addInstance, isLoading: instancesLoading } = useInstances();

	// Form state
	const [name, setName] = useState("");
	const [url, setUrl] = useState("");
	const [apiToken, setApiToken] = useState("");
	const [allowInsecureTls, setAllowInsecureTls] = useState(false);

	// Validation state
	const [nameError, setNameError] = useState<string | undefined>();
	const [urlError, setUrlError] = useState<string | undefined>();

	// Loading state
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | undefined>();

	// Validate form
	const validate = (): boolean => {
		let valid = true;

		if (!name.trim()) {
			setNameError("Instance name is required");
			valid = false;
		} else {
			setNameError(undefined);
		}

		const urlValidation = validateInstanceUrl(url);
		if (!urlValidation.valid) {
			setUrlError(urlValidation.error || "Invalid URL");
			valid = false;
		} else {
			setUrlError(undefined);
		}

		return valid;
	};

	// Handle submit
	const handleSubmit = async () => {
		if (!validate()) return;

		try {
			setIsLoading(true);
			setError(undefined);

			await addInstance({
				name: name.trim(),
				url,
				apiKey: apiToken.trim() || undefined,
				kind: "self-hosted",
				allowInsecureTls,
			});

			// Navigate back
			router.back();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add instance");
		} finally {
			setIsLoading(false);
		}
	};

	// Combined loading state
	const loading = isLoading || instancesLoading;

	if (loading) {
		return (
			<LoadingView
				message={t("instances.add")}
				style={[styles.container, { paddingTop: insets.top }]}
			/>
		);
	}

	return (
		<KeyboardAvoidingView
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			style={[styles.container, { paddingTop: insets.top }]}
		>
			<ScrollView
				contentContainerStyle={styles.scrollContainer}
				keyboardShouldPersistTaps="handled"
			>
				{/* Header */}
				<View style={styles.header}>
					<Text style={[styles.title, { color: color.foreground }]}>{t("instances.addTitle")}</Text>

					<Text style={[styles.subtitle, { color: color.mutedForeground }]}>
						{t("instances.addDescription")}
					</Text>
				</View>

				{/* Form */}
				<Card style={styles.card}>
					{/* Name Field */}
					<Input
						label={t("instances.name")}
						value={name}
						onChangeText={setName}
						placeholder={t("instances.namePlaceholder")}
						error={!!nameError}
						errorMessage={nameError}
						autoCapitalize="words"
						autoCorrect={false}
					/>

					{/* URL Field */}
					<Input
						label={t("instances.url")}
						value={url}
						onChangeText={setUrl}
						placeholder={t("instances.urlPlaceholder")}
						error={!!urlError}
						errorMessage={urlError}
						autoCapitalize="none"
						autoCorrect={false}
						keyboardType="url"
					/>

					{/* API Token Field */}
					<Input
						label={t("instances.token")}
						value={apiToken}
						onChangeText={setApiToken}
						placeholder={t("instances.tokenPlaceholder")}
						secureTextEntry
						autoCapitalize="none"
						autoCorrect={false}
						multiline
						numberOfLines={3}
						textAlignVertical="top"
					/>

					{/* TLS Option */}
					<View style={styles.option}>
						<TouchableCheckbox
							value={allowInsecureTls}
							onValueChange={setAllowInsecureTls}
							label={t("instances.allowInsecureTls")}
						/>

						<Text style={[styles.optionDescription, { color: color.mutedForeground }]}>
							{t("instances.insecureTlsWarning")}
						</Text>
					</View>
				</Card>

				{/* Error Message */}
				{error && (
					<View style={[styles.errorContainer, { backgroundColor: `${color.error}10` }]}>
						<Text style={[styles.errorText, { color: color.error }]}>{error}</Text>
					</View>
				)}

				{/* Submit Button */}
				<Button
					onPress={handleSubmit}
					disabled={!name.trim() || !!urlError}
					isLoading={isLoading}
					size="lg"
				>
					{t("instances.saveInstance")}
				</Button>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

// ============================================================================
// Touchable Checkbox Component
// ============================================================================

interface TouchableCheckboxProps {
	value: boolean;
	onValueChange: (value: boolean) => void;
	label: string;
}

function TouchableCheckbox({ value, onValueChange, label }: TouchableCheckboxProps) {
	const color = useColor();

	return (
		<TouchableOpacity
			style={[styles.checkboxContainer, { borderColor: color.border }]}
			onPress={() => onValueChange(!value)}
			activeOpacity={0.7}
		>
			<View style={[styles.checkbox, value && { backgroundColor: color.primary }]}>
				{value && <Text style={styles.checkboxIcon}>✓</Text>}
			</View>

			<Text style={[styles.checkboxLabel, { color: color.foreground }]}>{label}</Text>
		</TouchableOpacity>
	);
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
		marginBottom: 32,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
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
	checkboxContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		padding: 8,
	},
	checkbox: {
		width: 20,
		height: 20,
		borderRadius: 4,
		borderWidth: StyleSheet.hairlineWidth,
		alignItems: "center",
		justifyContent: "center",
	},
	checkboxIcon: {
		color: "white",
		fontSize: 12,
		fontWeight: "bold",
	},
	checkboxLabel: {
		fontSize: 14,
	},
});
