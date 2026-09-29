import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional class names, with Tailwind conflicts resolved.
 *
 * Same helper as the web dashboard, so a component moved between the two keeps
 * its class ordering behaviour.
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
