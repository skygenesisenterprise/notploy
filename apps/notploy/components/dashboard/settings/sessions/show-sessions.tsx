import { format } from "date-fns";
import {
	Activity,
	CalendarClock,
	Clock3,
	Eye,
	Globe2,
	LogOut,
	Monitor,
	RefreshCw,
	Search,
	ShieldCheck,
	Smartphone,
	UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DialogAction } from "@/components/shared/dialog-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api, type RouterOutputs } from "@/utils/api";

type Session = RouterOutputs["user"]["listSessions"][number];

type ClientInfo = {
	browser: string;
	operatingSystem: string;
};

function getClientInfo(userAgent: string | null): ClientInfo {
	if (!userAgent) {
		return { browser: "Not reported", operatingSystem: "Not reported" };
	}

	let browser = "Unknown browser";
	if (/Edg\//.test(userAgent)) browser = "Microsoft Edge";
	else if (/OPR\//.test(userAgent)) browser = "Opera";
	else if (/Firefox\//.test(userAgent)) browser = "Firefox";
	else if (/CriOS\//.test(userAgent)) browser = "Chrome";
	else if (/Chrome\//.test(userAgent)) browser = "Chrome";
	else if (/Safari\//.test(userAgent)) browser = "Safari";
	else if (/curl\//i.test(userAgent)) browser = "curl";
	else if (/wget\//i.test(userAgent)) browser = "wget";

	let operatingSystem = "Unknown operating system";
	if (/Windows NT/i.test(userAgent)) operatingSystem = "Windows";
	else if (/Android/i.test(userAgent)) operatingSystem = "Android";
	else if (/iPhone|iPad|iPod/i.test(userAgent)) operatingSystem = "iOS";
	else if (/Mac OS X|Macintosh/i.test(userAgent)) operatingSystem = "macOS";
	else if (/Linux/i.test(userAgent)) operatingSystem = "Linux";

	return { browser, operatingSystem };
}

function sessionUserName(session: Session) {
	const name = [session.firstName, session.lastName].filter(Boolean).join(" ");
	return name || session.email;
}

function formatDate(value: Date | string) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Not available" : format(date, "PPpp");
}

function isSessionActive(session: Session) {
	return new Date(session.expiresAt).getTime() > Date.now();
}

function SessionDetails({
	session,
	onClose,
}: {
	session: Session | null;
	onClose: () => void;
}) {
	const client = session ? getClientInfo(session.userAgent) : null;

	return (
		<Dialog open={!!session} onOpenChange={(open) => !open && onClose()}>
			{session && client && (
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>{sessionUserName(session)}</DialogTitle>
						<DialogDescription>
							{session.email}
							{session.isCurrent && " · Your current session"}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-5">
						<div className="flex flex-wrap gap-2">
							<Badge variant={session.isCurrent ? "default" : "secondary"}>
								{session.isCurrent ? "Current session" : "Other session"}
							</Badge>
							<Badge variant={isSessionActive(session) ? "green" : "outline"}>
								{isSessionActive(session) ? "Active" : "Expired"}
							</Badge>
						</div>

						<SessionDetailSection title="Identity" icon={UserRound}>
							<Detail label="User" value={sessionUserName(session)} />
							<Detail label="Email" value={session.email} />
						</SessionDetailSection>

						<SessionDetailSection title="Client" icon={Monitor}>
							<Detail label="Browser / client" value={client.browser} />
							<Detail label="Operating system" value={client.operatingSystem} />
						</SessionDetailSection>

						<SessionDetailSection title="Network" icon={Globe2}>
							<Detail
								label="IP address"
								value={session.ipAddress || "Not reported"}
							/>
						</SessionDetailSection>

						<SessionDetailSection title="Activity" icon={Activity}>
							<Detail label="Created" value={formatDate(session.createdAt)} />
							<Detail
								label="Last activity"
								value={formatDate(session.updatedAt)}
							/>
							<Detail label="Expires" value={formatDate(session.expiresAt)} />
						</SessionDetailSection>
					</div>
				</DialogContent>
			)}
		</Dialog>
	);
}

function SessionDetailSection({
	title,
	icon: Icon,
	children,
}: {
	title: string;
	icon: typeof UserRound;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-2">
			<h3 className="flex items-center gap-2 text-sm font-semibold">
				<Icon className="size-4 text-muted-foreground" aria-hidden />
				{title}
			</h3>
			<div className="grid gap-2 sm:grid-cols-2">{children}</div>
		</section>
	);
}

function Detail({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-md border px-3 py-2">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="break-words text-sm font-medium">{value}</p>
		</div>
	);
}

function SessionTable({
	sessions,
	isRevoking,
	onDetails,
	onRevoke,
}: {
	sessions: Session[];
	isRevoking: boolean;
	onDetails: (session: Session) => void;
	onRevoke: (session: Session) => Promise<void>;
}) {
	return (
		<div className="overflow-x-auto">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>User</TableHead>
						<TableHead>Client</TableHead>
						<TableHead>IP address</TableHead>
						<TableHead>Last activity</TableHead>
						<TableHead>Status</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{sessions.map((session) => {
						const client = getClientInfo(session.userAgent);
						const active = isSessionActive(session);

						return (
							<TableRow key={session.id}>
								<TableCell className="min-w-52">
									<div className="space-y-0.5">
										<p className="font-medium">{sessionUserName(session)}</p>
										<p className="text-xs text-muted-foreground">
											{session.email}
										</p>
									</div>
								</TableCell>
								<TableCell className="min-w-36">
									<div>{client.browser}</div>
									<div className="text-xs text-muted-foreground">
										{client.operatingSystem}
									</div>
								</TableCell>
								<TableCell className="whitespace-nowrap font-mono text-xs">
									{session.ipAddress || "Not reported"}
								</TableCell>
								<TableCell className="whitespace-nowrap text-muted-foreground">
									{formatDate(session.updatedAt)}
								</TableCell>
								<TableCell>
									<Badge variant={active ? "green" : "outline"}>
										{active ? "Active" : "Expired"}
									</Badge>
								</TableCell>
								<TableCell>
									<div className="flex justify-end gap-1">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onDetails(session)}
										>
											<Eye className="mr-2 size-4" />
											Details
										</Button>
										{active && (
											<DialogAction
												title="Revoke session"
												description={`This will sign out ${sessionUserName(session)} (${session.email}) from this Notploy instance.`}
												type="destructive"
												disabled={isRevoking}
												onClick={() => onRevoke(session)}
											>
												<Button
													variant="ghost"
													size="icon"
													aria-label={`Revoke session for ${session.email}`}
													disabled={isRevoking}
												>
													<LogOut className="size-4 text-destructive" />
												</Button>
											</DialogAction>
										)}
									</div>
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}

export const ShowSessions = () => {
	const { data: auth } = api.user.get.useQuery();
	const isOwner = auth?.role === "owner";
	const {
		data: sessions = [],
		isPending,
		isError,
		error,
		isFetching,
		refetch,
	} = api.user.listSessions.useQuery();
	const { mutateAsync: revoke, isPending: isRevoking } =
		api.user.revokeSession.useMutation();

	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [userFilter, setUserFilter] = useState("all");
	const [selectedSession, setSelectedSession] = useState<Session | null>(null);

	const users = useMemo(() => {
		const uniqueUsers = new Map<string, Session>();
		for (const session of sessions) {
			if (!uniqueUsers.has(session.userId))
				uniqueUsers.set(session.userId, session);
		}
		return [...uniqueUsers.entries()].map(([id, session]) => ({
			id,
			label: sessionUserName(session),
		}));
	}, [sessions]);

	const filteredSessions = useMemo(() => {
		const query = search.trim().toLowerCase();
		return sessions.filter((session) => {
			const client = getClientInfo(session.userAgent);
			const sessionActive = isSessionActive(session);
			const matchesSearch =
				!query ||
				[
					session.email,
					session.firstName,
					session.lastName,
					sessionUserName(session),
					session.ipAddress,
					client.browser,
					client.operatingSystem,
					format(new Date(session.createdAt), "yyyy-MM-dd"),
					format(new Date(session.updatedAt), "yyyy-MM-dd"),
					format(new Date(session.expiresAt), "yyyy-MM-dd"),
				]
					.filter(Boolean)
					.some((value) => value?.toLowerCase().includes(query));
			const matchesUser =
				!isOwner || userFilter === "all" || session.userId === userFilter;
			const matchesStatus =
				statusFilter === "all" ||
				(statusFilter === "active" ? sessionActive : !sessionActive);

			return matchesSearch && matchesUser && matchesStatus;
		});
	}, [isOwner, search, sessions, statusFilter, userFilter]);

	const activeSessions = filteredSessions.filter(
		(session) => !session.isCurrent && isSessionActive(session),
	);
	const expiredSessions = filteredSessions.filter(
		(session) => !session.isCurrent && !isSessionActive(session),
	);
	const totalActiveSessions = sessions.filter(isSessionActive).length;

	const handleRevoke = async (session: Session) => {
		try {
			await revoke({ sessionId: session.id });
			toast.success(`Session for ${session.email} revoked`);
			setSelectedSession((selected) =>
				selected?.id === session.id ? null : selected,
			);
			await refetch();
		} catch (revokeError) {
			toast.error(
				revokeError instanceof Error
					? revokeError.message
					: "Unable to revoke session",
			);
		}
	};

	return (
		<Card className="min-h-[85vh] w-full rounded-xl bg-sidebar p-2.5">
			<div className="flex h-full min-h-[calc(85vh-1.25rem)] flex-col gap-6 rounded-xl bg-background p-4 shadow-md sm:p-6">
				<header className="space-y-1">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h1 className="text-3xl font-semibold tracking-tight">
								Sessions
							</h1>
							<p className="text-sm text-muted-foreground">
								Manage active access to this Notploy instance.
							</p>
						</div>
						<Button
							variant="outline"
							onClick={() => void refetch()}
							disabled={isFetching}
						>
							<RefreshCw
								className={`mr-2 size-4 ${isFetching ? "animate-spin" : ""}`}
							/>
							Refresh
						</Button>
					</div>
				</header>

				{isPending ? (
					<div className="space-y-6">
						<Skeleton className="h-40 w-full rounded-xl" />
						<Skeleton className="h-72 w-full rounded-xl" />
					</div>
				) : isError ? (
					<Card>
						<CardContent
							role="alert"
							className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"
						>
							<ShieldCheck className="size-8 text-destructive" aria-hidden />
							<p className="text-sm text-destructive">
								Unable to load sessions: {error.message}
							</p>
							<Button variant="outline" onClick={() => void refetch()}>
								Try again
							</Button>
						</CardContent>
					</Card>
				) : (
					<>
						<CurrentSession
							session={sessions.find((session) => session.isCurrent) ?? null}
						/>

						<Card>
							<CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="space-y-1">
									<CardTitle className="flex items-center gap-2 text-xl">
										<Smartphone
											className="size-5 text-muted-foreground"
											aria-hidden
										/>
										Active sessions
									</CardTitle>
									<CardDescription>
										{totalActiveSessions} active{" "}
										{totalActiveSessions === 1 ? "session" : "sessions"} on this
										instance, including your current session.
									</CardDescription>
								</div>
								<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
									<div className="relative min-w-0 sm:w-64">
										<Search
											className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
											aria-hidden
										/>
										<Input
											value={search}
											onChange={(event) => setSearch(event.target.value)}
											placeholder="Search user, IP, client, date..."
											aria-label="Search sessions"
											className="pl-9"
										/>
									</div>
									<Select value={statusFilter} onValueChange={setStatusFilter}>
										<SelectTrigger
											className="sm:w-36"
											aria-label="Filter by status"
										>
											<SelectValue placeholder="All statuses" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All statuses</SelectItem>
											<SelectItem value="active">Active</SelectItem>
											<SelectItem value="expired">Expired</SelectItem>
										</SelectContent>
									</Select>
									{isOwner && (
										<Select value={userFilter} onValueChange={setUserFilter}>
											<SelectTrigger
												className="sm:w-48"
												aria-label="Filter by user"
											>
												<SelectValue placeholder="All users" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All users</SelectItem>
												{users.map((user) => (
													<SelectItem key={user.id} value={user.id}>
														{user.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
								</div>
							</CardHeader>
							<CardContent className="space-y-5 border-t p-0">
								{activeSessions.length > 0 ? (
									<section aria-label="Active sessions">
										<SessionTable
											sessions={activeSessions}
											isRevoking={isRevoking}
											onDetails={setSelectedSession}
											onRevoke={handleRevoke}
										/>
									</section>
								) : (
									<div className="flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center">
										<ShieldCheck
											className="size-7 text-muted-foreground"
											aria-hidden
										/>
										<p className="text-sm font-medium">
											{statusFilter === "all" || statusFilter === "active"
												? "No other active sessions."
												: "No active sessions match these filters."}
										</p>
										<p className="text-sm text-muted-foreground">
											Your current session is shown separately above.
										</p>
									</div>
								)}

								{expiredSessions.length > 0 && (
									<section className="border-t">
										<div className="flex items-center gap-2 px-5 py-3">
											<Clock3
												className="size-4 text-muted-foreground"
												aria-hidden
											/>
											<h3 className="text-sm font-semibold">
												Expired sessions
											</h3>
											<Badge variant="outline">{expiredSessions.length}</Badge>
										</div>
										<SessionTable
											sessions={expiredSessions}
											isRevoking={isRevoking}
											onDetails={setSelectedSession}
											onRevoke={handleRevoke}
										/>
									</section>
								)}

								{filteredSessions.length === 0 && sessions.length > 0 && (
									<div className="flex min-h-32 flex-col items-center justify-center gap-2 border-t p-6 text-center">
										<p className="text-sm text-muted-foreground">
											No sessions match these search and filter criteria.
										</p>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => {
												setSearch("");
												setStatusFilter("all");
												setUserFilter("all");
											}}
										>
											Clear filters
										</Button>
									</div>
								)}
							</CardContent>
						</Card>
					</>
				)}

				<SessionDetails
					session={selectedSession}
					onClose={() => setSelectedSession(null)}
				/>
			</div>
		</Card>
	);
};

function CurrentSession({ session }: { session: Session | null }) {
	if (!session) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
						Your current session
					</CardTitle>
				</CardHeader>
				<CardContent className="border-t pt-4 text-sm text-muted-foreground">
					The current session could not be identified in the session list.
				</CardContent>
			</Card>
		);
	}

	const client = getClientInfo(session.userAgent);
	const active = isSessionActive(session);

	return (
		<Card className="border-primary/40">
			<CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2 text-lg">
						<ShieldCheck className="size-5 text-primary" aria-hidden />
						Your current session
					</CardTitle>
					<CardDescription>
						This is the session you are using to access Notploy.
					</CardDescription>
				</div>
				<Badge variant={active ? "green" : "outline"}>
					{active ? "Active now" : "Expired"}
				</Badge>
			</CardHeader>
			<CardContent className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
				<CurrentSessionFact
					icon={UserRound}
					label="User"
					value={`${sessionUserName(session)} · ${session.email}`}
				/>
				<CurrentSessionFact
					icon={Monitor}
					label="Client"
					value={`${client.browser} · ${client.operatingSystem}`}
				/>
				<CurrentSessionFact
					icon={Globe2}
					label="IP address"
					value={session.ipAddress || "Not reported"}
				/>
				<CurrentSessionFact
					icon={CalendarClock}
					label="Created"
					value={formatDate(session.createdAt)}
				/>
				<CurrentSessionFact
					icon={Activity}
					label="Last activity"
					value={formatDate(session.updatedAt)}
				/>
				<CurrentSessionFact
					icon={Clock3}
					label="Expires"
					value={formatDate(session.expiresAt)}
				/>
			</CardContent>
		</Card>
	);
}

function CurrentSessionFact({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof UserRound;
	label: string;
	value: string;
}) {
	return (
		<div className="flex min-w-0 gap-2">
			<Icon
				className="mt-0.5 size-4 shrink-0 text-muted-foreground"
				aria-hidden
			/>
			<div className="min-w-0">
				<p className="text-xs text-muted-foreground">{label}</p>
				<p className="break-words text-sm font-medium">{value}</p>
			</div>
		</div>
	);
}
