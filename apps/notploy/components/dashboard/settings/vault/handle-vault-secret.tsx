import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";

export interface ManagedSecret {
	vaultSecretId: string;
	name: string;
	description?: string | null;
}

interface Props {
	vaultProviderId: string;
	secret?: ManagedSecret | null;
	trigger?: ReactNode;
}

const buildSchema = (isEdit: boolean) =>
	z.object({
		name: z
			.string()
			.min(1, { message: "Name is required" })
			.regex(/^[a-zA-Z0-9._-]+$/, {
				message:
					"Only letters, numbers, dots, dashes and underscores (used in ${{vault.<name>.<secret>}})",
			}),
		value: isEdit ? z.string() : z.string().min(1, { message: "Value is required" }),
		description: z.string(),
	});

type VaultSecretForm = z.infer<ReturnType<typeof buildSchema>>;

export const HandleVaultSecret = ({ vaultProviderId, secret, trigger }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);
	const isEdit = !!secret;

	const createMutation = api.vaultProvider.createSecret.useMutation();
	const updateMutation = api.vaultProvider.updateSecret.useMutation();
	const active = isEdit ? updateMutation : createMutation;
	const { isPending, error, isError } = active;

	const form = useForm<VaultSecretForm>({
		defaultValues: {
			name: secret?.name ?? "",
			value: "",
			description: secret?.description ?? "",
		},
		resolver: zodResolver(buildSchema(isEdit)),
	});

	useEffect(() => {
		if (isOpen) {
			form.reset({
				name: secret?.name ?? "",
				value: "",
				description: secret?.description ?? "",
			});
		}
	}, [isOpen, secret, form]);

	const onSubmit = async (data: VaultSecretForm) => {
		const description = data.description.trim() || undefined;
		const onSuccess = () => {
			toast.success(secret ? "Secret updated" : "Secret created");
			utils.vaultProvider.listSecrets.invalidate({ vaultProviderId });
			setIsOpen(false);
		};
		const onSettled = () =>
			form.reset({ name: "", value: "", description: "" });

		if (secret) {
			await updateMutation
				.mutateAsync({
					vaultSecretId: secret.vaultSecretId,
					name: data.name,
					// An empty value keeps the stored one untouched.
					...(data.value ? { value: data.value } : {}),
					description,
				})
				.then(onSuccess)
				.catch(() => {})
				.finally(onSettled);
		} else {
			await createMutation
				.mutateAsync({
					vaultProviderId,
					name: data.name,
					value: data.value,
					description,
				})
				.then(onSuccess)
				.catch(() => {})
				.finally(onSettled);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent className="max-h-screen overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						{isEdit ? "Update Secret" : "Add Secret"}
					</DialogTitle>
					<DialogDescription>
						Store a secret directly in Notploy, encrypted at rest. Reference it
						in an environment variable with{" "}
						<code>{"${{vault.<name>.<secret>}}"}</code>.
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="DATABASE_URL" {...field} />
									</FormControl>
									<FormDescription>
										The name used after the provider, e.g.{" "}
										<code>{"${{vault.my-provider.DATABASE_URL}}"}</code>.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="value"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Value</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder={
												isEdit
													? "Leave blank to keep the current value"
													: "s3cret"
											}
											autoComplete="new-password"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Stored encrypted with AES-256-GCM and never shown again.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description (optional)</FormLabel>
									<FormControl>
										<Textarea
											rows={2}
											placeholder="What this secret is used for"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<DialogFooter>
							<Button
								type="button"
								variant="ghost"
								onClick={() => setIsOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit" isLoading={isPending}>
								{isEdit ? "Save secret" : "Add secret"}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
