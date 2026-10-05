"use client";

import { Folder, FolderOpen, MousePointerClick, Workflow } from "lucide-react";
import React from "react";
import { AlertBlock } from "@/components/shared/alert-block";
import {
	ConsoleEmpty,
	ConsoleLoading,
} from "@/components/shared/console-shell";
import { Tree } from "@/components/ui/file-tree";
import { api } from "@/utils/api";
import { ShowTraefikFile } from "./show-traefik-file";

interface Props {
	serverId?: string;
}

export const ShowTraefikSystem = ({ serverId }: Props) => {
	const [file, setFile] = React.useState<null | string>(null);

	const {
		data: directories,
		isLoading,
		error,
		isError,
	} = api.settings.readDirectories.useQuery(
		{
			serverId,
		},
		{
			retry: 2,
		},
	);

	return (
		<section className="space-y-4">
			<div className="space-y-1">
				<h2 className="font-medium">Traefik file system</h2>
				<p className="text-sm text-muted-foreground">
					Manage every file and directory in <code>/etc/notploy/traefik</code>.
				</p>
			</div>

			<AlertBlock type="warning">
				Adding invalid configuration to existing files can break your Traefik
				instance and prevent access to your applications.
			</AlertBlock>

			{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}

			{isLoading ? (
				<ConsoleLoading label="Loading Traefik directories…" />
			) : directories?.length === 0 ? (
				<ConsoleEmpty
					icon={FolderOpen}
					title="No configuration files found"
					description="There are no directories or files in /etc/notploy/traefik on this server yet."
				/>
			) : directories && directories.length > 0 ? (
				<div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-10">
					<Tree
						data={directories}
						className="w-full rounded-lg border lg:h-165 lg:max-w-76"
						onSelectChange={(item) => setFile(item?.id || null)}
						folderIcon={Folder}
						itemIcon={Workflow}
					/>
					<div className="w-full">
						{file ? (
							<ShowTraefikFile path={file} serverId={serverId} />
						) : (
							<ConsoleEmpty
								icon={MousePointerClick}
								title="Select a file to edit"
								description="Choose a file from the tree to view and edit its contents."
							/>
						)}
					</div>
				</div>
			) : null}
		</section>
	);
};
