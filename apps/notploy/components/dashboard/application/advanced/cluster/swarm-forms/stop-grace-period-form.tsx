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
import { api } from "@/utils/api";

const hasStopGracePeriodSwarm = (
	value: unknown,
): value is { stopGracePeriodSwarm: number | string | null } =>
	typeof value === "object" &&
	value !== null &&
	"stopGracePeriodSwarm" in value;

interface StopGracePeriodFormProps {
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

export const StopGracePeriodForm = ({ id, type }: StopGracePeriodFormProps) => {
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
			value: null as number | null,
		},
	});

	useEffect(() => {
		if (hasStopGracePeriodSwarm(data)) {
			const value = data.stopGracePeriodSwarm;
			const normalizedValue =
				value === null || value === undefined ? null : Number(value);
			form.reset({
				value: normalizedValue,
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: any) => {
		setIsLoading(true);
		try {
			await mutateAsync({
				applicationId: id || "",
				postgresId: id || "",
				redisId: id || "",
				mysqlId: id || "",
				mariadbId: id || "",
				mongoId: id || "",
				libsqlId: id || "",
				stopGracePeriodSwarm: formData.value,
			});

			toast.success("Stop grace period updated successfully");
			refetch();
		} catch {
			toast.error("Error updating stop grace period");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="value"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Stop Grace Period (nanoseconds)</FormLabel>
							<FormDescription>
								Time to wait before forcefully killing the container
								<br />
								Examples: 30000000000 (30s), 120000000000 (2m)
							</FormDescription>
							<FormControl>
								<Input
									type="number"
									placeholder="30000000000"
									{...field}
									value={
										field?.value !== null && field?.value !== undefined
											? field.value.toString()
											: ""
									}
									onChange={(e) =>
										field.onChange(
											e.target.value ? Number(e.target.value) : null,
										)
									}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.reset({
								value: null,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" isLoading={isLoading}>
						Save Stop Grace Period
					</Button>
				</div>
			</form>
		</Form>
	);
};
