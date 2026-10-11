import {
	CLEANUP_CRON_JOB,
	cleanupAll,
	isExternalJobsEnabled,
	sendDockerCleanupNotifications,
} from "@notploy/server";
import { scheduledJobs, scheduleJob } from "node-schedule";
import { removeJob, schedule } from "./backup";

export const applyDockerCleanupSchedule = async (
	serverId: string,
	organizationId: string,
	enable: boolean,
) => {
	if (enable) {
		if (isExternalJobsEnabled()) {
			await schedule({
				cronSchedule: CLEANUP_CRON_JOB,
				serverId,
				type: "server",
			});
		} else {
			scheduleJob(serverId, CLEANUP_CRON_JOB, async () => {
				await cleanupAll(serverId);
				await sendDockerCleanupNotifications(organizationId);
			});
		}
	} else {
		if (isExternalJobsEnabled()) {
			await removeJob({
				cronSchedule: CLEANUP_CRON_JOB,
				serverId,
				type: "server",
			});
		} else {
			scheduledJobs[serverId]?.cancel();
		}
	}
};
