import { z } from "zod";
import { zfd } from "zod-form-data";

if (typeof window === "undefined") {
	void (async () => {
		// undici v8 no longer exports File/FileList: rely on Node natives.
		if (typeof globalThis.File === "undefined") {
			const { File } = await import("node:buffer");
			globalThis.File = File as any;
		}
		if (typeof (globalThis as any).FileList === "undefined") {
			// FileList is DOM-only; provide a minimal stub so SSR
			// `instanceof FileList` checks don't crash.
			(globalThis as any).FileList = class FileList extends Array {};
		}
	})();
}

export const APP_NAME_REGEX = /^[a-z](?!.*--)([a-z0-9-]*[a-z0-9])?$/;
export const APP_NAME_MESSAGE =
	"App name supports lowercase letters, numbers, '-' and must start with a letter, end with a letter or number, and cannot contain consecutive '-'";

export const uploadFileSchema = zfd.formData({
	applicationId: z.string().optional(),
	zip: zfd.file(),
	dropBuildPath: z.string().optional(),
});

export type UploadFile = z.infer<typeof uploadFileSchema>;

export const uploadFileToContainerSchema = zfd.formData({
	containerId: z
		.string()
		.min(1)
		.regex(/^[a-zA-Z0-9.\-_]+$/, "Invalid container ID"),
	file: zfd.file(),
	destinationPath: z
		.string()
		.min(1)
		.regex(
			/^[a-zA-Z0-9.\-_/]+$/,
			"Invalid destination path: only alphanumeric characters, dots, dashes, underscores, and forward slashes are allowed",
		),
	serverId: z.string().optional(),
});

export type UploadFileToContainer = z.infer<typeof uploadFileToContainerSchema>;
