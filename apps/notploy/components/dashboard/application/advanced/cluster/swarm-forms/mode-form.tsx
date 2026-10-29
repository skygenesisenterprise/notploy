import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";

interface ModeFormProps {
	id: string;
	type:
		| "postgres"
		| "mariadb"
		| "mongo"
		| "mysql"
		| "redis"
		| "application"
		| "libsql";
}

export const ModeForm = ({ id, type }: ModeFormProps) => {
	const [isLoading, setIsLoading] = useState(false);

	const postgresQuery = api.postgres.one.useQuery(
		{ postgresId: id },
		{ enabled: !!id && type === "postgres" },
	);
	const redisQuery = api.redis.one.useQuery(
		{ redisId: id },
		{ enabled: !!id && type === "redis" },
	);
	const mysqlQuery = api.mysql.one.useQuery(
		{ mysqlId: id },
		{ enabled: !!id && type === "mysql" },
	);
	const mariadbQuery = api.mariadb.one.useQuery(
		{ mariadbId: id },
		{ enabled: !!id && type === "mariadb" },
	);
	const applicationQuery = api.application.one.useQuery(
		{ applicationId: id },
		{ enabled: !!id && type === "application" },
	);
	const mongoQuery = api.mongo.one.useQuery(
		{ mongoId: id },
		{ enabled: !!id && type === "mongo" },
	);
	const libsqlQuery = api.libsql.one.useQuery(
		{ libsqlId: id },
		{ enabled: !!id && type === "libsql" },
	);
	const serviceQueries = {
		postgres: postgresQuery,
		redis: redisQuery,
		mysql: mysqlQuery,
		mariadb: mariadbQuery,
		application: applicationQuery,
		mongo: mongoQuery,
		libsql: libsqlQuery,
	};
	const { data, refetch } = serviceQueries[type] ?? mongoQuery;

	const postgresMutation = api.postgres.update.useMutation();
	const redisMutation = api.redis.update.useMutation();
	const mysqlMutation = api.mysql.update.useMutation();
	const mariadbMutation = api.mariadb.update.useMutation();
	const applicationMutation = api.application.update.useMutation();
	const mongoMutation = api.mongo.update.useMutation();
	const libsqlMutation = api.libsql.update.useMutation();
	const serviceMutations = {
		postgres: postgresMutation,
		redis: redisMutation,
		mysql: mysqlMutation,
		mariadb: mariadbMutation,
		application: applicationMutation,
		mongo: mongoMutation,
		libsql: libsqlMutation,
	};
	const { mutateAsync } = serviceMutations[type] ?? mongoMutation;

	const form = useForm<any>({
		defaultValues: {
			type: undefined,
			Replicas: undefined,
		},
	});

	const modeType = form.watch("type");

	useEffect(() => {
		if (data?.modeSwarm) {
			const mode = data.modeSwarm;
			if (mode.Replicated) {
				form.reset({
					type: "Replicated",
					Replicas: mode.Replicated.Replicas,
				});
			} else if (mode.Global) {
				form.reset({
					type: "Global",
					Replicas: undefined,
				});
			}
		}
	}, [data, form]);

	const onSubmit = async (formData: any) => {
		setIsLoading(true);
		try {
			// If no type is selected, send null to clear the database
			if (!formData.type) {
				await mutateAsync({
					applicationId: id || "",
					postgresId: id || "",
					redisId: id || "",
					mysqlId: id || "",
					mariadbId: id || "",
					mongoId: id || "",
					libsqlId: id || "",
					modeSwarm: null,
				});
				toast.success("Mode updated successfully");
				refetch();
				setIsLoading(false);
				return;
			}

			const modeData =
				formData.type === "Replicated"
					? {
							Replicated: {
								Replicas:
									formData.Replicas !== undefined && formData.Replicas !== ""
										? Number(formData.Replicas)
										: undefined,
							},
						}
					: { Global: {} };

			await mutateAsync({
				applicationId: id || "",
				postgresId: id || "",
				redisId: id || "",
				mysqlId: id || "",
				mariadbId: id || "",
				mongoId: id || "",
				libsqlId: id || "",
				modeSwarm: modeData,
			});

			toast.success("Mode updated successfully");
			refetch();
		} catch {
			toast.error("Error updating mode");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="type"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Mode Type</FormLabel>
							<FormDescription>
								Choose between replicated or global service mode
							</FormDescription>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select mode type" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="Replicated">Replicated</SelectItem>
									<SelectItem value="Global">Global</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				{modeType === "Replicated" && (
					<FormField
						control={form.control}
						name="Replicas"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Replicas</FormLabel>
								<FormDescription>Number of replicas to run</FormDescription>
								<FormControl>
									<Input type="number" placeholder="1" {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				)}

				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.reset({
								type: undefined,
								Replicas: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" isLoading={isLoading}>
						Save Mode
					</Button>
				</div>
			</form>
		</Form>
	);
};
