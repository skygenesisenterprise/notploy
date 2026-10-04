type DeployJob =
	| {
			applicationId: string;
			titleLog: string;
			descriptionLog: string;
			server?: boolean;
			type: "deploy" | "redeploy";
			applicationType: "application";
			serverId?: string;
			/**
			 * Reuse a deployment row created by the caller instead of creating a
			 * new one. Set by the CI/CD API so a workflow gets a deployment id to
			 * poll before any worker has started.
			 */
			deploymentId?: string;
			/** Build this exact commit instead of the tip of the configured branch. */
			commitSha?: string;
	  }
	| {
			composeId: string;
			titleLog: string;
			descriptionLog: string;
			server?: boolean;
			type: "deploy" | "redeploy";
			applicationType: "compose";
			serverId?: string;
			freshVolumes?: boolean;
	  }
	| {
			applicationId: string;
			titleLog: string;
			descriptionLog: string;
			server?: boolean;
			type: "deploy" | "redeploy";
			applicationType: "application-preview";
			previewDeploymentId: string;
			serverId?: string;
	  };

export type DeploymentJob = DeployJob;
