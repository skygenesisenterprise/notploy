/**
 * The Notploy mark, in the app.
 *
 * The SVG is the same file the icon generator writes and the packaging uses, so
 * there is exactly one definition of the product's identity. It is applied as a
 * mask rather than rendered as an image: that way the mark takes
 * `currentColor` and follows the surrounding text colour instead of shipping one
 * coloured variant per context.
 */

import markUrl from "@assets/notploy.svg";
import { cn } from "@/renderer/lib/cn";

export function BrandMark({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn("inline-block size-4 shrink-0 bg-current", className)}
			style={{
				maskImage: `url(${markUrl})`,
				WebkitMaskImage: `url(${markUrl})`,
				maskSize: "contain",
				WebkitMaskSize: "contain",
				maskRepeat: "no-repeat",
				WebkitMaskRepeat: "no-repeat",
				maskPosition: "center",
				WebkitMaskPosition: "center",
			}}
		/>
	);
}
