import type * as React from "react";
import { Card } from "@/components/ui/card";

/** Page shell shared by the three homepages: same frame, same density. */
export const HomeShell = ({ children }: { children: React.ReactNode }) => (
	<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
		<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
			{children}
		</div>
	</Card>
);
