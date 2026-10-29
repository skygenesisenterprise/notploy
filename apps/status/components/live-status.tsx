"use client";

import type { PublicPageDto } from "@notploy/status";
import * as React from "react";
import { describeFreshness, formatRelativeTime } from "@/lib/view-model";
import { ComponentList } from "./component-list";
import { FreshnessNotice, StatusBanner } from "./status-banner";

interface LiveStatusProps {
	slug: string;
	initialPage: PublicPageDto;
	refreshIntervalSeconds: number;
}

/**
 * Live part of the public page: the global banner and the component list.
 *
 * The initial payload is server-rendered, then refreshed from the public API.
 * A failed refresh never downgrades the displayed state silently: the banner
 * keeps the last known status and the freshness notice explains that the data
 * may be outdated.
 */
export const LiveStatus = ({
	slug,
	initialPage,
	refreshIntervalSeconds,
}: LiveStatusProps) => {
	const [page, setPage] = React.useState(initialPage);
	const [connectionOk, setConnectionOk] = React.useState(true);
	const [now, setNow] = React.useState(() => Date.now());

	React.useEffect(() => {
		setPage(initialPage);
	}, [initialPage]);

	React.useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 30_000);
		return () => clearInterval(timer);
	}, []);

	React.useEffect(() => {
		if (refreshIntervalSeconds <= 0) {
			return;
		}
		const intervalMs = Math.max(refreshIntervalSeconds, 5) * 1000;
		let cancelled = false;
		const load = async () => {
			try {
				const response = await fetch(`/api/v1/pages/${slug}`, {
					cache: "no-store",
				});
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}`);
				}
				const next = (await response.json()) as PublicPageDto;
				if (cancelled) {
					return;
				}
				setPage(next);
				setConnectionOk(true);
				setNow(Date.now());
			} catch {
				if (!cancelled) {
					setConnectionOk(false);
				}
			}
		};
		const timer = setInterval(() => {
			void load();
		}, intervalMs);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [slug, refreshIntervalSeconds]);

	const freshness = describeFreshness({
		serverStale: page.stale,
		connectionOk,
		updatedAt: page.generatedAt,
		now,
	});

	return (
		<div className="flex flex-col gap-6">
			<StatusBanner
				status={page.status}
				updatedLabel={`Updated ${formatRelativeTime(page.generatedAt, now)}`}
			/>
			<FreshnessNotice freshness={freshness} />
			<ComponentList components={page.components} />
		</div>
	);
};
