import { format } from "date-fns";
import {
	LockKeyhole,
	MoreHorizontal,
	Search,
	ShieldCheck,
	UserRound,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DialogAction } from "@/components/shared/dialog-action";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { api, type RouterOutputs } from "@/utils/api";
import { AddInvitation } from "./add-invitation";
import { AddUserPermissions } from "./add-permissions";
import { ChangeRole } from "./change-role";

type Member = RouterOutputs["user"]["all"][number];

function memberName(member: Member) {
	const name = [member.user.firstName, member.user.lastName]
		.filter(Boolean)
		.join(" ");
	return name || member.user.email;
}

function initials(member: Member) {
	return memberName(member)
		.split(/[\s@._-]+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

function MemberDetails({
	member,
	onClose,
}: {
	member: Member | null;
	onClose: () => void;
}) {
	return (
		<Dialog open={!!member} onOpenChange={(open) => !open && onClose()}>
			{member && (
				<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>{memberName(member)}</DialogTitle>
						<DialogDescription>{member.user.email}</DialogDescription>
					</DialogHeader>
					<div className="space-y-5">
						<div className="flex flex-wrap gap-2">
							<Badge
								variant={member.role === "owner" ? "default" : "secondary"}
							>
								{member.role}
							</Badge>
							<Badge variant={member.user.banned ? "destructive" : "outline"}>
								{member.user.banned ? "Deactivated" : "Active"}
							</Badge>
							<Badge variant="outline">
								{member.user.twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
							</Badge>
						</div>

						<section className="space-y-2">
							<h3 className="text-sm font-semibold">Organization access</h3>
							{["owner", "admin"].includes(member.role) ? (
								<p className="text-sm text-muted-foreground">
									Full organization access through the {member.role} role.
								</p>
							) : (
								<div className="grid gap-2 sm:grid-cols-2">
									{[
										["Projects", member.accessedProjects.length],
										["Environments", member.accessedEnvironments.length],
										["Services", member.accessedServices.length],
										["Servers", member.accessedServers.length],
										["Git providers", member.accessedGitProviders.length],
									].map(([label, count]) => (
										<div
											key={label}
											className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
										>
											<span>{label}</span>
											<span className="font-medium tabular-nums">{count}</span>
										</div>
									))}
								</div>
							)}
							<p className="text-xs text-muted-foreground">
								Resource counts reflect the explicit access assignments for this
								member.
							</p>
						</section>

						<section className="space-y-2">
							<h3 className="text-sm font-semibold">Security</h3>
							<p className="flex items-center gap-2 text-sm text-muted-foreground">
								<ShieldCheck className="size-4" />
								Two-factor authentication{" "}
								{member.user.twoFactorEnabled ? "enabled" : "disabled"}
							</p>
						</section>

						<section className="space-y-1">
							<h3 className="text-sm font-semibold">Organization membership</h3>
							<p className="text-sm text-muted-foreground">
								Joined {format(new Date(member.createdAt), "PPpp")}
							</p>
						</section>
					</div>
				</DialogContent>
			)}
		</Dialog>
	);
}

export const ShowUsers = () => {
	const { data: isCloud } = api.settings.isCloud.useQuery();
	const {
		data: members = [],
		isPending,
		isError,
		error,
		refetch,
	} = api.user.all.useQuery();
	const { data: permissions } = api.user.getPermissions.useQuery();
	const { data: session } = api.user.session.useQuery();
	const { mutateAsync: removeUser, isPending: isRemoving } =
		api.user.remove.useMutation();
	const utils = api.useUtils();
	const [search, setSearch] = useState("");
	const [roleFilter, setRoleFilter] = useState("all");
	const [statusFilter, setStatusFilter] = useState("all");
	const [securityFilter, setSecurityFilter] = useState("all");
	const [selectedMember, setSelectedMember] = useState<Member | null>(null);

	const currentUserRole = members.find(
		(member) => member.user.id === session?.user?.id,
	)?.role;
	const roleOptions = useMemo(
		() => [...new Set(members.map((member) => member.role))].sort(),
		[members],
	);
	const filteredMembers = useMemo(() => {
		const normalizedSearch = search.trim().toLowerCase();
		return members.filter((member) => {
			const matchesSearch =
				!normalizedSearch ||
				[
					member.user.email,
					member.user.firstName,
					member.user.lastName,
					memberName(member),
				]
					.filter(Boolean)
					.some((value) => value?.toLowerCase().includes(normalizedSearch));
			const matchesRole = roleFilter === "all" || member.role === roleFilter;
			const matchesStatus =
				statusFilter === "all" ||
				(statusFilter === "active" ? !member.user.banned : member.user.banned);
			const matchesSecurity =
				securityFilter === "all" ||
				(securityFilter === "enabled"
					? member.user.twoFactorEnabled
					: !member.user.twoFactorEnabled);
			return matchesSearch && matchesRole && matchesStatus && matchesSecurity;
		});
	}, [members, roleFilter, search, securityFilter, statusFilter]);

	const handleRemove = async (member: Member, unlink: boolean) => {
		try {
			if (unlink && !isCloud) {
				const organizationCount = await utils.user.checkUserOrganizations.fetch(
					{
						userId: member.user.id,
					},
				);
				if (organizationCount > 1) {
					const { error: unlinkError } =
						await authClient.organization.removeMember({
							memberIdOrEmail: member.id,
						});
					if (unlinkError) throw new Error(unlinkError.message);
					toast.success("User unlinked successfully");
					await refetch();
					return;
				}
			}

			if (unlink && isCloud) {
				const { error: unlinkError } =
					await authClient.organization.removeMember({
						memberIdOrEmail: member.id,
					});
				if (unlinkError) throw new Error(unlinkError.message);
				toast.success("User unlinked successfully");
			} else {
				await removeUser({ userId: member.user.id });
				toast.success("User deleted successfully");
			}
			await refetch();
		} catch (removeError) {
			toast.error(
				removeError instanceof Error
					? removeError.message
					: unlink
						? "Error unlinking user"
						: "Error deleting user",
			);
		}
	};

	return (
		<Card className="w-full">
			<CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2 text-xl">
						<Users className="size-5 text-muted-foreground" aria-hidden />
						Members
					</CardTitle>
					<CardDescription>
						Review organization membership, roles and security status.
					</CardDescription>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
					{permissions?.member.create && !isCloud && (
						<AddInvitation
							triggerLabel="Create user"
							initialMode="credentials"
							credentialsOnly
						/>
					)}
					<div className="relative min-w-0 sm:w-64">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search members..."
							aria-label="Search members"
							className="pl-9"
						/>
					</div>
					<Select value={roleFilter} onValueChange={setRoleFilter}>
						<SelectTrigger className="sm:w-36" aria-label="Filter by role">
							<SelectValue placeholder="All roles" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All roles</SelectItem>
							{roleOptions.map((role) => (
								<SelectItem key={role} value={role}>
									{role}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="sm:w-36" aria-label="Filter by status">
							<SelectValue placeholder="All statuses" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All statuses</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="deactivated">Deactivated</SelectItem>
						</SelectContent>
					</Select>
					<Select value={securityFilter} onValueChange={setSecurityFilter}>
						<SelectTrigger className="sm:w-36" aria-label="Filter by 2FA">
							<SelectValue placeholder="All security" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All security</SelectItem>
							<SelectItem value="enabled">2FA enabled</SelectItem>
							<SelectItem value="disabled">2FA disabled</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</CardHeader>
			<CardContent className="border-t p-0">
				{isPending ? (
					<div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
						<span>Loading members…</span>
					</div>
				) : isError ? (
					<div role="alert" className="p-6 text-sm text-destructive">
						Unable to load members: {error.message}
					</div>
				) : members.length === 0 ? (
					<div className="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center">
						<Users className="size-8 text-muted-foreground" aria-hidden />
						<p className="text-sm text-muted-foreground">
							There are no members to display.
						</p>
					</div>
				) : filteredMembers.length === 0 ? (
					<div className="flex min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
						<Search className="size-6 text-muted-foreground" aria-hidden />
						<p className="text-sm text-muted-foreground">
							No members match these search and filter criteria.
						</p>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => {
								setSearch("");
								setRoleFilter("all");
								setStatusFilter("all");
								setSecurityFilter("all");
							}}
						>
							Clear filters
						</Button>
					</div>
				) : (
					<>
						<div className="hidden overflow-x-auto md:block">
							<table className="w-full text-sm">
								<thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
									<tr>
										<th className="px-5 py-3 font-medium">Member</th>
										<th className="px-4 py-3 font-medium">Role</th>
										<th className="px-4 py-3 font-medium">Status</th>
										<th className="px-4 py-3 font-medium">Security</th>
										<th className="px-4 py-3 font-medium">Joined</th>
										<th className="px-4 py-3 text-right font-medium">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filteredMembers.map((member) => (
										<MemberRow
											key={member.id}
											member={member}
											currentUserRole={currentUserRole}
											currentUserId={session?.user?.id}
											canUpdateMembers={permissions?.member.update ?? false}
											canDeleteMembers={permissions?.member.delete ?? false}
											isCloud={!!isCloud}
											isRemoving={isRemoving}
											onDetails={setSelectedMember}
											onRoleUpdated={() => refetch()}
											onManageAccess={() => utils.user.all.invalidate()}
											onRemove={(unlink) => handleRemove(member, unlink)}
										/>
									))}
								</tbody>
							</table>
						</div>
						<div className="divide-y md:hidden">
							{filteredMembers.map((member) => (
								<div key={member.id} className="flex items-start gap-3 p-4">
									<MemberIdentity member={member} />
									<div className="min-w-0 flex-1 space-y-2">
										<div className="flex flex-wrap items-center gap-2">
											<Badge
												variant={
													member.role === "owner" ? "default" : "secondary"
												}
											>
												{member.role}
											</Badge>
											<Badge
												variant={member.user.banned ? "destructive" : "outline"}
											>
												{member.user.banned ? "Deactivated" : "Active"}
											</Badge>
											<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
												<LockKeyhole className="size-3" />
												2FA {member.user.twoFactorEnabled ? "on" : "off"}
											</span>
										</div>
										<p className="text-xs text-muted-foreground">
											Joined {format(new Date(member.createdAt), "PP")}
										</p>
									</div>
									<MemberActions
										member={member}
										currentUserRole={currentUserRole}
										currentUserId={session?.user?.id}
										canUpdateMembers={permissions?.member.update ?? false}
										canDeleteMembers={permissions?.member.delete ?? false}
										isCloud={!!isCloud}
										isRemoving={isRemoving}
										onDetails={setSelectedMember}
										onRoleUpdated={() => refetch()}
										onManageAccess={() => utils.user.all.invalidate()}
										onRemove={(unlink) => handleRemove(member, unlink)}
									/>
								</div>
							))}
						</div>
						<p className="border-t px-5 py-3 text-xs text-muted-foreground">
							Showing {filteredMembers.length} of {members.length} members
						</p>
					</>
				)}
			</CardContent>
			<MemberDetails
				member={selectedMember}
				onClose={() => setSelectedMember(null)}
			/>
		</Card>
	);
};

function MemberIdentity({ member }: { member: Member }) {
	return (
		<>
			<Avatar size="sm" className="mt-0.5">
				<AvatarImage src={member.user.image ?? undefined} alt="" />
				<AvatarFallback>{initials(member)}</AvatarFallback>
			</Avatar>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium">{memberName(member)}</p>
				<p className="truncate text-xs text-muted-foreground">
					{member.user.email}
				</p>
			</div>
		</>
	);
}

function MemberRow({
	member,
	...actions
}: {
	member: Member;
	currentUserRole: string | undefined;
	currentUserId: string | undefined;
	canUpdateMembers: boolean;
	canDeleteMembers: boolean;
	isCloud: boolean;
	isRemoving: boolean;
	onDetails: (member: Member) => void;
	onRoleUpdated: () => void;
	onManageAccess: () => void;
	onRemove: (unlink: boolean) => void;
}) {
	return (
		<tr className="hover:bg-muted/20">
			<td className="px-5 py-3">
				<div className="flex min-w-52 items-center gap-3">
					<MemberIdentity member={member} />
					{member.user.id === actions.currentUserId && (
						<Badge variant="outline">You</Badge>
					)}
				</div>
			</td>
			<td className="px-4 py-3">
				<Badge variant={member.role === "owner" ? "default" : "secondary"}>
					{member.role}
				</Badge>
			</td>
			<td className="px-4 py-3">
				<Badge variant={member.user.banned ? "destructive" : "outline"}>
					{member.user.banned ? "Deactivated" : "Active"}
				</Badge>
			</td>
			<td className="px-4 py-3">
				<span className="inline-flex items-center gap-1.5 text-muted-foreground">
					{member.user.twoFactorEnabled ? (
						<ShieldCheck className="size-4 text-primary" />
					) : (
						<LockKeyhole className="size-4" />
					)}
					{member.user.twoFactorEnabled ? "2FA enabled" : "2FA disabled"}
				</span>
			</td>
			<td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
				{format(new Date(member.createdAt), "PP")}
			</td>
			<td className="px-4 py-3 text-right">
				<MemberActions member={member} {...actions} />
			</td>
		</tr>
	);
}

function MemberActions({
	member,
	currentUserRole,
	currentUserId,
	canUpdateMembers,
	canDeleteMembers,
	isCloud,
	isRemoving,
	onDetails,
	onRoleUpdated,
	onManageAccess,
	onRemove,
}: {
	member: Member;
	currentUserRole: string | undefined;
	currentUserId: string | undefined;
	canUpdateMembers: boolean;
	canDeleteMembers: boolean;
	isCloud: boolean;
	isRemoving: boolean;
	onDetails: (member: Member) => void;
	onRoleUpdated: () => void;
	onManageAccess: () => void;
	onRemove: (unlink: boolean) => void;
}) {
	const isStaticAdminOrOwner =
		member.role === "owner" || member.role === "admin";
	const isSelf = member.user.id === currentUserId;
	const canEditPermissions =
		canUpdateMembers && !isStaticAdminOrOwner && !isSelf;
	const canChangeRole =
		canUpdateMembers &&
		member.role !== "owner" &&
		!isSelf &&
		(currentUserRole === "owner" ||
			(currentUserRole === "admin" && member.role !== "admin"));
	const canRemove =
		member.role !== "owner" &&
		!isSelf &&
		(currentUserRole === "owner" ||
			(currentUserRole === "admin" && member.role !== "admin") ||
			(canDeleteMembers && !isStaticAdminOrOwner));
	const canDelete = canRemove && !isCloud;
	const canUnlink = canRemove && isCloud;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={`Actions for ${member.user.email}`}
				>
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Member</DropdownMenuLabel>
				<DropdownMenuItem onSelect={() => onDetails(member)}>
					<UserRound className="size-4" />
					View details
				</DropdownMenuItem>
				{canChangeRole && (
					<ChangeRole
						memberId={member.id}
						currentRole={member.role}
						userEmail={member.user.email}
						onSuccess={onRoleUpdated}
					/>
				)}
				{canEditPermissions && (
					<AddUserPermissions
						userId={member.user.id}
						role={member.role}
						onSuccess={onManageAccess}
					/>
				)}
				{(canDelete || canUnlink) && <DropdownMenuSeparator />}
				{canDelete && (
					<DialogAction
						title="Delete User"
						description="Are you sure you want to delete this user?"
						type="destructive"
						disabled={isRemoving}
						onClick={() => onRemove(false)}
					>
						<DropdownMenuItem
							className="w-full cursor-pointer text-destructive focus:text-destructive"
							onSelect={(event) => event.preventDefault()}
						>
							Delete user
						</DropdownMenuItem>
					</DialogAction>
				)}
				{canUnlink && (
					<DialogAction
						title="Unlink User"
						description="Are you sure you want to unlink this user from the organization?"
						type="destructive"
						disabled={isRemoving}
						onClick={() => onRemove(true)}
					>
						<DropdownMenuItem
							className="w-full cursor-pointer text-destructive focus:text-destructive"
							onSelect={(event) => event.preventDefault()}
						>
							Unlink user
						</DropdownMenuItem>
					</DialogAction>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
