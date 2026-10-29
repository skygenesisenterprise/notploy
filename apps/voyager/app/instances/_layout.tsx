/**
 * Instances Layout
 *
 * Layout for instance-related screens.
 */

import { Stack } from "expo-router";

/**
 * Instances layout component.
 */
export default function InstancesLayout() {
	return (
		<Stack>
			<Stack.Screen
				name="index"
				options={{
					title: "Instances",
				}}
			/>
			<Stack.Screen
				name="add"
				options={{
					title: "Add Instance",
				}}
			/>
			<Stack.Screen
				name="edit"
				options={{
					title: "Edit Instance",
				}}
			/>
		</Stack>
	);
}
