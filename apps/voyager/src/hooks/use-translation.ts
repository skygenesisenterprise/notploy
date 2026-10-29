/**
 * Translation Hook for Notploy Voyager
 *
 * Provides translations for the application.
 * This is a placeholder for future i18n implementation.
 */

import { useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

/** Translation function */
export type TFunction = (key: string, options?: Record<string, string>) => string;

/** Translation dictionary */
interface TranslationDictionary {
	[key: string]: string | TranslationDictionary;
}

// ============================================================================
// English Translations
// ============================================================================

/** English translation dictionary */
const enTranslations: TranslationDictionary = {
	app: {
		name: "Notploy Voyager",
		loading: "Loading...",
		error: "Error",
		retry: "Retry",
		cancel: "Cancel",
		save: "Save",
		delete: "Delete",
		edit: "Edit",
		confirm: "Confirm",
		back: "Back",
	},
	auth: {
		login: "Login",
		logout: "Logout",
		email: "Email",
		password: "Password",
		token: "API Token",
		loginSuccess: "Logged in successfully",
		loginFailed: "Login failed",
		loggedOut: "Logged out",
		noAccount: "Don't have an account?",
		forgotPassword: "Forgot password?",
		or: "or",
	},
	home: {
		title: "Notploy",
		welcome: "Welcome to Notploy Voyager",
		subtitle: "Manage your Notploy instances from your mobile device",
		welcomeBack: "Welcome back",
		instanceStatus: "Instance Status",
		instanceName: "Instance Name",
		instanceUrl: "Instance URL",
		connectionStatus: "Connection Status",
		connected: "Connected",
		disconnected: "Disconnected",
		unavailable: "Unavailable",
		quickActions: "Quick Actions",
		viewProjects: "View Projects",
		viewDeployments: "View Deployments",
		viewServices: "View Services",
		recentDeployments: "Recent Deployments",
		noDeployments: "No deployments yet",
		noDeploymentsDescription: "Your deployments will appear here",
		alerts: "Alerts",
		noAlerts: "No alerts",
		noAlertsDescription: "Alerts will appear here when something needs your attention",
		loading: "Loading dashboard...",
		features: "Features",
		feature1Title: "Multi-Instance",
		feature1Description: "Manage multiple Notploy instances from one app",
		feature2Title: "Secure",
		feature2Description: "Your credentials are stored securely on your device",
		feature3Title: "Fast",
		feature3Description: "Quick access to your deployments and services",
		feature4Title: "Insights",
		feature4Description: "Monitor your infrastructure with ease",
	},
	tabs: {
		home: "Home",
		projects: "Projects",
		deployments: "Deployments",
		services: "Services",
		activity: "Activity",
	},
	instances: {
		title: "Instances",
		add: "Add Instance",
		addTitle: "Add Notploy Instance",
		name: "Instance Name",
		namePlaceholder: "My Notploy Instance",
		url: "Instance URL",
		urlPlaceholder: "https://notploy.example.com",
		urlError: "Please enter a valid URL",
		token: "API Token (optional)",
		tokenPlaceholder: "Enter your API token",
		saveInstance: "Save Instance",
		editInstance: "Edit Instance",
		deleteInstance: "Delete Instance",
		deleteConfirm: "Are you sure you want to delete this instance?",
		deleteWarning: "This will remove the instance and its credentials from your device.",
		noInstances: "No instances yet",
		noInstancesDescription: "Add an instance to get started",
		testConnection: "Test Connection",
		connectionSuccess: "Connection successful!",
		connectionFailed: "Connection failed",
		switchInstance: "Switch Instance",
		active: "Active",
		inactive: "Inactive",
	},
	errors: {
		network: "Network error",
		connection: "Connection error",
		authentication: "Authentication error",
		unauthorized: "Unauthorized",
		forbidden: "Forbidden",
		notFound: "Not found",
		server: "Server error",
		unknown: "Unknown error",
		tryAgain: "Please try again",
		checkConnection: "Please check your connection",
		checkCredentials: "Please check your credentials",
		noData: "No data available",
	},
};

// ============================================================================
// Translation Function
// ============================================================================

/**
 * Get translation from dictionary.
 */
function getTranslation(key: string): string {
	const parts = key.split(".");
	let current: TranslationDictionary | string = enTranslations;

	for (const part of parts) {
		if (typeof current === "string") {
			return current;
		}
		const value: string | TranslationDictionary | undefined = current[part];
		if (value === undefined) {
			return key;
		}
		current = value;
	}

	return typeof current === "string" ? current : key;
}

/**
 * Use translation hook.
 */
export function useTranslation(): TFunction {
	return useMemo(() => {
		return (key: string, options?: Record<string, string>) => {
			const translation = getTranslation(key);

			if (options) {
				let result = translation;
				for (const [placeholder, value] of Object.entries(options)) {
					const regex = new RegExp(`\\{${placeholder}\\}`, "g");
					result = result.replace(regex, value);
				}
				return result;
			}

			return translation;
		};
	}, []);
}

/**
 * Direct translation function (without hook).
 */
export function t(key: string, options?: Record<string, string>): string {
	const translation = getTranslation(key);

	if (options) {
		let result = translation;
		for (const [placeholder, value] of Object.entries(options)) {
			const regex = new RegExp(`\\{${placeholder}\\}`, "g");
			result = result.replace(regex, value);
		}
		return result;
	}

	return translation;
}

export type { TranslationDictionary };
