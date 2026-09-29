/* Ported from `apps/notploy/components/ui/skeleton.tsx`; `cn` path adapted. */

import type * as React from "react";

import { cn } from "@/renderer/lib/cn";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="skeleton"
			className={cn("animate-pulse rounded-md bg-muted", className)}
			{...props}
		/>
	);
}

export { Skeleton };
