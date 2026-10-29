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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";

export const updateConfigFormSchema = z.object({
	Parallelism: z.coerce.number().optional(),
	Delay: z.coerce.number().optional(),
	FailureAction: z.string().optional(),
	Monitor: z.coerce.number().optional(),
	MaxFailureRatio: z.coerce.number().optional(),
	Order: z.string().optional(),
});

interface UpdateConfigFormProps {
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

export const UpdateConfigForm = ({ id, type }: UpdateConfigFormProps) => {
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
		resolver: zodResolver(updateConfigFormSchema),
		defaultValues: {
			Parallelism: undefined,
			Delay: undefined,
			FailureAction: undefined,
			Monitor: undefined,
			MaxFailureRatio: undefined,
			Order: undefined,
		},
	});

	useEffect(() => {
		if (data?.updateConfigSwarm) {
			const config = data.updateConfigSwarm;
			form.reset({
				Parallelism: config.Parallelism,
				Delay: config.Delay,
				FailureAction: config.FailureAction,
				Monitor: config.Monitor,
				MaxFailureRatio: config.MaxFailureRatio,
				Order: config.Order,
			});
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof updateConfigFormSchema>) => {
		setIsLoading(true);
		try {
			// Check if all values are empty, if so, send null to clear the database
			const hasAnyValue = Object.values(formData).some(
				(value) => value !== undefined && value !== null && value !== "",
			);

			await mutateAsync({
				applicationId: id || "",
				postgresId: id || "",
				redisId: id || "",
				mysqlId: id || "",
				mariadbId: id || "",
				mongoId: id || "",
				libsqlId: id || "",
				updateConfigSwarm: (hasAnyValue ? formData : null) as any,
			});

			toast.success("Update config updated successfully");
			refetch();
		} catch {
			toast.error("Error updating update config");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<FormField
					control={form.control}
					name="Parallelism"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Parallelism</FormLabel>
							<FormDescription>
								Number of tasks to update simultaneously
							</FormDescription>
							<FormControl>
								<Input type="number" placeholder="1" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Delay"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Delay (nanoseconds)</FormLabel>
							<FormDescription>Delay between task updates</FormDescription>
							<FormControl>
								<Input type="number" placeholder="10000000000" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="FailureAction"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Failure Action</FormLabel>
							<FormDescription>Action on update failure</FormDescription>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select failure action" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="pause">Pause</SelectItem>
									<SelectItem value="continue">Continue</SelectItem>
									<SelectItem value="rollback">Rollback</SelectItem>
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Monitor"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Monitor (nanoseconds)</FormLabel>
							<FormDescription>
								Duration to monitor for failure after update
							</FormDescription>
							<FormControl>
								<Input type="number" placeholder="10000000000" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="MaxFailureRatio"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Max Failure Ratio</FormLabel>
							<FormDescription>
								Maximum failure ratio tolerated (0-1)
							</FormDescription>
							<FormControl>
								<Input type="number" step="0.01" placeholder="0.1" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="Order"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Order</FormLabel>
							<FormDescription>Update order strategy</FormDescription>
							<Select onValueChange={field.onChange} value={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder="Select order" />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									<SelectItem value="stop-first">Stop First</SelectItem>
									<SelectItem value="start-first">Start First</SelectItem>
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
								Parallelism: undefined,
								Delay: undefined,
								FailureAction: undefined,
								Monitor: undefined,
								MaxFailureRatio: undefined,
								Order: undefined,
							});
						}}
					>
						Clear
					</Button>
					<Button type="submit" isLoading={isLoading}>
						Save Update Config
					</Button>
				</div>
			</form>
		</Form>
	);
};
