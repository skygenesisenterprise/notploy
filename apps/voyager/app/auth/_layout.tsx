/**
 * Auth Layout
 *
 * Layout for authentication screens.
 */

import { Stack } from "expo-router";

/**
 * Auth layout component.
 */
export default function AuthLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="login"
				options={{
					title: "Login",
					headerShown: false,
				}}
			/>
		</Stack>
	);
}
