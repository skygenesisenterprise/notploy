import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";

export const endpointSpecFormSchema = z.object({
	Mode: z.string().optional(),
});

interface EndpointSpecFormProps {
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

export const EndpointSpecForm = ({ id, type }: EndpointSpecFormProps) => {
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
		resolver: zodResolver(endpointSpecFormSchema),
		defaultValues: {
			Mode: undefined,
		},
	});

	useEffect(() => {
		if (data?.endpointSpecSwarm) {
			const es = data.endpointSpecSwarm;
			form.reset({
				Mode: es.Mode,
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof endpointSpecFormSchema>) => {
		setIsLoading(true);
		try {
			// Check if all values are empty, if so, send null to clear the database
			const hasAnyValue =
				formData.Mode !== undefined &&
				formData.Mode !== null &&
				formData.Mode !== "";

			await mutateAsync({
				applicationId: id || "",
				postgresId: id || "",
				redisId: id || "",
				mysqlId: id || "",
				mariadbId: id || "",
				mongoId: id || "",
				libsqlId: id || "",
				endpointSpecSwarm: hasAnyValue ? formData : null,
			});

			toast.success("Endpoint spec updated successfully");
			refetch();
		} catch {
			toast.error("Error updating endpoint spec");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="Mode"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Mode</FormLabel>
							<FormDescription>Endpoint mode (vip or dnsrr)</FormDescription>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select endpoint mode" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="vip">VIP (Virtual IP)</SelectItem>
									<SelectItem value="dnsrr">DNS Round Robin</SelectItem>
								</SelectContent>
							</Select>
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
								Mode: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" isLoading={isLoading}>
						Save Endpoint Spec
					</Button>
				</div>
			</form>
		</Form>
	);
};
