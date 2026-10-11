import { productBrandName } from "@/lib/product";
import { api } from "@/utils/api";
import {
	useWhitelabeling,
	useWhitelabelingPublic,
} from "@/utils/hooks/use-whitelabeling";

/**
 * Branded application name of the current environment.
 *
 * A whitelabel app name wins when set; otherwise the product decides — so the
 * three environments read "Notploy", "Notploy Cloud" and "Notploy Console".
 * Used for the browser tab, page titles and branded surfaces.
 */
export function useAppName(): string {
	const { config } = useWhitelabeling();
	const { data: product } = api.settings.getProduct.useQuery();
	return config?.appName || productBrandName(product);
}

/** Same as {@link useAppName}, for unauthenticated pages (error, reset, login…). */
export function useAppNamePublic(): string {
	const { config } = useWhitelabelingPublic();
	const { data: product } = api.settings.getProduct.useQuery();
	return config?.appName || productBrandName(product);
}
