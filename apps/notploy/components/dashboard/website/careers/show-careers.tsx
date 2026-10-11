import { Briefcase, Loader2 } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Job } from "@/lib/ghost";
import { useDebounce } from "@/utils/hooks/use-debounce";
import { SearchAndFilter } from "../blog/search-and-filter";
import { HandleJob } from "./handle-job";
import { JobCard } from "./job-card";

interface ShowCareersProps {
	jobs: Job[];
	isPending?: boolean;
}

export const ShowCareers = ({ jobs, isPending }: ShowCareersProps) => {
	const router = useRouter();
	const routerRef = useRef(router);
	routerRef.current = router;

	const [search, setSearch] = useState(
		typeof router.query.search === "string" ? router.query.search : "",
	);
	const [selectedLocation, setSelectedLocation] = useState(
		typeof router.query.location === "string" ? router.query.location : "",
	);

	const debouncedSearch = useDebounce(search, 300);

	const locations = useMemo(() => {
		const unique = new Map<
			string,
			{ id: string; name: string; slug: string }
		>();
		for (const job of jobs) {
			if (job.region && !unique.has(job.region)) {
				unique.set(job.region, {
					id: job.region,
					name: job.region,
					slug: job.region,
				});
			}
		}
		return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
	}, [jobs]);

	// Reflect the filters in the URL. Deliberately keyed on the filter values
	// only: `router` changes identity mid-navigation, and reacting to that here
	// would fire a shallow replace that cancels the route change.
	useEffect(() => {
		const activeRouter = routerRef.current;
		if (!activeRouter.isReady) return;
		const currentSearch =
			typeof activeRouter.query.search === "string"
				? activeRouter.query.search
				: "";
		const currentLocation =
			typeof activeRouter.query.location === "string"
				? activeRouter.query.location
				: "";
		if (
			currentSearch === debouncedSearch &&
			currentLocation === selectedLocation
		) {
			return;
		}

		const query = { ...activeRouter.query };
		if (debouncedSearch) {
			query.search = debouncedSearch;
		} else {
			delete query.search;
		}
		if (selectedLocation) {
			query.location = selectedLocation;
		} else {
			delete query.location;
		}
		activeRouter.replace({ query }, undefined, { shallow: true });
	}, [debouncedSearch, selectedLocation]);

	const filteredJobs = useMemo(() => {
		const query = debouncedSearch.trim().toLowerCase();
		return jobs.filter((job) => {
			const matchesSearch =
				query === "" ||
				job.title.toLowerCase().includes(query) ||
				job.description.toLowerCase().includes(query);
			const matchesLocation =
				selectedLocation === "" || job.region === selectedLocation;
			return matchesSearch && matchesLocation;
		});
	}, [jobs, debouncedSearch, selectedLocation]);

	return (
		<div className="w-full">
			<Card className="h-full bg-sidebar p-2.5 rounded-xl w-full min-h-[45vh]">
				<div className="rounded-xl bg-background shadow-md h-full">
					<CardHeader>
						<CardTitle className="text-xl flex flex-row gap-2">
							<Briefcase className="size-6 text-muted-foreground self-center" />
							Careers
						</CardTitle>
						<CardDescription>
							Open positions published on the Notploy website
						</CardDescription>
						<CardAction>
							<HandleJob />
						</CardAction>
					</CardHeader>
					<CardContent className="space-y-2 py-8 border-t">
						{isPending ? (
							<div className="flex flex-row gap-2 items-center justify-center text-sm text-muted-foreground min-h-[25vh]">
								<span>Loading...</span>
								<Loader2 className="animate-spin size-4" />
							</div>
						) : (
							<>
								<SearchAndFilter
									tags={locations}
									search={search}
									selectedTag={selectedLocation}
									onSearchChange={setSearch}
									onTagChange={setSelectedLocation}
									searchPlaceholder="Search positions..."
									allTagsText="All locations"
								/>
								{filteredJobs.length === 0 ? (
									<div className="flex min-h-[20vh] items-center justify-center py-12 text-center">
										<p className="text-xl text-muted-foreground">
											{search || selectedLocation
												? "No positions found matching your criteria"
												: "No open positions at the moment. Check back soon."}
										</p>
									</div>
								) : (
									<div className="flex flex-col gap-4">
										{filteredJobs.map((job) => (
											<JobCard key={job.id} job={job} />
										))}
									</div>
								)}
							</>
						)}
					</CardContent>
				</div>
			</Card>
		</div>
	);
};
