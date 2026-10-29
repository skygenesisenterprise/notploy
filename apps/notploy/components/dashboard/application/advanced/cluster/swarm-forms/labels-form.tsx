import { standardSchemaResolver as zodResolver } from "@hookform/resolvers/standard-schema";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
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
import { api } from "@/utils/api";

export const labelsFormSchema = z.object({
	labels: z
		.array(
			z.object({
				key: z.string(),
				value: z.string(),
			}),
		)
		.optional(),
});

interface LabelsFormProps {
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

export const LabelsForm = ({ id, type }: LabelsFormProps) => {
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
		resolver: zodResolver(labelsFormSchema),
		defaultValues: {
			labels: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "labels",
	});

	useEffect(() => {
		if (data?.labelsSwarm && typeof data.labelsSwarm === "object") {
			const labelEntries = Object.entries(data.labelsSwarm).map(
				([key, value]) => ({
					key,
					value: value as string,
				}),
			);
			form.reset({ labels: labelEntries });
		}
	}, [data, form]);

	const onSubmit = async (formData: z.infer<typeof labelsFormSchema>) => {
		setIsLoading(true);
		try {
			const labelsObject =
				formData.labels?.reduce(
					(acc, { key, value }) => {
						if (key && value) {
							acc[key] = value;
						}
						return acc;
					},
					{} as Record<string, string>,
				) || {};

			// If no labels, send null to clear the database
			const labelsToSend =
				Object.keys(labelsObject).length > 0 ? labelsObject : null;

			await mutateAsync({
				applicationId: id || "",
				postgresId: id || "",
				redisId: id || "",
				mysqlId: id || "",
				mariadbId: id || "",
				mongoId: id || "",
				libsqlId: id || "",
				labelsSwarm: labelsToSend,
			});

			toast.success("Labels updated successfully");
			refetch();
		} catch {
			toast.error("Error updating labels");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
				<div>
					<FormLabel>Labels</FormLabel>
					<FormDescription>
						Add key-value labels to your service
					</FormDescription>
					<div className="space-y-2 mt-2">
						{fields.map((field, index) => (
							<div key={field.id} className="flex gap-2">
								<FormField
									control={form.control}
									name={`labels.${index}.key`}
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormControl>
												<Input {...field} placeholder="com.example.app.name" />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name={`labels.${index}.value`}
									render={({ field }) => (
										<FormItem className="flex-1">
											<FormControl>
												<Input {...field} placeholder="my-app" />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={() => remove(index)}
								>
									Remove
								</Button>
							</div>
						))}
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => append({ key: "", value: "" })}
						>
							Add Label
						</Button>
					</div>
				</div>

				<div className="flex justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						onClick={() => {
							form.reset({ labels: [] });
						}}
					>
						Clear
					</Button>
					<Button type="submit" isLoading={isLoading}>
						Save Labels
					</Button>
				</div>
			</form>
		</Form>
	);
};
