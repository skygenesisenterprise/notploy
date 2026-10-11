import { validateRequest } from "@notploy/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import { ShowBlog } from "@/components/dashboard/website/blog/show-blog";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import type { Post, Tag } from "@/lib/ghost";
import { getPosts, getTags } from "@/lib/ghost";

interface BlogPageProps {
	posts: Post[];
	tags: Tag[];
}

const Page = ({ posts, tags }: BlogPageProps) => {
	return <ShowBlog posts={posts} tags={tags} />;
};

export default Page;

Page.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
	const { user } = await validateRequest(ctx.req);
	if (!user || (user.role !== "owner" && user.role !== "admin")) {
		return {
			redirect: {
				permanent: false,
				destination: "/",
			},
		};
	}

	const [posts, tags] = await Promise.all([getPosts(), getTags()]);

	return {
		props: {
			posts,
			tags,
		},
	};
}
