"use client";

import * as React from "react";
import { formatDateTime, formatRelativeTime } from "@/lib/view-model";

interface RelativeTimeProps {
	iso: string;
}

/**
 * Renders an absolute timestamp on the server (so SSR and hydration agree),
 * then switches to a self-updating relative label once mounted.
 */
export const RelativeTime = ({ iso }: RelativeTimeProps) => {
	const [mounted, setMounted] = React.useState(false);
	const [now, setNow] = React.useState(() => Date.now());

	React.useEffect(() => {
		setMounted(true);
		const timer = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(timer);
	}, []);

	return (
		<time dateTime={iso} title={formatDateTime(iso)}>
			{mounted ? formatRelativeTime(iso, now) : formatDateTime(iso)}
		</time>
	);
};
