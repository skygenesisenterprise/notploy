import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const BlogSchema = z.object({
	title: z
		.string()
		.min(1, "Title is required")
		.max(255, "Title must be less than 255 characters"),
	custom_excerpt: z
		.string()
		.max(500, "Excerpt must be less than 500 characters")
		.optional(),
	feature_image: z
		.string()
		.url("Must be a valid URL")
		.optional()
		.or(z.literal("")),
	tags: z.string().optional(),
	html: z.string().min(1, "Content is required"),
	publish: z.boolean(),
});

type BlogForm = z.infer<typeof BlogSchema>;

export const HandleBlog = () => {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);

	const form = useForm<BlogForm>({
		defaultValues: {
			title: "",
			custom_excerpt: "",
			feature_image: "",
			tags: "",
			html: "",
			publish: true,
		},
		resolver: zodResolver(BlogSchema),
	});

	const onSubmit = async (data: BlogForm) => {
		try {
			const response = await fetch("/api/website/blog", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: data.title,
					html: data.html,
					status: data.publish ? "published" : "draft",
					custom_excerpt: data.custom_excerpt || undefined,
					feature_image: data.feature_image || undefined,
					tags: data.tags
						? data.tags
								.split(",")
								.map((tag) => tag.trim())
								.filter(Boolean)
						: undefined,
				}),
			});

			if (!response.ok) {
				const payload = (await response.json().catch(() => null)) as {
					error?: string;
				} | null;
				throw new Error(payload?.error || "Failed to create post");
			}

			toast.success(data.publish ? "Post published" : "Draft saved");
			setIsOpen(false);
			form.reset();
			await router.replace(router.asPath);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to create post",
			);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon className="h-4 w-4" />
					New Blog
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>New Blog Post</DialogTitle>
					<DialogDescription>
						Write an article and publish it to the Notploy website.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						id="hook-form-blog"
						onSubmit={(e) => {
							e.stopPropagation();
							form.handleSubmit(onSubmit)(e);
						}}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="title"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Title</FormLabel>
									<FormControl>
										<Input
											placeholder="e.g., Introducing Notploy Cloud"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="custom_excerpt"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Excerpt (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="A short summary shown on the blog list"
											className="min-h-[80px]"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="feature_image"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Feature image (Optional)</FormLabel>
										<FormControl>
											<Input placeholder="https://..." {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="tags"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Tags (Optional)</FormLabel>
										<FormControl>
											<Input placeholder="Product, Release" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<FormField
							control={form.control}
							name="html"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Content (HTML)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="<p>Your article...</p>"
											className="min-h-[240px] font-mono text-sm"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										The article body, written in HTML or Markdown.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="publish"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3.5">
									<div className="space-y-0.5">
										<FormLabel>Publish immediately</FormLabel>
										<FormDescription>
											When off, the post is saved as a draft.
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</form>
				</Form>

				<DialogFooter>
					<Button
						isLoading={form.formState.isSubmitting}
						form="hook-form-blog"
						type="submit"
					>
						{form.watch("publish") ? "Publish" : "Save draft"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
