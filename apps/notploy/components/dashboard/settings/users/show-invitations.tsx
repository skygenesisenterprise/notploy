import copy from "copy-to-clipboard";
import { format, isPast } from "date-fns";
import { Loader2, Mail, MoreHorizontal, Users } from "lucide-react";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { api, type RouterOutputs } from "@/utils/api";
import { AddInvitation } from "./add-invitation";

type Invitation = RouterOutputs["organization"]["allInvitations"][number];

export const ShowInvitations = () => {
	const { data: invitations, isPending, isError, error, refetch } =
		api.organization.allInvitations.useQuery();
	const { mutateAsync: removeInvitation } =
		api.organization.removeInvitation.useMutation();

	const handleCancel = async (invitation: Invitation) => {
		const result = await authClient.organization.cancelInvitation({
			invitationId: invitation.id,
		});
		if (result.error) {
			toast.error(result.error.message);
			return;
		}
		toast.success("Invitation canceled");
		await refetch();
	};

	const handleRemove = async (invitation: Invitation) => {
		try {
			await removeInvitation({ invitationId: invitation.id });
			toast.success("Invitation removed");
			await refetch();
		} catch (removeError) {
			toast.error(
				removeError instanceof Error
					? removeError.message
					: "Unable to remove invitation",
			);
		}
	};

	return (
		<Card className="w-full">
			<CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="flex items-center gap-2 text-xl">
						<Mail className="size-5 text-muted-foreground" aria-hidden />
						Invitations
					</CardTitle>
					<CardDescription>
						Track pending invitations and manage their access links.
					</CardDescription>
				</div>
				<AddInvitation />
			</CardHeader>
			<CardContent className="border-t p-0">
				{isPending ? (
					<div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
						<span>Loading invitations…</span>
						<Loader2 className="size-4 animate-spin" />
					</div>
				) : isError ? (
					<div role="alert" className="p-6 text-sm text-destructive">
						Unable to load invitations: {error.message}
					</div>
				) : invitations?.length ? (
					<>
						<div className="hidden overflow-x-auto md:block">
							<table className="w-full text-sm">
								<thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
									<tr>
										<th className="px-5 py-3 font-medium">Email</th>
										<th className="px-4 py-3 font-medium">Role</th>
										<th className="px-4 py-3 font-medium">Status</th>
										<th className="px-4 py-3 font-medium">Expires</th>
										<th className="px-4 py-3 text-right font-medium">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{invitations.map((invitation) => (
										<tr key={invitation.id} className="hover:bg-muted/20">
											<td className="px-5 py-3 font-medium">
												{invitation.email}
											</td>
											<td className="px-4 py-3">
												<Badge
													variant={
														invitation.role === "owner"
															? "default"
															: "secondary"
													}
												>
													{invitation.role}
												</Badge>
											</td>
											<td className="px-4 py-3">
												<InvitationStatus invitation={invitation} />
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
												{format(new Date(invitation.expiresAt), "PPpp")}
											</td>
											<td className="px-4 py-3 text-right">
												<InvitationActions
													invitation={invitation}
													onCancel={() => handleCancel(invitation)}
													onRemove={() => handleRemove(invitation)}
												/>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<div className="divide-y md:hidden">
							{invitations.map((invitation) => (
								<div
									key={invitation.id}
									className="flex items-start justify-between gap-3 p-4"
								>
									<div className="min-w-0 space-y-2">
										<p className="break-all text-sm font-medium">
											{invitation.email}
										</p>
										<div className="flex flex-wrap items-center gap-2">
											<Badge variant="secondary">{invitation.role}</Badge>
											<InvitationStatus invitation={invitation} />
										</div>
										<p className="text-xs text-muted-foreground">
											Expires {format(new Date(invitation.expiresAt), "PPpp")}
										</p>
									</div>
									<InvitationActions
										invitation={invitation}
										onCancel={() => handleCancel(invitation)}
										onRemove={() => handleRemove(invitation)}
									/>
								</div>
							))}
						</div>
					</>
				) : (
					<div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
						<Users className="size-8 text-muted-foreground" aria-hidden />
						<p className="text-sm text-muted-foreground">
							No invitations yet. Invite someone to join your organization.
						</p>
						<AddInvitation />
					</div>
				)}
			</CardContent>
		</Card>
	);
};

function InvitationStatus({ invitation }: { invitation: Invitation }) {
	const expired = isPast(new Date(invitation.expiresAt));
	const status = invitation.status === "pending" && expired ? "expired" : invitation.status;
	return (
		<Badge
			variant={
				status === "pending"
					? "secondary"
					: status === "canceled" || status === "expired"
						? "destructive"
						: "default"
			}
		>
			{status}
		</Badge>
	);
}

function InvitationActions({
	invitation,
	onCancel,
	onRemove,
}: {
	invitation: Invitation;
	onCancel: () => void;
	onRemove: () => void;
}) {
	const isPending = invitation.status === "pending";
	const isExpired = isPast(new Date(invitation.expiresAt));
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={`Actions for invitation to ${invitation.email}`}
				>
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuLabel>Invitation</DropdownMenuLabel>
				{isPending && !isExpired && (
					<DropdownMenuItem
						onSelect={() => {
							copy(`${window.location.origin}/invitation?token=${invitation.id}`);
							toast.success("Invitation copied to clipboard");
						}}
					>
						Copy invitation link
					</DropdownMenuItem>
				)}
				{isPending && (
					<DialogAction
						title="Cancel invitation"
						description={`Cancel the invitation sent to ${invitation.email}?`}
						onClick={onCancel}
						type="destructive"
					>
						<DropdownMenuItem onSelect={(event) => event.preventDefault()}>
							Cancel invitation
						</DropdownMenuItem>
					</DialogAction>
				)}
				{isPending && <DropdownMenuSeparator />}
				<DialogAction
					title="Remove invitation"
					description={`Remove the invitation record for ${invitation.email}?`}
					onClick={onRemove}
					type="destructive"
				>
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={(event) => event.preventDefault()}
					>
						Remove invitation
					</DropdownMenuItem>
				</DialogAction>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
