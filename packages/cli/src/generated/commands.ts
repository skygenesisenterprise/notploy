// Auto-generated from openapi.json (sha256:1e10aba255907e70) — do not edit manually.
// Run: pnpm run generate
//
// 717 commands in 63 groups.

import type { Command } from "commander";
import { runApiCommand } from "../commands/run.js";

export function registerGeneratedCommands(program: Command) {
	const g_admin = program.command("admin").description("admin commands");
	g_admin
		.command("setup-monitoring")
		.description("Setup Monitoring")
		.option("--metricsConfig <json>", "Metrics Config [required] (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "admin.setupMonitoring", "post", options, { required: ["metricsConfig"], types: {"metricsConfig":"object"} }),
		);
	const g_ai = program.command("ai").description("ai commands");
	g_ai
		.command("analyze-logs")
		.description("Analyze Logs")
		.option("--aiId <value>", "Ai Id [required]")
		.option("--logs <value>", "Logs [required]")
		.option("--context <value>", "Context [required] (one of: build, runtime)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.analyzeLogs", "post", options, { required: ["aiId","logs","context"], enums: {"context":["build","runtime"]} }),
		);
	g_ai
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--apiUrl <value>", "Api Url [required]")
		.option("--apiKey <value>", "Api Key [required]")
		.option("--model <value>", "Model [required]")
		.option("--isEnabled [boolean]", "Is Enabled [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.create", "post", options, { required: ["name","apiUrl","apiKey","model","isEnabled"], types: {"isEnabled":"boolean"} }),
		);
	g_ai
		.command("delete")
		.description("Delete")
		.option("--aiId <value>", "Ai Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.delete", "post", options, { required: ["aiId"] }),
		);
	g_ai
		.command("deploy")
		.description("Deploy")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--id <value>", "Id [required]")
		.option("--dockerCompose <value>", "Docker Compose [required]")
		.option("--envVariables <value>", "Env Variables [required]")
		.option("--serverId <value>", "Server Id")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description [required]")
		.option("--domains <json>", "Domains (JSON array)")
		.option("--configFiles <json>", "Config Files (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.deploy", "post", options, { required: ["environmentId","id","dockerCompose","envVariables","name","description"], types: {"configFiles":"array","domains":"array"} }),
		);
	g_ai
		.command("get")
		.description("Get")
		.option("--aiId <value>", "Ai Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.get", "get", options, { required: ["aiId"] }),
		);
	g_ai
		.command("get-all")
		.description("Get All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.getAll", "get", options),
		);
	g_ai
		.command("get-custom-providers")
		.description("Get Custom Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.getCustomProviders", "get", options),
		);
	g_ai
		.command("get-enabled-providers")
		.description("Get Enabled Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.getEnabledProviders", "get", options),
		);
	g_ai
		.command("get-models")
		.description("Get Models")
		.option("--apiUrl <value>", "Api Url")
		.option("--apiKey <value>", "Api Key")
		.option("--aiId <value>", "Ai Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.getModels", "get", options),
		);
	g_ai
		.command("one")
		.description("One")
		.option("--aiId <value>", "Ai Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.one", "get", options, { required: ["aiId"] }),
		);
	g_ai
		.command("save-custom-providers")
		.description("Save Custom Providers")
		.option("--providers <json>", "Providers [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.saveCustomProviders", "post", options, { required: ["providers"], types: {"providers":"array"} }),
		);
	g_ai
		.command("suggest")
		.description("Suggest")
		.option("--aiId <value>", "Ai Id [required]")
		.option("--input <value>", "Input [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.suggest", "post", options, { required: ["aiId","input"] }),
		);
	g_ai
		.command("test-connection")
		.description("Test Connection")
		.option("--aiId <value>", "Ai Id")
		.option("--apiUrl <value>", "Api Url")
		.option("--apiKey <value>", "Api Key")
		.option("--model <value>", "Model [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.testConnection", "post", options, { required: ["model"] }),
		);
	g_ai
		.command("update")
		.description("Update")
		.option("--aiId <value>", "Ai Id [required]")
		.option("--name <value>", "Name")
		.option("--apiUrl <value>", "Api Url")
		.option("--apiKey <value>", "Api Key")
		.option("--model <value>", "Model")
		.option("--isEnabled [boolean]", "Is Enabled")
		.option("--no-isEnabled", "Set isEnabled to false")
		.option("--createdAt <value>", "Created At")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "ai.update", "post", options, { required: ["aiId"], types: {"isEnabled":"boolean"} }),
		);
	const g_application = program.command("application").description("application commands");
	g_application
		.command("cancel-deployment")
		.description("Cancel Deployment")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.cancelDeployment", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("clean-queues")
		.description("Clean Queues")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.cleanQueues", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("clear-deployments")
		.description("Clear Deployments")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.clearDeployments", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--sourceType <value>", "Source Type (one of: github, docker, git, gitlab, bitbucket, gitea, drop)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.create", "post", options, { required: ["name","environmentId"], types: {"description":"string?","serverId":"string?"}, enums: {"sourceType":["github","docker","git","gitlab","bitbucket","gitea","drop"]} }),
		);
	g_application
		.command("delete")
		.description("Delete")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.delete", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("deploy")
		.description("Deploy")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--title <value>", "Title")
		.option("--description <value>", "Description")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.deploy", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("deploy-nginx-quickstart")
		.description("Deploy Nginx Quickstart")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.deployNginxQuickstart", "post", options, { required: ["environmentId"] }),
		);
	g_application
		.command("disconnect-git-provider")
		.description("Disconnect Git Provider")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.disconnectGitProvider", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("drop-deployment")
		.description("Drop Deployment")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.dropDeployment", "post", options),
		);
	g_application
		.command("kill-build")
		.description("Kill Build")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.killBuild", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("mark-running")
		.description("Mark Running")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.markRunning", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("move")
		.description("Move")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.move", "post", options, { required: ["applicationId","targetEnvironmentId"] }),
		);
	g_application
		.command("one")
		.description("One")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.one", "get", options, { required: ["applicationId"] }),
		);
	g_application
		.command("read-app-monitoring")
		.description("Read App Monitoring")
		.option("--appName <value>", "App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.readAppMonitoring", "get", options, { required: ["appName"] }),
		);
	g_application
		.command("read-logs")
		.description("Read Logs")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.readLogs", "get", options, { required: ["applicationId"], types: {"tail":"number"} }),
		);
	g_application
		.command("read-traefik-config")
		.description("Read Traefik Config")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.readTraefikConfig", "get", options, { required: ["applicationId"] }),
		);
	g_application
		.command("redeploy")
		.description("Redeploy")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--title <value>", "Title")
		.option("--description <value>", "Description")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.redeploy", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("refresh-token")
		.description("Refresh Token")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.refreshToken", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("reload")
		.description("Reload")
		.option("--appName <value>", "App Name [required]")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.reload", "post", options, { required: ["appName","applicationId"] }),
		);
	g_application
		.command("save-bitbucket-provider")
		.description("Save Bitbucket Provider")
		.option("--bitbucketBuildPath <value>", "Bitbucket Build Path [required] (nullable: pass \"null\")")
		.option("--bitbucketOwner <value>", "Bitbucket Owner [required] (nullable: pass \"null\")")
		.option("--bitbucketRepository <value>", "Bitbucket Repository [required] (nullable: pass \"null\")")
		.option("--bitbucketRepositorySlug <value>", "Bitbucket Repository Slug [required] (nullable: pass \"null\")")
		.option("--bitbucketId <value>", "Bitbucket Id [required] (nullable: pass \"null\")")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--bitbucketBranch <value>", "Bitbucket Branch [required]")
		.option("--enableSubmodules [boolean]", "Enable Submodules")
		.option("--no-enableSubmodules", "Set enableSubmodules to false")
		.option("--watchPaths <json>", "Watch Paths (nullable: pass \"null\") (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveBitbucketProvider", "post", options, { required: ["bitbucketBuildPath","bitbucketOwner","bitbucketRepository","bitbucketRepositorySlug","bitbucketId","applicationId","bitbucketBranch"], types: {"bitbucketBuildPath":"string?","bitbucketId":"string?","bitbucketOwner":"string?","bitbucketRepository":"string?","bitbucketRepositorySlug":"string?","enableSubmodules":"boolean","watchPaths":"array?"} }),
		);
	g_application
		.command("save-build-type")
		.description("Save Build Type")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--buildType <value>", "Build Type [required] (one of: dockerfile, heroku_buildpacks, paketo_buildpacks, nixpacks, static, railpack)")
		.option("--dockerfile <value>", "Dockerfile [required] (nullable: pass \"null\")")
		.option("--dockerContextPath <value>", "Docker Context Path [required] (nullable: pass \"null\")")
		.option("--dockerBuildStage <value>", "Docker Build Stage [required] (nullable: pass \"null\")")
		.option("--herokuVersion <value>", "Heroku Version [required] (nullable: pass \"null\")")
		.option("--railpackVersion <value>", "Railpack Version [required] (nullable: pass \"null\")")
		.option("--publishDirectory <value>", "Publish Directory (nullable: pass \"null\")")
		.option("--isStaticSpa [boolean]", "Is Static Spa (nullable: pass \"null\")")
		.option("--no-isStaticSpa", "Set isStaticSpa to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveBuildType", "post", options, { required: ["applicationId","buildType","dockerfile","dockerContextPath","dockerBuildStage","herokuVersion","railpackVersion"], types: {"dockerBuildStage":"string?","dockerContextPath":"string?","dockerfile":"string?","herokuVersion":"string?","isStaticSpa":"boolean?","publishDirectory":"string?","railpackVersion":"string?"}, enums: {"buildType":["dockerfile","heroku_buildpacks","paketo_buildpacks","nixpacks","static","railpack"]} }),
		);
	g_application
		.command("save-docker-provider")
		.description("Save Docker Provider")
		.option("--dockerImage <value>", "Docker Image [required] (nullable: pass \"null\")")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--username <value>", "Username [required] (nullable: pass \"null\")")
		.option("--password <value>", "Password [required] (nullable: pass \"null\")")
		.option("--registryUrl <value>", "Registry Url [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveDockerProvider", "post", options, { required: ["dockerImage","applicationId","username","password","registryUrl"], types: {"dockerImage":"string?","password":"string?","registryUrl":"string?","username":"string?"} }),
		);
	g_application
		.command("save-environment")
		.description("Save Environment")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--buildArgs <value>", "Build Args [required] (nullable: pass \"null\")")
		.option("--buildSecrets <value>", "Build Secrets [required] (nullable: pass \"null\")")
		.option("--createEnvFile [boolean]", "Create Env File [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveEnvironment", "post", options, { required: ["applicationId","env","buildArgs","buildSecrets","createEnvFile"], types: {"buildArgs":"string?","buildSecrets":"string?","createEnvFile":"boolean","env":"string?"} }),
		);
	g_application
		.command("save-gitea-provider")
		.description("Save Gitea Provider")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--giteaBuildPath <value>", "Gitea Build Path [required] (nullable: pass \"null\")")
		.option("--giteaOwner <value>", "Gitea Owner [required] (nullable: pass \"null\")")
		.option("--giteaRepository <value>", "Gitea Repository [required] (nullable: pass \"null\")")
		.option("--giteaId <value>", "Gitea Id [required] (nullable: pass \"null\")")
		.option("--giteaBranch <value>", "Gitea Branch [required]")
		.option("--enableSubmodules [boolean]", "Enable Submodules")
		.option("--no-enableSubmodules", "Set enableSubmodules to false")
		.option("--watchPaths <json>", "Watch Paths (nullable: pass \"null\") (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveGiteaProvider", "post", options, { required: ["applicationId","giteaBuildPath","giteaOwner","giteaRepository","giteaId","giteaBranch"], types: {"enableSubmodules":"boolean","giteaBuildPath":"string?","giteaId":"string?","giteaOwner":"string?","giteaRepository":"string?","watchPaths":"array?"} }),
		);
	g_application
		.command("save-github-provider")
		.description("Save Github Provider")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--repository <value>", "Repository [required] (nullable: pass \"null\")")
		.option("--owner <value>", "Owner [required] (nullable: pass \"null\")")
		.option("--buildPath <value>", "Build Path [required] (nullable: pass \"null\")")
		.option("--githubId <value>", "Github Id [required] (nullable: pass \"null\")")
		.option("--branch <value>", "Branch [required]")
		.option("--triggerType <value>", "Trigger Type [required] (one of: push, tag) (default: \"push\")")
		.option("--enableSubmodules [boolean]", "Enable Submodules")
		.option("--no-enableSubmodules", "Set enableSubmodules to false")
		.option("--watchPaths <json>", "Watch Paths (nullable: pass \"null\") (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveGithubProvider", "post", options, { required: ["applicationId","repository","owner","buildPath","githubId","branch","triggerType"], types: {"buildPath":"string?","enableSubmodules":"boolean","githubId":"string?","owner":"string?","repository":"string?","watchPaths":"array?"}, enums: {"triggerType":["push","tag"]} }),
		);
	g_application
		.command("save-gitlab-provider")
		.description("Save Gitlab Provider")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--gitlabBuildPath <value>", "Gitlab Build Path [required] (nullable: pass \"null\")")
		.option("--gitlabOwner <value>", "Gitlab Owner [required] (nullable: pass \"null\")")
		.option("--gitlabRepository <value>", "Gitlab Repository [required] (nullable: pass \"null\")")
		.option("--gitlabId <value>", "Gitlab Id [required] (nullable: pass \"null\")")
		.option("--gitlabProjectId <value>", "Gitlab Project Id [required] (nullable: pass \"null\")")
		.option("--gitlabPathNamespace <value>", "Gitlab Path Namespace [required] (nullable: pass \"null\")")
		.option("--gitlabBranch <value>", "Gitlab Branch [required]")
		.option("--enableSubmodules [boolean]", "Enable Submodules")
		.option("--no-enableSubmodules", "Set enableSubmodules to false")
		.option("--watchPaths <json>", "Watch Paths (nullable: pass \"null\") (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveGitlabProvider", "post", options, { required: ["applicationId","gitlabBuildPath","gitlabOwner","gitlabRepository","gitlabId","gitlabProjectId","gitlabPathNamespace","gitlabBranch"], types: {"enableSubmodules":"boolean","gitlabBuildPath":"string?","gitlabId":"string?","gitlabOwner":"string?","gitlabPathNamespace":"string?","gitlabProjectId":"number?","gitlabRepository":"string?","watchPaths":"array?"} }),
		);
	g_application
		.command("save-git-provider")
		.description("Save Git Provider")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--customGitBuildPath <value>", "Custom Git Build Path [required] (nullable: pass \"null\")")
		.option("--customGitUrl <value>", "Custom Git Url [required] (nullable: pass \"null\")")
		.option("--watchPaths <json>", "Watch Paths [required] (nullable: pass \"null\") (JSON array)")
		.option("--enableSubmodules [boolean]", "Enable Submodules")
		.option("--no-enableSubmodules", "Set enableSubmodules to false")
		.option("--customGitBranch <value>", "Custom Git Branch [required]")
		.option("--customGitSSHKeyId <value>", "Custom Git SSHKey Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.saveGitProvider", "post", options, { required: ["applicationId","customGitBuildPath","customGitUrl","watchPaths","customGitBranch"], types: {"customGitBuildPath":"string?","customGitSSHKeyId":"string?","customGitUrl":"string?","enableSubmodules":"boolean","watchPaths":"array?"} }),
		);
	g_application
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description")
		.option("--repository <value>", "Repository")
		.option("--owner <value>", "Owner")
		.option("--dockerImage <value>", "Docker Image")
		.option("--projectId <value>", "Project Id")
		.option("--environmentId <value>", "Environment Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_application
		.command("start")
		.description("Start")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.start", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("stop")
		.description("Stop")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.stop", "post", options, { required: ["applicationId"] }),
		);
	g_application
		.command("update")
		.description("Update")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--previewEnv <value>", "Preview Env (nullable: pass \"null\")")
		.option("--watchPaths <json>", "Watch Paths (nullable: pass \"null\") (JSON array)")
		.option("--previewBuildArgs <value>", "Preview Build Args (nullable: pass \"null\")")
		.option("--previewBuildSecrets <value>", "Preview Build Secrets (nullable: pass \"null\")")
		.option("--previewLabels <json>", "Preview Labels (nullable: pass \"null\") (JSON array)")
		.option("--previewWildcard <value>", "Preview Wildcard (nullable: pass \"null\")")
		.option("--previewPort <value>", "Preview Port (nullable: pass \"null\")")
		.option("--previewHttps [boolean]", "Preview Https")
		.option("--no-previewHttps", "Set previewHttps to false")
		.option("--previewPath <value>", "Preview Path (nullable: pass \"null\")")
		.option("--previewCertificateType <value>", "Preview Certificate Type (one of: letsencrypt, none, custom)")
		.option("--previewCustomCertResolver <value>", "Preview Custom Cert Resolver (nullable: pass \"null\")")
		.option("--previewLimit <value>", "Preview Limit (nullable: pass \"null\")")
		.option("--isPreviewDeploymentsActive [boolean]", "Is Preview Deployments Active (nullable: pass \"null\")")
		.option("--no-isPreviewDeploymentsActive", "Set isPreviewDeploymentsActive to false")
		.option("--previewRequireCollaboratorPermissions [boolean]", "Preview Require Collaborator Permissions (nullable: pass \"null\")")
		.option("--no-previewRequireCollaboratorPermissions", "Set previewRequireCollaboratorPermissions to false")
		.option("--rollbackActive [boolean]", "Rollback Active (nullable: pass \"null\")")
		.option("--no-rollbackActive", "Set rollbackActive to false")
		.option("--buildArgs <value>", "Build Args (nullable: pass \"null\")")
		.option("--buildSecrets <value>", "Build Secrets (nullable: pass \"null\")")
		.option("--memoryReservation <value>", "Memory Reservation (nullable: pass \"null\")")
		.option("--memoryLimit <value>", "Memory Limit (nullable: pass \"null\")")
		.option("--cpuReservation <value>", "Cpu Reservation (nullable: pass \"null\")")
		.option("--cpuLimit <value>", "Cpu Limit (nullable: pass \"null\")")
		.option("--title <value>", "Title (nullable: pass \"null\")")
		.option("--enabled [boolean]", "Enabled (nullable: pass \"null\")")
		.option("--no-enabled", "Set enabled to false")
		.option("--subtitle <value>", "Subtitle (nullable: pass \"null\")")
		.option("--command <value>", "Command (nullable: pass \"null\")")
		.option("--args <json>", "Args (nullable: pass \"null\") (JSON array)")
		.option("--icon <value>", "Icon (nullable: pass \"null\")")
		.option("--refreshToken <value>", "Refresh Token (nullable: pass \"null\")")
		.option("--sourceType <value>", "Source Type (one of: github, docker, git, gitlab, bitbucket, gitea, drop)")
		.option("--cleanCache [boolean]", "Clean Cache (nullable: pass \"null\")")
		.option("--no-cleanCache", "Set cleanCache to false")
		.option("--repository <value>", "Repository (nullable: pass \"null\")")
		.option("--owner <value>", "Owner (nullable: pass \"null\")")
		.option("--branch <value>", "Branch (nullable: pass \"null\")")
		.option("--buildPath <value>", "Build Path (nullable: pass \"null\")")
		.option("--triggerType <value>", "Trigger Type (one of: push, tag) (nullable: pass \"null\")")
		.option("--autoDeploy [boolean]", "Auto Deploy (nullable: pass \"null\")")
		.option("--no-autoDeploy", "Set autoDeploy to false")
		.option("--gitlabProjectId <value>", "Gitlab Project Id (nullable: pass \"null\")")
		.option("--gitlabRepository <value>", "Gitlab Repository (nullable: pass \"null\")")
		.option("--gitlabOwner <value>", "Gitlab Owner (nullable: pass \"null\")")
		.option("--gitlabBranch <value>", "Gitlab Branch (nullable: pass \"null\")")
		.option("--gitlabBuildPath <value>", "Gitlab Build Path (nullable: pass \"null\")")
		.option("--gitlabPathNamespace <value>", "Gitlab Path Namespace (nullable: pass \"null\")")
		.option("--giteaRepository <value>", "Gitea Repository (nullable: pass \"null\")")
		.option("--giteaOwner <value>", "Gitea Owner (nullable: pass \"null\")")
		.option("--giteaBranch <value>", "Gitea Branch (nullable: pass \"null\")")
		.option("--giteaBuildPath <value>", "Gitea Build Path (nullable: pass \"null\")")
		.option("--bitbucketRepository <value>", "Bitbucket Repository (nullable: pass \"null\")")
		.option("--bitbucketRepositorySlug <value>", "Bitbucket Repository Slug (nullable: pass \"null\")")
		.option("--bitbucketOwner <value>", "Bitbucket Owner (nullable: pass \"null\")")
		.option("--bitbucketBranch <value>", "Bitbucket Branch (nullable: pass \"null\")")
		.option("--bitbucketBuildPath <value>", "Bitbucket Build Path (nullable: pass \"null\")")
		.option("--username <value>", "Username (nullable: pass \"null\")")
		.option("--password <value>", "Password (nullable: pass \"null\")")
		.option("--dockerImage <value>", "Docker Image (nullable: pass \"null\")")
		.option("--registryUrl <value>", "Registry Url (nullable: pass \"null\")")
		.option("--customGitUrl <value>", "Custom Git Url (nullable: pass \"null\")")
		.option("--customGitBranch <value>", "Custom Git Branch (nullable: pass \"null\")")
		.option("--customGitBuildPath <value>", "Custom Git Build Path (nullable: pass \"null\")")
		.option("--customGitSSHKeyId <value>", "Custom Git SSHKey Id (nullable: pass \"null\")")
		.option("--enableSubmodules [boolean]", "Enable Submodules")
		.option("--no-enableSubmodules", "Set enableSubmodules to false")
		.option("--dockerfile <value>", "Dockerfile (nullable: pass \"null\")")
		.option("--dockerContextPath <value>", "Docker Context Path (nullable: pass \"null\")")
		.option("--dockerBuildStage <value>", "Docker Build Stage (nullable: pass \"null\")")
		.option("--dropBuildPath <value>", "Drop Build Path (nullable: pass \"null\")")
		.option("--healthCheckSwarm <json>", "Health Check Swarm (nullable: pass \"null\") (JSON object)")
		.option("--restartPolicySwarm <json>", "Restart Policy Swarm (nullable: pass \"null\") (JSON object)")
		.option("--placementSwarm <json>", "Placement Swarm (nullable: pass \"null\") (JSON object)")
		.option("--updateConfigSwarm <json>", "Update Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--rollbackConfigSwarm <json>", "Rollback Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--modeSwarm <json>", "Mode Swarm (nullable: pass \"null\") (JSON object)")
		.option("--labelsSwarm <json>", "Labels Swarm (nullable: pass \"null\") (JSON object)")
		.option("--networkSwarm <json>", "Network Swarm (nullable: pass \"null\") (JSON array)")
		.option("--stopGracePeriodSwarm <value>", "Stop Grace Period Swarm (nullable: pass \"null\")")
		.option("--endpointSpecSwarm <json>", "Endpoint Spec Swarm (nullable: pass \"null\") (JSON object)")
		.option("--ulimitsSwarm <json>", "Ulimits Swarm (nullable: pass \"null\") (JSON array)")
		.option("--replicas <value>", "Replicas")
		.option("--applicationStatus <value>", "Application Status (one of: idle, running, done, error)")
		.option("--buildType <value>", "Build Type (one of: dockerfile, heroku_buildpacks, paketo_buildpacks, nixpacks, static, railpack)")
		.option("--railpackVersion <value>", "Railpack Version (nullable: pass \"null\")")
		.option("--herokuVersion <value>", "Heroku Version (nullable: pass \"null\")")
		.option("--publishDirectory <value>", "Publish Directory (nullable: pass \"null\")")
		.option("--isStaticSpa [boolean]", "Is Static Spa (nullable: pass \"null\")")
		.option("--no-isStaticSpa", "Set isStaticSpa to false")
		.option("--createEnvFile [boolean]", "Create Env File")
		.option("--no-createEnvFile", "Set createEnvFile to false")
		.option("--createdAt <value>", "Created At")
		.option("--registryId <value>", "Registry Id (nullable: pass \"null\")")
		.option("--rollbackRegistryId <value>", "Rollback Registry Id (nullable: pass \"null\")")
		.option("--environmentId <value>", "Environment Id")
		.option("--githubId <value>", "Github Id (nullable: pass \"null\")")
		.option("--gitlabId <value>", "Gitlab Id (nullable: pass \"null\")")
		.option("--giteaId <value>", "Gitea Id (nullable: pass \"null\")")
		.option("--bitbucketId <value>", "Bitbucket Id (nullable: pass \"null\")")
		.option("--buildServerId <value>", "Build Server Id (nullable: pass \"null\")")
		.option("--buildRegistryId <value>", "Build Registry Id (nullable: pass \"null\")")
		.option("--networkIds <json>", "Network Ids (nullable: pass \"null\") (JSON array)")
		.option("--detachNotployNetwork [boolean]", "Detach Notploy Network")
		.option("--no-detachNotployNetwork", "Set detachNotployNetwork to false")
		.option("--isolatedNetwork [boolean]", "Isolated Network")
		.option("--no-isolatedNetwork", "Set isolatedNetwork to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.update", "post", options, { required: ["applicationId"], types: {"args":"array?","autoDeploy":"boolean?","bitbucketBranch":"string?","bitbucketBuildPath":"string?","bitbucketId":"string?","bitbucketOwner":"string?","bitbucketRepository":"string?","bitbucketRepositorySlug":"string?","branch":"string?","buildArgs":"string?","buildPath":"string?","buildRegistryId":"string?","buildSecrets":"string?","buildServerId":"string?","cleanCache":"boolean?","command":"string?","cpuLimit":"string?","cpuReservation":"string?","createEnvFile":"boolean","customGitBranch":"string?","customGitBuildPath":"string?","customGitSSHKeyId":"string?","customGitUrl":"string?","description":"string?","detachNotployNetwork":"boolean","dockerBuildStage":"string?","dockerContextPath":"string?","dockerfile":"string?","dockerImage":"string?","dropBuildPath":"string?","enabled":"boolean?","enableSubmodules":"boolean","endpointSpecSwarm":"object?","env":"string?","giteaBranch":"string?","giteaBuildPath":"string?","giteaId":"string?","giteaOwner":"string?","giteaRepository":"string?","githubId":"string?","gitlabBranch":"string?","gitlabBuildPath":"string?","gitlabId":"string?","gitlabOwner":"string?","gitlabPathNamespace":"string?","gitlabProjectId":"number?","gitlabRepository":"string?","healthCheckSwarm":"object?","herokuVersion":"string?","icon":"string?","isolatedNetwork":"boolean","isPreviewDeploymentsActive":"boolean?","isStaticSpa":"boolean?","labelsSwarm":"object?","memoryLimit":"string?","memoryReservation":"string?","modeSwarm":"object?","networkIds":"array?","networkSwarm":"array?","owner":"string?","password":"string?","placementSwarm":"object?","previewBuildArgs":"string?","previewBuildSecrets":"string?","previewCustomCertResolver":"string?","previewEnv":"string?","previewHttps":"boolean","previewLabels":"array?","previewLimit":"number?","previewPath":"string?","previewPort":"number?","previewRequireCollaboratorPermissions":"boolean?","previewWildcard":"string?","publishDirectory":"string?","railpackVersion":"string?","refreshToken":"string?","registryId":"string?","registryUrl":"string?","replicas":"number","repository":"string?","restartPolicySwarm":"object?","rollbackActive":"boolean?","rollbackConfigSwarm":"object?","rollbackRegistryId":"string?","stopGracePeriodSwarm":"number?","subtitle":"string?","title":"string?","triggerType":"string?","ulimitsSwarm":"array?","updateConfigSwarm":"object?","username":"string?","watchPaths":"array?"}, enums: {"applicationStatus":["idle","running","done","error"],"buildType":["dockerfile","heroku_buildpacks","paketo_buildpacks","nixpacks","static","railpack"],"previewCertificateType":["letsencrypt","none","custom"],"sourceType":["github","docker","git","gitlab","bitbucket","gitea","drop"],"triggerType":["push","tag"]} }),
		);
	g_application
		.command("update-traefik-config")
		.description("Update Traefik Config")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--traefikConfig <value>", "Traefik Config [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "application.updateTraefikConfig", "post", options, { required: ["applicationId","traefikConfig"] }),
		);
	const g_auditLog = program.command("audit-log").description("auditLog commands");
	g_auditLog
		.command("all")
		.description("All")
		.option("--search <value>", "Search")
		.option("--userId <value>", "User Id")
		.option("--userEmail <value>", "User Email")
		.option("--resourceName <value>", "Resource Name")
		.option("--action <value>", "Action (one of: create, update, delete, read, deploy, cancel, redeploy, login, logout, restore, run, start, stop, reload, rebuild, move)")
		.option("--resourceType <value>", "Resource Type (one of: project, service, environment, deployment, user, customRole, domain, certificate, registry, server, sshKey, gitProvider, destination, notification, settings, session, port, redirect, security, schedule, backup, volumeBackup, docker, swarm, previewDeployment, organization, cluster, mount, application, compose, network, vaultProvider, dnsProvider, objectStorage)")
		.option("--from <value>", "From")
		.option("--to <value>", "To")
		.option("--sortOrder <value>", "Sort Order (one of: asc, desc) (default: \"desc\")")
		.option("--limit <value>", "Limit (default: 50)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "auditLog.all", "get", options, { types: {"limit":"number","offset":"number"}, enums: {"action":["create","update","delete","read","deploy","cancel","redeploy","login","logout","restore","run","start","stop","reload","rebuild","move"],"resourceType":["project","service","environment","deployment","user","customRole","domain","certificate","registry","server","sshKey","gitProvider","destination","notification","settings","session","port","redirect","security","schedule","backup","volumeBackup","docker","swarm","previewDeployment","organization","cluster","mount","application","compose","network","vaultProvider","dnsProvider","objectStorage"],"sortOrder":["asc","desc"]} }),
		);
	const g_backup = program.command("backup").description("backup commands");
	g_backup
		.command("create")
		.description("Create")
		.option("--schedule <value>", "Schedule [required]")
		.option("--enabled [boolean]", "Enabled (nullable: pass \"null\")")
		.option("--no-enabled", "Set enabled to false")
		.option("--prefix <value>", "Prefix [required]")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--keepLatestCount <value>", "Keep Latest Count (nullable: pass \"null\")")
		.option("--database <value>", "Database [required]")
		.option("--mariadbId <value>", "Mariadb Id (nullable: pass \"null\")")
		.option("--mysqlId <value>", "Mysql Id (nullable: pass \"null\")")
		.option("--postgresId <value>", "Postgres Id (nullable: pass \"null\")")
		.option("--mongoId <value>", "Mongo Id (nullable: pass \"null\")")
		.option("--libsqlId <value>", "Libsql Id (nullable: pass \"null\")")
		.option("--databaseType <value>", "Database Type [required] (one of: postgres, mariadb, mysql, mongo, web-server, libsql)")
		.option("--userId <value>", "User Id (nullable: pass \"null\")")
		.option("--backupType <value>", "Backup Type (one of: database, compose)")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--serviceName <value>", "Service Name (nullable: pass \"null\")")
		.option("--includeEncryptionKey [boolean]", "Include Encryption Key")
		.option("--no-includeEncryptionKey", "Set includeEncryptionKey to false")
		.option("--metadata <json>", "Metadata (nullable: pass \"null\") (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.create", "post", options, { required: ["schedule","prefix","destinationId","database","databaseType"], types: {"composeId":"string?","enabled":"boolean?","includeEncryptionKey":"boolean","keepLatestCount":"number?","libsqlId":"string?","mariadbId":"string?","metadata":"object?","mongoId":"string?","mysqlId":"string?","postgresId":"string?","serviceName":"string?","userId":"string?"}, enums: {"backupType":["database","compose"],"databaseType":["postgres","mariadb","mysql","mongo","web-server","libsql"]} }),
		);
	g_backup
		.command("list-backup-files")
		.description("List Backup Files")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--search <value>", "Search [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.listBackupFiles", "get", options, { required: ["destinationId","search"] }),
		);
	g_backup
		.command("manual-backup-compose")
		.description("Manual Backup Compose")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.manualBackupCompose", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("manual-backup-libsql")
		.description("Manual Backup Libsql")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.manualBackupLibsql", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("manual-backup-mariadb")
		.description("Manual Backup Mariadb")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.manualBackupMariadb", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("manual-backup-mongo")
		.description("Manual Backup Mongo")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.manualBackupMongo", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("manual-backup-my-sql")
		.description("Manual Backup My Sql")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.manualBackupMySql", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("manual-backup-postgres")
		.description("Manual Backup Postgres")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.manualBackupPostgres", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("manual-backup-web-server")
		.description("Manual Backup Web Server")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.manualBackupWebServer", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("one")
		.description("One")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.one", "get", options, { required: ["backupId"] }),
		);
	g_backup
		.command("remove")
		.description("Remove")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.remove", "post", options, { required: ["backupId"] }),
		);
	g_backup
		.command("update")
		.description("Update")
		.option("--schedule <value>", "Schedule [required]")
		.option("--enabled [boolean]", "Enabled [required] (nullable: pass \"null\")")
		.option("--prefix <value>", "Prefix [required]")
		.option("--backupId <value>", "Backup Id [required]")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--database <value>", "Database [required]")
		.option("--keepLatestCount <value>", "Keep Latest Count [required] (nullable: pass \"null\")")
		.option("--serviceName <value>", "Service Name [required] (nullable: pass \"null\")")
		.option("--metadata <json>", "Metadata [required] (nullable: pass \"null\") (JSON object)")
		.option("--databaseType <value>", "Database Type [required] (one of: postgres, mariadb, mysql, mongo, web-server, libsql)")
		.option("--includeEncryptionKey [boolean]", "Include Encryption Key")
		.option("--no-includeEncryptionKey", "Set includeEncryptionKey to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "backup.update", "post", options, { required: ["schedule","enabled","prefix","backupId","destinationId","database","keepLatestCount","serviceName","metadata","databaseType"], types: {"enabled":"boolean?","includeEncryptionKey":"boolean","keepLatestCount":"number?","metadata":"object?","serviceName":"string?"}, enums: {"databaseType":["postgres","mariadb","mysql","mongo","web-server","libsql"]} }),
		);
	const g_bitbucket = program.command("bitbucket").description("bitbucket commands");
	g_bitbucket
		.command("bitbucket-providers")
		.description("Bitbucket Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "bitbucket.bitbucketProviders", "get", options),
		);
	g_bitbucket
		.command("create")
		.description("Create")
		.option("--bitbucketId <value>", "Bitbucket Id")
		.option("--bitbucketUsername <value>", "Bitbucket Username")
		.option("--bitbucketEmail <value>", "Bitbucket Email")
		.option("--appPassword <value>", "App Password")
		.option("--apiToken <value>", "Api Token")
		.option("--bitbucketWorkspaceName <value>", "Bitbucket Workspace Name")
		.option("--gitProviderId <value>", "Git Provider Id")
		.option("--authId <value>", "Auth Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "bitbucket.create", "post", options, { required: ["authId","name"] }),
		);
	g_bitbucket
		.command("get-bitbucket-branches")
		.description("Get Bitbucket Branches")
		.option("--owner <value>", "Owner [required]")
		.option("--repo <value>", "Repo [required]")
		.option("--bitbucketId <value>", "Bitbucket Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "bitbucket.getBitbucketBranches", "get", options, { required: ["owner","repo"] }),
		);
	g_bitbucket
		.command("get-bitbucket-repositories")
		.description("Get Bitbucket Repositories")
		.option("--bitbucketId <value>", "Bitbucket Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "bitbucket.getBitbucketRepositories", "get", options, { required: ["bitbucketId"] }),
		);
	g_bitbucket
		.command("one")
		.description("One")
		.option("--bitbucketId <value>", "Bitbucket Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "bitbucket.one", "get", options, { required: ["bitbucketId"] }),
		);
	g_bitbucket
		.command("test-connection")
		.description("Test Connection")
		.option("--bitbucketId <value>", "Bitbucket Id [required]")
		.option("--bitbucketUsername <value>", "Bitbucket Username")
		.option("--bitbucketEmail <value>", "Bitbucket Email")
		.option("--workspaceName <value>", "Workspace Name")
		.option("--apiToken <value>", "Api Token")
		.option("--appPassword <value>", "App Password")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "bitbucket.testConnection", "post", options, { required: ["bitbucketId"] }),
		);
	g_bitbucket
		.command("update")
		.description("Update")
		.option("--bitbucketId <value>", "Bitbucket Id [required]")
		.option("--bitbucketUsername <value>", "Bitbucket Username")
		.option("--bitbucketEmail <value>", "Bitbucket Email")
		.option("--appPassword <value>", "App Password")
		.option("--apiToken <value>", "Api Token")
		.option("--bitbucketWorkspaceName <value>", "Bitbucket Workspace Name")
		.option("--gitProviderId <value>", "Git Provider Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "bitbucket.update", "post", options, { required: ["bitbucketId","gitProviderId","name"] }),
		);
	const g_certificates = program.command("certificates").description("certificates commands");
	g_certificates
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.all", "get", options),
		);
	g_certificates
		.command("chain")
		.description("Chain")
		.option("--certificateId <value>", "Certificate Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.chain", "get", options, { required: ["certificateId"] }),
		);
	g_certificates
		.command("covers")
		.description("Covers")
		.option("--certificateId <value>", "Certificate Id [required]")
		.option("--hostname <value>", "Hostname [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.covers", "get", options, { required: ["certificateId","hostname"] }),
		);
	g_certificates
		.command("create")
		.description("Create")
		.option("--certificateId <value>", "Certificate Id")
		.option("--name <value>", "Name [required]")
		.option("--certificateData <value>", "Certificate Data [required]")
		.option("--privateKey <value>", "Private Key [required]")
		.option("--certificatePath <value>", "Certificate Path")
		.option("--autoRenew [boolean]", "Auto Renew (nullable: pass \"null\")")
		.option("--no-autoRenew", "Set autoRenew to false")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.create", "post", options, { required: ["name","certificateData","privateKey"], types: {"autoRenew":"boolean?","serverId":"string?"} }),
		);
	g_certificates
		.command("one")
		.description("One")
		.option("--certificateId <value>", "Certificate Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.one", "get", options, { required: ["certificateId"] }),
		);
	g_certificates
		.command("remove")
		.description("Remove")
		.option("--certificateId <value>", "Certificate Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.remove", "post", options, { required: ["certificateId"] }),
		);
	g_certificates
		.command("update")
		.description("Update")
		.option("--certificateId <value>", "Certificate Id [required]")
		.option("--name <value>", "Name")
		.option("--certificateData <value>", "Certificate Data")
		.option("--privateKey <value>", "Private Key")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.update", "post", options, { required: ["certificateId"] }),
		);
	g_certificates
		.command("validate")
		.description("Validate")
		.option("--certificateData <value>", "Certificate Data [required]")
		.option("--privateKey <value>", "Private Key [required]")
		.option("--requiredHostnames <json>", "Required Hostnames (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "certificates.validate", "post", options, { required: ["certificateData","privateKey"], types: {"requiredHostnames":"array"} }),
		);
	const g_cluster = program.command("cluster").description("cluster commands");
	g_cluster
		.command("add-manager")
		.description("Add Manager")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "cluster.addManager", "get", options),
		);
	g_cluster
		.command("add-worker")
		.description("Add Worker")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "cluster.addWorker", "get", options),
		);
	g_cluster
		.command("get-nodes")
		.description("Get Nodes")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "cluster.getNodes", "get", options),
		);
	g_cluster
		.command("remove-worker")
		.description("Remove Worker")
		.option("--nodeId <value>", "Node Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "cluster.removeWorker", "post", options, { required: ["nodeId"] }),
		);
	const g_community = program.command("community").description("community commands");
	g_community
		.command("activity")
		.description("Activity")
		.option("--preset <value>", "Preset (one of: 24h, 7d, 30d, 90d, custom) (default: \"30d\")")
		.option("--from <value>", "From")
		.option("--to <value>", "To")
		.option("--repositoryIds <json>", "Repository Ids (JSON array)")
		.option("--types <json>", "Types (JSON array)")
		.option("--limit <value>", "Limit (default: 30)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.activity", "get", options, { types: {"limit":"number","offset":"number","repositoryIds":"array","types":"array"}, enums: {"preset":["24h","7d","30d","90d","custom"]} }),
		);
	g_community
		.command("attention")
		.description("Attention")
		.option("--repositoryIds <json>", "Repository Ids (JSON array)")
		.option("--limit <value>", "Limit (default: 50)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.attention", "get", options, { types: {"limit":"number","repositoryIds":"array"} }),
		);
	g_community
		.command("available-repositories")
		.description("Available Repositories")
		.option("--sourceId <value>", "Source Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.availableRepositories", "get", options, { required: ["sourceId"] }),
		);
	g_community
		.command("create-source")
		.description("Create Source")
		.option("--gitProviderId <value>", "Git Provider Id [required]")
		.option("--owner <value>", "Owner [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.createSource", "post", options, { required: ["gitProviderId","owner"] }),
		);
	g_community
		.command("health")
		.description("Health")
		.option("--repositoryIds <json>", "Repository Ids (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.health", "get", options, { types: {"repositoryIds":"array"} }),
		);
	g_community
		.command("overview")
		.description("Overview")
		.option("--preset <value>", "Preset (one of: 24h, 7d, 30d, 90d, custom) (default: \"30d\")")
		.option("--from <value>", "From")
		.option("--to <value>", "To")
		.option("--repositoryIds <json>", "Repository Ids (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.overview", "get", options, { types: {"repositoryIds":"array"}, enums: {"preset":["24h","7d","30d","90d","custom"]} }),
		);
	g_community
		.command("releases")
		.description("Releases")
		.option("--repositoryIds <json>", "Repository Ids (JSON array)")
		.option("--limit <value>", "Limit (default: 10)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.releases", "get", options, { types: {"limit":"number","repositoryIds":"array"} }),
		);
	g_community
		.command("remove-source")
		.description("Remove Source")
		.option("--sourceId <value>", "Source Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.removeSource", "post", options, { required: ["sourceId"] }),
		);
	g_community
		.command("repositories")
		.description("Repositories")
		.option("--sourceId <value>", "Source Id")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.repositories", "get", options),
		);
	g_community
		.command("sources")
		.description("Sources")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.sources", "get", options),
		);
	g_community
		.command("sync-now")
		.description("Sync Now")
		.option("--sourceId <value>", "Source Id [required]")
		.option("--repositoryId <value>", "Repository Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.syncNow", "post", options, { required: ["sourceId"] }),
		);
	g_community
		.command("track-repository")
		.description("Track Repository")
		.option("--sourceId <value>", "Source Id [required]")
		.option("--fullName <value>", "Full Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.trackRepository", "post", options, { required: ["sourceId","fullName"] }),
		);
	g_community
		.command("untrack-repository")
		.description("Untrack Repository")
		.option("--repositoryId <value>", "Repository Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.untrackRepository", "post", options, { required: ["repositoryId"] }),
		);
	g_community
		.command("update-source")
		.description("Update Source")
		.option("--sourceId <value>", "Source Id [required]")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "community.updateSource", "post", options, { required: ["sourceId"], types: {"enabled":"boolean"} }),
		);
	const g_compose = program.command("compose").description("compose commands");
	g_compose
		.command("cancel-deployment")
		.description("Cancel Deployment")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.cancelDeployment", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("clean-queues")
		.description("Clean Queues")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.cleanQueues", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("clear-deployments")
		.description("Clear Deployments")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.clearDeployments", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--composeType <value>", "Compose Type (one of: docker-compose, stack)")
		.option("--appName <value>", "App Name")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--composeFile <value>", "Compose File")
		.option("--sourceType <value>", "Source Type (one of: git, github, gitlab, bitbucket, gitea, raw)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.create", "post", options, { required: ["name","environmentId"], types: {"description":"string?","serverId":"string?"}, enums: {"composeType":["docker-compose","stack"],"sourceType":["git","github","gitlab","bitbucket","gitea","raw"]} }),
		);
	g_compose
		.command("delete")
		.description("Delete")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--deleteVolumes [boolean]", "Delete Volumes [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.delete", "post", options, { required: ["composeId","deleteVolumes"], types: {"deleteVolumes":"boolean"} }),
		);
	g_compose
		.command("deploy")
		.description("Deploy")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--title <value>", "Title")
		.option("--description <value>", "Description")
		.option("--freshVolumes [boolean]", "Fresh Volumes")
		.option("--no-freshVolumes", "Set freshVolumes to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.deploy", "post", options, { required: ["composeId"], types: {"freshVolumes":"boolean"} }),
		);
	g_compose
		.command("deploy-template")
		.description("Deploy Template")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--id <value>", "Id [required]")
		.option("--baseUrl <value>", "Base Url")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.deployTemplate", "post", options, { required: ["environmentId","id"] }),
		);
	g_compose
		.command("disconnect-git-provider")
		.description("Disconnect Git Provider")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.disconnectGitProvider", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("fetch-source-type")
		.description("Fetch Source Type")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.fetchSourceType", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("get-converted-compose")
		.description("Get Converted Compose")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.getConvertedCompose", "get", options, { required: ["composeId"] }),
		);
	g_compose
		.command("get-default-command")
		.description("Get Default Command")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.getDefaultCommand", "get", options, { required: ["composeId"] }),
		);
	g_compose
		.command("get-tags")
		.description("Get Tags")
		.option("--baseUrl <value>", "Base Url")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.getTags", "get", options),
		);
	g_compose
		.command("import")
		.description("Import")
		.option("--base64 <value>", "Base64 [required]")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.import", "post", options, { required: ["base64","composeId"] }),
		);
	g_compose
		.command("isolated-deployment")
		.description("Isolated Deployment")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--suffix <value>", "Suffix")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.isolatedDeployment", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("kill-build")
		.description("Kill Build")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.killBuild", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("load-mounts-by-service")
		.description("Load Mounts By Service")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--serviceName <value>", "Service Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.loadMountsByService", "get", options, { required: ["composeId","serviceName"] }),
		);
	g_compose
		.command("load-services")
		.description("Load Services")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--type <value>", "Type (one of: fetch, cache) (default: \"cache\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.loadServices", "get", options, { required: ["composeId"], enums: {"type":["fetch","cache"]} }),
		);
	g_compose
		.command("move")
		.description("Move")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.move", "post", options, { required: ["composeId","targetEnvironmentId"] }),
		);
	g_compose
		.command("one")
		.description("One")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.one", "get", options, { required: ["composeId"] }),
		);
	g_compose
		.command("preview-template")
		.description("Preview Template")
		.option("--base64 <value>", "Base64 [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.previewTemplate", "post", options, { required: ["base64","appName"] }),
		);
	g_compose
		.command("process-template")
		.description("Process Template")
		.option("--base64 <value>", "Base64 [required]")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.processTemplate", "post", options, { required: ["base64","composeId"] }),
		);
	g_compose
		.command("randomize-compose")
		.description("Randomize Compose")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--suffix <value>", "Suffix")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.randomizeCompose", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("read-logs")
		.description("Read Logs")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--containerId <value>", "Container Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.readLogs", "get", options, { required: ["composeId","containerId"], types: {"tail":"number"} }),
		);
	g_compose
		.command("redeploy")
		.description("Redeploy")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--title <value>", "Title")
		.option("--description <value>", "Description")
		.option("--freshVolumes [boolean]", "Fresh Volumes")
		.option("--no-freshVolumes", "Set freshVolumes to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.redeploy", "post", options, { required: ["composeId"], types: {"freshVolumes":"boolean"} }),
		);
	g_compose
		.command("refresh-token")
		.description("Refresh Token")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.refreshToken", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("save-environment")
		.description("Save Environment")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--createEnvFile [boolean]", "Create Env File")
		.option("--no-createEnvFile", "Set createEnvFile to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.saveEnvironment", "post", options, { required: ["composeId","env"], types: {"createEnvFile":"boolean","env":"string?"} }),
		);
	g_compose
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--environmentId <value>", "Environment Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_compose
		.command("start")
		.description("Start")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.start", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("stop")
		.description("Stop")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.stop", "post", options, { required: ["composeId"] }),
		);
	g_compose
		.command("templates")
		.description("Templates")
		.option("--baseUrl <value>", "Base Url")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.templates", "get", options),
		);
	g_compose
		.command("update")
		.description("Update")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--composeFile <value>", "Compose File")
		.option("--refreshToken <value>", "Refresh Token (nullable: pass \"null\")")
		.option("--sourceType <value>", "Source Type (one of: git, github, gitlab, bitbucket, gitea, raw)")
		.option("--composeType <value>", "Compose Type (one of: docker-compose, stack)")
		.option("--repository <value>", "Repository (nullable: pass \"null\")")
		.option("--owner <value>", "Owner (nullable: pass \"null\")")
		.option("--branch <value>", "Branch (nullable: pass \"null\")")
		.option("--autoDeploy [boolean]", "Auto Deploy (nullable: pass \"null\")")
		.option("--no-autoDeploy", "Set autoDeploy to false")
		.option("--gitlabProjectId <value>", "Gitlab Project Id (nullable: pass \"null\")")
		.option("--gitlabRepository <value>", "Gitlab Repository (nullable: pass \"null\")")
		.option("--gitlabOwner <value>", "Gitlab Owner (nullable: pass \"null\")")
		.option("--gitlabBranch <value>", "Gitlab Branch (nullable: pass \"null\")")
		.option("--gitlabPathNamespace <value>", "Gitlab Path Namespace (nullable: pass \"null\")")
		.option("--bitbucketRepository <value>", "Bitbucket Repository (nullable: pass \"null\")")
		.option("--bitbucketRepositorySlug <value>", "Bitbucket Repository Slug (nullable: pass \"null\")")
		.option("--bitbucketOwner <value>", "Bitbucket Owner (nullable: pass \"null\")")
		.option("--bitbucketBranch <value>", "Bitbucket Branch (nullable: pass \"null\")")
		.option("--giteaRepository <value>", "Gitea Repository (nullable: pass \"null\")")
		.option("--giteaOwner <value>", "Gitea Owner (nullable: pass \"null\")")
		.option("--giteaBranch <value>", "Gitea Branch (nullable: pass \"null\")")
		.option("--customGitUrl <value>", "Custom Git Url (nullable: pass \"null\")")
		.option("--customGitBranch <value>", "Custom Git Branch (nullable: pass \"null\")")
		.option("--customGitSSHKeyId <value>", "Custom Git SSHKey Id (nullable: pass \"null\")")
		.option("--command <value>", "Command")
		.option("--createEnvFile [boolean]", "Create Env File")
		.option("--no-createEnvFile", "Set createEnvFile to false")
		.option("--enableSubmodules [boolean]", "Enable Submodules")
		.option("--no-enableSubmodules", "Set enableSubmodules to false")
		.option("--composePath <value>", "Compose Path")
		.option("--suffix <value>", "Suffix")
		.option("--randomize [boolean]", "Randomize")
		.option("--no-randomize", "Set randomize to false")
		.option("--isolatedDeployment [boolean]", "Isolated Deployment")
		.option("--no-isolatedDeployment", "Set isolatedDeployment to false")
		.option("--isolatedDeploymentsVolume [boolean]", "Isolated Deployments Volume")
		.option("--no-isolatedDeploymentsVolume", "Set isolatedDeploymentsVolume to false")
		.option("--pullImages [boolean]", "Pull Images")
		.option("--no-pullImages", "Set pullImages to false")
		.option("--triggerType <value>", "Trigger Type (one of: push, tag) (nullable: pass \"null\")")
		.option("--composeStatus <value>", "Compose Status (one of: idle, running, done, error)")
		.option("--icon <value>", "Icon (nullable: pass \"null\")")
		.option("--environmentId <value>", "Environment Id")
		.option("--createdAt <value>", "Created At")
		.option("--watchPaths <json>", "Watch Paths (nullable: pass \"null\") (JSON array)")
		.option("--githubId <value>", "Github Id (nullable: pass \"null\")")
		.option("--gitlabId <value>", "Gitlab Id (nullable: pass \"null\")")
		.option("--bitbucketId <value>", "Bitbucket Id (nullable: pass \"null\")")
		.option("--giteaId <value>", "Gitea Id (nullable: pass \"null\")")
		.option("--serviceNetworks <json>", "Service Networks (nullable: pass \"null\") (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "compose.update", "post", options, { required: ["composeId"], types: {"autoDeploy":"boolean?","bitbucketBranch":"string?","bitbucketId":"string?","bitbucketOwner":"string?","bitbucketRepository":"string?","bitbucketRepositorySlug":"string?","branch":"string?","createEnvFile":"boolean","customGitBranch":"string?","customGitSSHKeyId":"string?","customGitUrl":"string?","description":"string?","enableSubmodules":"boolean","env":"string?","giteaBranch":"string?","giteaId":"string?","giteaOwner":"string?","giteaRepository":"string?","githubId":"string?","gitlabBranch":"string?","gitlabId":"string?","gitlabOwner":"string?","gitlabPathNamespace":"string?","gitlabProjectId":"number?","gitlabRepository":"string?","icon":"string?","isolatedDeployment":"boolean","isolatedDeploymentsVolume":"boolean","owner":"string?","pullImages":"boolean","randomize":"boolean","refreshToken":"string?","repository":"string?","serviceNetworks":"array?","triggerType":"string?","watchPaths":"array?"}, enums: {"composeStatus":["idle","running","done","error"],"composeType":["docker-compose","stack"],"sourceType":["git","github","gitlab","bitbucket","gitea","raw"],"triggerType":["push","tag"]} }),
		);
	const g_customRole = program.command("custom-role").description("customRole commands");
	g_customRole
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "customRole.all", "get", options),
		);
	g_customRole
		.command("create")
		.description("Create")
		.option("--roleName <value>", "Role Name [required]")
		.option("--permissions <json>", "Permissions [required] (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "customRole.create", "post", options, { required: ["roleName","permissions"], types: {"permissions":"object"} }),
		);
	g_customRole
		.command("get-statements")
		.description("Get Statements")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "customRole.getStatements", "get", options),
		);
	g_customRole
		.command("members-by-role")
		.description("Members By Role")
		.option("--roleName <value>", "Role Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "customRole.membersByRole", "get", options, { required: ["roleName"] }),
		);
	g_customRole
		.command("remove")
		.description("Remove")
		.option("--roleName <value>", "Role Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "customRole.remove", "post", options, { required: ["roleName"] }),
		);
	g_customRole
		.command("update")
		.description("Update")
		.option("--roleName <value>", "Role Name [required]")
		.option("--newRoleName <value>", "New Role Name")
		.option("--permissions <json>", "Permissions [required] (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "customRole.update", "post", options, { required: ["roleName","permissions"], types: {"permissions":"object"} }),
		);
	const g_deployment = program.command("deployment").description("deployment commands");
	g_deployment
		.command("all")
		.description("All")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.all", "get", options, { required: ["applicationId"] }),
		);
	g_deployment
		.command("all-by-compose")
		.description("All By Compose")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.allByCompose", "get", options, { required: ["composeId"] }),
		);
	g_deployment
		.command("all-by-server")
		.description("All By Server")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.allByServer", "get", options, { required: ["serverId"] }),
		);
	g_deployment
		.command("all-by-type")
		.description("All By Type")
		.option("--id <value>", "Id [required]")
		.option("--type <value>", "Type [required] (one of: application, compose, server, schedule, previewDeployment, backup, volumeBackup)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.allByType", "get", options, { required: ["id","type"], enums: {"type":["application","compose","server","schedule","previewDeployment","backup","volumeBackup"]} }),
		);
	g_deployment
		.command("all-centralized")
		.description("All Centralized")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.allCentralized", "get", options),
		);
	g_deployment
		.command("centralized-page")
		.description("Centralized Page")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--limit <value>", "Limit (default: 25)")
		.option("--status <value>", "Status (one of: running, done, error, cancelled)")
		.option("--type <value>", "Type (one of: application, compose)")
		.option("--search <value>", "Search")
		.option("--sortOrder <value>", "Sort Order (one of: newest, oldest) (default: \"newest\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.centralizedPage", "get", options, { types: {"limit":"number","offset":"number"}, enums: {"sortOrder":["newest","oldest"],"status":["running","done","error","cancelled"],"type":["application","compose"]} }),
		);
	g_deployment
		.command("home-activity")
		.description("Home Activity")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.homeActivity", "get", options),
		);
	g_deployment
		.command("kill-process")
		.description("Kill Process")
		.option("--deploymentId <value>", "Deployment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.killProcess", "post", options, { required: ["deploymentId"] }),
		);
	g_deployment
		.command("queue-list")
		.description("Queue List")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.queueList", "get", options),
		);
	g_deployment
		.command("read-logs")
		.description("Read Logs")
		.option("--deploymentId <value>", "Deployment Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.readLogs", "get", options, { required: ["deploymentId"], types: {"tail":"number"} }),
		);
	g_deployment
		.command("remove-deployment")
		.description("Remove Deployment")
		.option("--deploymentId <value>", "Deployment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "deployment.removeDeployment", "post", options, { required: ["deploymentId"] }),
		);
	const g_destination = program.command("destination").description("destination commands");
	g_destination
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "destination.all", "get", options),
		);
	g_destination
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--provider <value>", "Provider [required] (nullable: pass \"null\")")
		.option("--accessKey <value>", "Access Key [required]")
		.option("--bucket <value>", "Bucket [required]")
		.option("--region <value>", "Region [required]")
		.option("--endpoint <value>", "Endpoint [required]")
		.option("--secretAccessKey <value>", "Secret Access Key [required]")
		.option("--additionalFlags <json>", "Additional Flags [required] (default: []) (nullable: pass \"null\") (JSON array)")
		.option("--serverId <value>", "Server Id")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "destination.create", "post", options, { required: ["name","provider","accessKey","bucket","region","endpoint","secretAccessKey","additionalFlags"], types: {"additionalFlags":"array?","provider":"string?"} }),
		);
	g_destination
		.command("from-object-storage-bucket")
		.description("From Object Storage Bucket")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "destination.fromObjectStorageBucket", "post", options, { required: ["objectStorageBucketId"] }),
		);
	g_destination
		.command("one")
		.description("One")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "destination.one", "get", options, { required: ["destinationId"] }),
		);
	g_destination
		.command("remove")
		.description("Remove")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "destination.remove", "post", options, { required: ["destinationId"] }),
		);
	g_destination
		.command("test-connection")
		.description("Test Connection")
		.option("--name <value>", "Name [required]")
		.option("--provider <value>", "Provider [required] (nullable: pass \"null\")")
		.option("--accessKey <value>", "Access Key [required]")
		.option("--bucket <value>", "Bucket [required]")
		.option("--region <value>", "Region [required]")
		.option("--endpoint <value>", "Endpoint [required]")
		.option("--secretAccessKey <value>", "Secret Access Key [required]")
		.option("--additionalFlags <json>", "Additional Flags [required] (default: []) (nullable: pass \"null\") (JSON array)")
		.option("--serverId <value>", "Server Id")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "destination.testConnection", "post", options, { required: ["name","provider","accessKey","bucket","region","endpoint","secretAccessKey","additionalFlags"], types: {"additionalFlags":"array?","provider":"string?"} }),
		);
	g_destination
		.command("update")
		.description("Update")
		.option("--name <value>", "Name [required]")
		.option("--accessKey <value>", "Access Key [required]")
		.option("--bucket <value>", "Bucket [required]")
		.option("--region <value>", "Region [required]")
		.option("--endpoint <value>", "Endpoint [required]")
		.option("--secretAccessKey <value>", "Secret Access Key [required]")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--provider <value>", "Provider [required] (nullable: pass \"null\")")
		.option("--additionalFlags <json>", "Additional Flags [required] (default: []) (nullable: pass \"null\") (JSON array)")
		.option("--serverId <value>", "Server Id")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "destination.update", "post", options, { required: ["name","accessKey","bucket","region","endpoint","secretAccessKey","destinationId","provider","additionalFlags"], types: {"additionalFlags":"array?","provider":"string?"} }),
		);
	const g_dnsProvider = program.command("dns-provider").description("dnsProvider commands");
	g_dnsProvider
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.all", "get", options),
		);
	g_dnsProvider
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.create", "post", options, { required: ["name","config"], types: {"config":"object"} }),
		);
	g_dnsProvider
		.command("create-record")
		.description("Create Record")
		.option("--type <value>", "Type [required] (one of: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR)")
		.option("--name <value>", "Name [required]")
		.option("--content <value>", "Content [required]")
		.option("--ttl <value>", "Ttl")
		.option("--proxied [boolean]", "Proxied")
		.option("--no-proxied", "Set proxied to false")
		.option("--comment <value>", "Comment")
		.option("--tags <json>", "Tags (JSON array)")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--zoneId <value>", "Zone Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.createRecord", "post", options, { required: ["type","name","content","dnsProviderId","zoneId"], types: {"proxied":"boolean","tags":"array","ttl":"number"}, enums: {"type":["A","AAAA","CNAME","MX","TXT","NS","SRV","CAA","PTR"]} }),
		);
	g_dnsProvider
		.command("delete-record")
		.description("Delete Record")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--zoneId <value>", "Zone Id [required]")
		.option("--recordId <value>", "Record Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.deleteRecord", "post", options, { required: ["dnsProviderId","zoneId","recordId"] }),
		);
	g_dnsProvider
		.command("descriptors")
		.description("Descriptors")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.descriptors", "get", options),
		);
	g_dnsProvider
		.command("export-zone")
		.description("Export Zone")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--zoneId <value>", "Zone Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.exportZone", "get", options, { required: ["dnsProviderId","zoneId"] }),
		);
	g_dnsProvider
		.command("health")
		.description("Health")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.health", "get", options, { required: ["dnsProviderId"] }),
		);
	g_dnsProvider
		.command("import-zone")
		.description("Import Zone")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--zoneId <value>", "Zone Id [required]")
		.option("--content <value>", "Content [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.importZone", "post", options, { required: ["dnsProviderId","zoneId","content"] }),
		);
	g_dnsProvider
		.command("list-records")
		.description("List Records")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--zoneId <value>", "Zone Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.listRecords", "get", options, { required: ["dnsProviderId","zoneId"] }),
		);
	g_dnsProvider
		.command("list-zones")
		.description("List Zones")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.listZones", "get", options, { required: ["dnsProviderId"] }),
		);
	g_dnsProvider
		.command("one")
		.description("One")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.one", "get", options, { required: ["dnsProviderId"] }),
		);
	g_dnsProvider
		.command("remove")
		.description("Remove")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.remove", "post", options, { required: ["dnsProviderId"] }),
		);
	g_dnsProvider
		.command("test-connection")
		.description("Test Connection")
		.option("--dnsProviderId <value>", "Dns Provider Id")
		.option("--config <json>", "Config (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.testConnection", "post", options, { types: {"config":"object"} }),
		);
	g_dnsProvider
		.command("update")
		.description("Update")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.update", "post", options, { required: ["dnsProviderId","name","config"], types: {"config":"object"} }),
		);
	g_dnsProvider
		.command("update-record")
		.description("Update Record")
		.option("--type <value>", "Type [required] (one of: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR)")
		.option("--name <value>", "Name [required]")
		.option("--content <value>", "Content [required]")
		.option("--ttl <value>", "Ttl")
		.option("--proxied [boolean]", "Proxied")
		.option("--no-proxied", "Set proxied to false")
		.option("--comment <value>", "Comment")
		.option("--tags <json>", "Tags (JSON array)")
		.option("--dnsProviderId <value>", "Dns Provider Id [required]")
		.option("--zoneId <value>", "Zone Id [required]")
		.option("--recordId <value>", "Record Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dnsProvider.updateRecord", "post", options, { required: ["type","name","content","dnsProviderId","zoneId","recordId"], types: {"proxied":"boolean","tags":"array","ttl":"number"}, enums: {"type":["A","AAAA","CNAME","MX","TXT","NS","SRV","CAA","PTR"]} }),
		);
	const g_docker = program.command("docker").description("docker commands");
	g_docker
		.command("delete-container-file")
		.description("Delete Container File")
		.option("--containerId <value>", "Container Id [required]")
		.option("--path <value>", "Path [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.deleteContainerFile", "post", options, { required: ["containerId","path"] }),
		);
	g_docker
		.command("get-config")
		.description("Get Config")
		.option("--containerId <value>", "Container Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getConfig", "get", options, { required: ["containerId"] }),
		);
	g_docker
		.command("get-containers")
		.description("Get Containers")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getContainers", "get", options),
		);
	g_docker
		.command("get-containers-by-app-label")
		.description("Get Containers By App Label")
		.option("--appName <value>", "App Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--type <value>", "Type [required] (one of: standalone, swarm)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getContainersByAppLabel", "get", options, { required: ["appName","type"], enums: {"type":["standalone","swarm"]} }),
		);
	g_docker
		.command("get-containers-by-app-name-match")
		.description("Get Containers By App Name Match")
		.option("--appType <value>", "App Type (one of: stack, docker-compose)")
		.option("--appName <value>", "App Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getContainersByAppNameMatch", "get", options, { required: ["appName"], enums: {"appType":["stack","docker-compose"]} }),
		);
	g_docker
		.command("get-engine-info")
		.description("Get Engine Info")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getEngineInfo", "get", options),
		);
	g_docker
		.command("get-events")
		.description("Get Events")
		.option("--serverId <value>", "Server Id")
		.option("--minutes <value>", "Minutes (default: 15)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getEvents", "get", options, { types: {"minutes":"number"} }),
		);
	g_docker
		.command("get-fleet-containers")
		.description("Get Fleet Containers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getFleetContainers", "get", options),
		);
	g_docker
		.command("get-server-health")
		.description("Get Server Health")
		.option("--serverId <value>", "Server Id")
		.option("--sinceHours <value>", "Since Hours")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getServerHealth", "get", options, { types: {"sinceHours":"number"} }),
		);
	g_docker
		.command("get-service-containers-by-app-name")
		.description("Get Service Containers By App Name")
		.option("--appName <value>", "App Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getServiceContainersByAppName", "get", options, { required: ["appName"] }),
		);
	g_docker
		.command("get-stack-containers-by-app-name")
		.description("Get Stack Containers By App Name")
		.option("--appName <value>", "App Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.getStackContainersByAppName", "get", options, { required: ["appName"] }),
		);
	g_docker
		.command("kill-container")
		.description("Kill Container")
		.option("--containerId <value>", "Container Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.killContainer", "post", options, { required: ["containerId"] }),
		);
	g_docker
		.command("list-container-files")
		.description("List Container Files")
		.option("--containerId <value>", "Container Id [required]")
		.option("--path <value>", "Path [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.listContainerFiles", "get", options, { required: ["containerId","path"] }),
		);
	g_docker
		.command("read-container-file")
		.description("Read Container File")
		.option("--containerId <value>", "Container Id [required]")
		.option("--path <value>", "Path [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.readContainerFile", "get", options, { required: ["containerId","path"] }),
		);
	g_docker
		.command("remove-container")
		.description("Remove Container")
		.option("--containerId <value>", "Container Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.removeContainer", "post", options, { required: ["containerId"] }),
		);
	g_docker
		.command("restart-container")
		.description("Restart Container")
		.option("--containerId <value>", "Container Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.restartContainer", "post", options, { required: ["containerId"] }),
		);
	g_docker
		.command("start-container")
		.description("Start Container")
		.option("--containerId <value>", "Container Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.startContainer", "post", options, { required: ["containerId"] }),
		);
	g_docker
		.command("stop-container")
		.description("Stop Container")
		.option("--containerId <value>", "Container Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.stopContainer", "post", options, { required: ["containerId"] }),
		);
	g_docker
		.command("upload-file-to-container")
		.description("Upload File To Container")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.uploadFileToContainer", "post", options),
		);
	g_docker
		.command("write-container-file")
		.description("Write Container File")
		.option("--containerId <value>", "Container Id [required]")
		.option("--path <value>", "Path [required]")
		.option("--content <value>", "Content [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "docker.writeContainerFile", "post", options, { required: ["containerId","path","content"] }),
		);
	const g_dockerDiskUsage = program.command("docker-disk-usage").description("dockerDiskUsage commands");
	g_dockerDiskUsage
		.command("get-build-cache")
		.description("Get Build Cache")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerDiskUsage.getBuildCache", "get", options),
		);
	g_dockerDiskUsage
		.command("get-disk-usage")
		.description("Get Disk Usage")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerDiskUsage.getDiskUsage", "get", options),
		);
	g_dockerDiskUsage
		.command("prune-build-cache")
		.description("Prune Build Cache")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerDiskUsage.pruneBuildCache", "post", options),
		);
	const g_dockerImage = program.command("docker-image").description("dockerImage commands");
	g_dockerImage
		.command("get-image-config")
		.description("Get Image Config")
		.option("--imageRef <value>", "Image Ref [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerImage.getImageConfig", "get", options, { required: ["imageRef"] }),
		);
	g_dockerImage
		.command("get-images")
		.description("Get Images")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerImage.getImages", "get", options),
		);
	g_dockerImage
		.command("remove-image")
		.description("Remove Image")
		.option("--repository <value>", "Repository [required]")
		.option("--tag <value>", "Tag [required]")
		.option("--id <value>", "Id [required]")
		.option("--force [boolean]", "Force")
		.option("--no-force", "Set force to false")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerImage.removeImage", "post", options, { required: ["repository","tag","id"], types: {"force":"boolean"} }),
		);
	const g_dockerVolume = program.command("docker-volume").description("dockerVolume commands");
	g_dockerVolume
		.command("delete-volume-file")
		.description("Delete Volume File")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--path <value>", "Path [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.deleteVolumeFile", "post", options, { required: ["volumeName","path"] }),
		);
	g_dockerVolume
		.command("get-volume-config")
		.description("Get Volume Config")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.getVolumeConfig", "get", options, { required: ["volumeName"] }),
		);
	g_dockerVolume
		.command("get-volumes")
		.description("Get Volumes")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.getVolumes", "get", options),
		);
	g_dockerVolume
		.command("get-volumes-size")
		.description("Get Volumes Size")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.getVolumesSize", "get", options),
		);
	g_dockerVolume
		.command("list-volume-files")
		.description("List Volume Files")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--path <value>", "Path [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.listVolumeFiles", "get", options, { required: ["volumeName","path"] }),
		);
	g_dockerVolume
		.command("read-volume-file")
		.description("Read Volume File")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--path <value>", "Path [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.readVolumeFile", "get", options, { required: ["volumeName","path"] }),
		);
	g_dockerVolume
		.command("remove-volume")
		.description("Remove Volume")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.removeVolume", "post", options, { required: ["volumeName"] }),
		);
	g_dockerVolume
		.command("write-volume-file")
		.description("Write Volume File")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--path <value>", "Path [required]")
		.option("--content <value>", "Content [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "dockerVolume.writeVolumeFile", "post", options, { required: ["volumeName","path","content"] }),
		);
	const g_domain = program.command("domain").description("domain commands");
	g_domain
		.command("by-application-id")
		.description("By Application Id")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.byApplicationId", "get", options, { required: ["applicationId"] }),
		);
	g_domain
		.command("by-compose-id")
		.description("By Compose Id")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.byComposeId", "get", options, { required: ["composeId"] }),
		);
	g_domain
		.command("can-generate-traefik-me-domains")
		.description("Can Generate Traefik Me Domains")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.canGenerateTraefikMeDomains", "get", options, { required: ["serverId"] }),
		);
	g_domain
		.command("create")
		.description("Create")
		.option("--host <value>", "Host [required]")
		.option("--path <value>", "Path (nullable: pass \"null\")")
		.option("--port <value>", "Port (nullable: pass \"null\")")
		.option("--customEntrypoint <value>", "Custom Entrypoint (nullable: pass \"null\")")
		.option("--https [boolean]", "Https")
		.option("--no-https", "Set https to false")
		.option("--applicationId <value>", "Application Id (nullable: pass \"null\")")
		.option("--certificateType <value>", "Certificate Type (one of: letsencrypt, none, custom)")
		.option("--customCertResolver <value>", "Custom Cert Resolver (nullable: pass \"null\")")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--serviceName <value>", "Service Name (nullable: pass \"null\")")
		.option("--domainType <value>", "Domain Type (one of: compose, application, preview) (nullable: pass \"null\")")
		.option("--previewDeploymentId <value>", "Preview Deployment Id (nullable: pass \"null\")")
		.option("--internalPath <value>", "Internal Path (nullable: pass \"null\")")
		.option("--stripPath [boolean]", "Strip Path")
		.option("--no-stripPath", "Set stripPath to false")
		.option("--middlewares <json>", "Middlewares (nullable: pass \"null\") (JSON array)")
		.option("--forwardAuthEnabled [boolean]", "Forward Auth Enabled")
		.option("--no-forwardAuthEnabled", "Set forwardAuthEnabled to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.create", "post", options, { required: ["host"], types: {"applicationId":"string?","composeId":"string?","customCertResolver":"string?","customEntrypoint":"string?","domainType":"string?","forwardAuthEnabled":"boolean","https":"boolean","internalPath":"string?","middlewares":"array?","path":"string?","port":"number?","previewDeploymentId":"string?","serviceName":"string?","stripPath":"boolean"}, enums: {"certificateType":["letsencrypt","none","custom"],"domainType":["compose","application","preview"]} }),
		);
	g_domain
		.command("delete")
		.description("Delete")
		.option("--domainId <value>", "Domain Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.delete", "post", options, { required: ["domainId"] }),
		);
	g_domain
		.command("generate-domain")
		.description("Generate Domain")
		.option("--appName <value>", "App Name [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.generateDomain", "post", options, { required: ["appName"] }),
		);
	g_domain
		.command("internal-dns")
		.description("Internal Dns")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.internalDns", "get", options),
		);
	g_domain
		.command("one")
		.description("One")
		.option("--domainId <value>", "Domain Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.one", "get", options, { required: ["domainId"] }),
		);
	g_domain
		.command("toggle-enable")
		.description("Toggle Enable")
		.option("--domainId <value>", "Domain Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.toggleEnable", "post", options, { required: ["domainId"] }),
		);
	g_domain
		.command("update")
		.description("Update")
		.option("--host <value>", "Host [required]")
		.option("--path <value>", "Path (nullable: pass \"null\")")
		.option("--port <value>", "Port (nullable: pass \"null\")")
		.option("--customEntrypoint <value>", "Custom Entrypoint (nullable: pass \"null\")")
		.option("--https [boolean]", "Https")
		.option("--no-https", "Set https to false")
		.option("--certificateType <value>", "Certificate Type (one of: letsencrypt, none, custom)")
		.option("--customCertResolver <value>", "Custom Cert Resolver (nullable: pass \"null\")")
		.option("--serviceName <value>", "Service Name (nullable: pass \"null\")")
		.option("--domainType <value>", "Domain Type (one of: compose, application, preview) (nullable: pass \"null\")")
		.option("--internalPath <value>", "Internal Path (nullable: pass \"null\")")
		.option("--stripPath [boolean]", "Strip Path")
		.option("--no-stripPath", "Set stripPath to false")
		.option("--middlewares <json>", "Middlewares (nullable: pass \"null\") (JSON array)")
		.option("--forwardAuthEnabled [boolean]", "Forward Auth Enabled")
		.option("--no-forwardAuthEnabled", "Set forwardAuthEnabled to false")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--domainId <value>", "Domain Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.update", "post", options, { required: ["host","domainId"], types: {"customCertResolver":"string?","customEntrypoint":"string?","domainType":"string?","enabled":"boolean","forwardAuthEnabled":"boolean","https":"boolean","internalPath":"string?","middlewares":"array?","path":"string?","port":"number?","serviceName":"string?","stripPath":"boolean"}, enums: {"certificateType":["letsencrypt","none","custom"],"domainType":["compose","application","preview"]} }),
		);
	g_domain
		.command("validate-domain")
		.description("Validate Domain")
		.option("--domain <value>", "Domain [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "domain.validateDomain", "post", options, { required: ["domain"] }),
		);
	const g_environment = program.command("environment").description("environment commands");
	g_environment
		.command("by-project-id")
		.description("By Project Id")
		.option("--projectId <value>", "Project Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "environment.byProjectId", "get", options, { required: ["projectId"] }),
		);
	g_environment
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "environment.create", "post", options, { required: ["name","projectId"] }),
		);
	g_environment
		.command("duplicate")
		.description("Duplicate")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "environment.duplicate", "post", options, { required: ["environmentId","name"] }),
		);
	g_environment
		.command("one")
		.description("One")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "environment.one", "get", options, { required: ["environmentId"] }),
		);
	g_environment
		.command("remove")
		.description("Remove")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "environment.remove", "post", options, { required: ["environmentId"] }),
		);
	g_environment
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "environment.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_environment
		.command("update")
		.description("Update")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--name <value>", "Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--env <value>", "Env")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "environment.update", "post", options, { required: ["environmentId"] }),
		);
	const g_forwardAuth = program.command("forward-auth").description("forwardAuth commands");
	g_forwardAuth
		.command("deploy-on-server")
		.description("Deploy On Server")
		.option("--serverId <value>", "Server Id [required] (nullable: pass \"null\")")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.deployOnServer", "post", options, { required: ["serverId","providerId"], types: {"serverId":"string?"} }),
		);
	g_forwardAuth
		.command("disable")
		.description("Disable")
		.option("--domainId <value>", "Domain Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.disable", "post", options, { required: ["domainId"] }),
		);
	g_forwardAuth
		.command("enable")
		.description("Enable")
		.option("--domainId <value>", "Domain Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.enable", "post", options, { required: ["domainId"] }),
		);
	g_forwardAuth
		.command("get-auth-domain")
		.description("Get Auth Domain")
		.option("--serverId <value>", "Server Id [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.getAuthDomain", "get", options, { required: ["serverId"], types: {"serverId":"string?"} }),
		);
	g_forwardAuth
		.command("list-providers")
		.description("List Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.listProviders", "get", options),
		);
	g_forwardAuth
		.command("remove-auth-domain")
		.description("Remove Auth Domain")
		.option("--serverId <value>", "Server Id [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.removeAuthDomain", "post", options, { required: ["serverId"], types: {"serverId":"string?"} }),
		);
	g_forwardAuth
		.command("remove-on-server")
		.description("Remove On Server")
		.option("--serverId <value>", "Server Id [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.removeOnServer", "post", options, { required: ["serverId"], types: {"serverId":"string?"} }),
		);
	g_forwardAuth
		.command("server-status")
		.description("Server Status")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.serverStatus", "get", options),
		);
	g_forwardAuth
		.command("set-auth-domain")
		.description("Set Auth Domain")
		.option("--serverId <value>", "Server Id [required] (nullable: pass \"null\")")
		.option("--authDomain <value>", "Auth Domain [required]")
		.option("--https [boolean]", "Https (default: true)")
		.option("--no-https", "Set https to false")
		.option("--certificateType <value>", "Certificate Type (one of: none, letsencrypt, custom) (default: \"letsencrypt\")")
		.option("--customCertResolver <value>", "Custom Cert Resolver")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.setAuthDomain", "post", options, { required: ["serverId","authDomain"], types: {"https":"boolean","serverId":"string?"}, enums: {"certificateType":["none","letsencrypt","custom"]} }),
		);
	g_forwardAuth
		.command("status")
		.description("Status")
		.option("--domainId <value>", "Domain Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "forwardAuth.status", "get", options, { required: ["domainId"] }),
		);
	const g_gitea = program.command("gitea").description("gitea commands");
	g_gitea
		.command("create")
		.description("Create")
		.option("--giteaId <value>", "Gitea Id")
		.option("--giteaUrl <value>", "Gitea Url [required]")
		.option("--giteaInternalUrl <value>", "Gitea Internal Url (nullable: pass \"null\")")
		.option("--redirectUri <value>", "Redirect Uri")
		.option("--clientId <value>", "Client Id")
		.option("--clientSecret <value>", "Client Secret")
		.option("--gitProviderId <value>", "Git Provider Id")
		.option("--accessToken <value>", "Access Token")
		.option("--refreshToken <value>", "Refresh Token")
		.option("--expiresAt <value>", "Expires At")
		.option("--scopes <value>", "Scopes")
		.option("--lastAuthenticatedAt <value>", "Last Authenticated At")
		.option("--name <value>", "Name [required]")
		.option("--giteaUsername <value>", "Gitea Username")
		.option("--organizationName <value>", "Organization Name")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.create", "post", options, { required: ["giteaUrl","name"], types: {"expiresAt":"number","giteaInternalUrl":"string?","lastAuthenticatedAt":"number"} }),
		);
	g_gitea
		.command("get-gitea-branches")
		.description("Get Gitea Branches")
		.option("--owner <value>", "Owner [required]")
		.option("--repositoryName <value>", "Repository Name [required]")
		.option("--giteaId <value>", "Gitea Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.getGiteaBranches", "get", options, { required: ["owner","repositoryName"] }),
		);
	g_gitea
		.command("get-gitea-repositories")
		.description("Get Gitea Repositories")
		.option("--giteaId <value>", "Gitea Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.getGiteaRepositories", "get", options, { required: ["giteaId"] }),
		);
	g_gitea
		.command("get-gitea-url")
		.description("Get Gitea Url")
		.option("--giteaId <value>", "Gitea Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.getGiteaUrl", "get", options, { required: ["giteaId"] }),
		);
	g_gitea
		.command("gitea-providers")
		.description("Gitea Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.giteaProviders", "get", options),
		);
	g_gitea
		.command("one")
		.description("One")
		.option("--giteaId <value>", "Gitea Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.one", "get", options, { required: ["giteaId"] }),
		);
	g_gitea
		.command("test-connection")
		.description("Test Connection")
		.option("--giteaId <value>", "Gitea Id")
		.option("--organizationName <value>", "Organization Name")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.testConnection", "post", options),
		);
	g_gitea
		.command("update")
		.description("Update")
		.option("--giteaId <value>", "Gitea Id [required]")
		.option("--giteaUrl <value>", "Gitea Url [required]")
		.option("--giteaInternalUrl <value>", "Gitea Internal Url (nullable: pass \"null\")")
		.option("--redirectUri <value>", "Redirect Uri")
		.option("--clientId <value>", "Client Id")
		.option("--clientSecret <value>", "Client Secret")
		.option("--gitProviderId <value>", "Git Provider Id [required]")
		.option("--accessToken <value>", "Access Token")
		.option("--refreshToken <value>", "Refresh Token")
		.option("--expiresAt <value>", "Expires At")
		.option("--scopes <value>", "Scopes")
		.option("--lastAuthenticatedAt <value>", "Last Authenticated At")
		.option("--name <value>", "Name [required]")
		.option("--giteaUsername <value>", "Gitea Username")
		.option("--organizationName <value>", "Organization Name")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitea.update", "post", options, { required: ["giteaId","giteaUrl","gitProviderId","name"], types: {"expiresAt":"number","giteaInternalUrl":"string?","lastAuthenticatedAt":"number"} }),
		);
	const g_github = program.command("github").description("github commands");
	g_github
		.command("get-github-branches")
		.description("Get Github Branches")
		.option("--repo <value>", "Repo [required]")
		.option("--owner <value>", "Owner [required]")
		.option("--githubId <value>", "Github Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "github.getGithubBranches", "get", options, { required: ["repo","owner"] }),
		);
	g_github
		.command("get-github-repositories")
		.description("Get Github Repositories")
		.option("--githubId <value>", "Github Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "github.getGithubRepositories", "get", options, { required: ["githubId"] }),
		);
	g_github
		.command("github-providers")
		.description("Github Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "github.githubProviders", "get", options),
		);
	g_github
		.command("one")
		.description("One")
		.option("--githubId <value>", "Github Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "github.one", "get", options, { required: ["githubId"] }),
		);
	g_github
		.command("test-connection")
		.description("Test Connection")
		.option("--githubId <value>", "Github Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "github.testConnection", "post", options, { required: ["githubId"] }),
		);
	g_github
		.command("update")
		.description("Update")
		.option("--githubId <value>", "Github Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--gitProviderId <value>", "Git Provider Id [required]")
		.option("--githubAppName <value>", "Github App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "github.update", "post", options, { required: ["githubId","name","gitProviderId","githubAppName"] }),
		);
	const g_gitlab = program.command("gitlab").description("gitlab commands");
	g_gitlab
		.command("create")
		.description("Create")
		.option("--applicationId <value>", "Application Id")
		.option("--secret <value>", "Secret")
		.option("--groupName <value>", "Group Name")
		.option("--gitProviderId <value>", "Git Provider Id")
		.option("--redirectUri <value>", "Redirect Uri")
		.option("--authId <value>", "Auth Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--gitlabUrl <value>", "Gitlab Url [required]")
		.option("--gitlabInternalUrl <value>", "Gitlab Internal Url (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitlab.create", "post", options, { required: ["authId","name","gitlabUrl"], types: {"gitlabInternalUrl":"string?"} }),
		);
	g_gitlab
		.command("get-gitlab-branches")
		.description("Get Gitlab Branches")
		.option("--id <value>", "Id")
		.option("--owner <value>", "Owner [required]")
		.option("--repo <value>", "Repo [required]")
		.option("--gitlabId <value>", "Gitlab Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitlab.getGitlabBranches", "get", options, { required: ["owner","repo"], types: {"id":"number"} }),
		);
	g_gitlab
		.command("get-gitlab-repositories")
		.description("Get Gitlab Repositories")
		.option("--gitlabId <value>", "Gitlab Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitlab.getGitlabRepositories", "get", options, { required: ["gitlabId"] }),
		);
	g_gitlab
		.command("gitlab-providers")
		.description("Gitlab Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitlab.gitlabProviders", "get", options),
		);
	g_gitlab
		.command("one")
		.description("One")
		.option("--gitlabId <value>", "Gitlab Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitlab.one", "get", options, { required: ["gitlabId"] }),
		);
	g_gitlab
		.command("test-connection")
		.description("Test Connection")
		.option("--gitlabId <value>", "Gitlab Id [required]")
		.option("--groupName <value>", "Group Name")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitlab.testConnection", "post", options, { required: ["gitlabId"] }),
		);
	g_gitlab
		.command("update")
		.description("Update")
		.option("--applicationId <value>", "Application Id")
		.option("--secret <value>", "Secret")
		.option("--groupName <value>", "Group Name")
		.option("--redirectUri <value>", "Redirect Uri")
		.option("--name <value>", "Name [required]")
		.option("--gitlabId <value>", "Gitlab Id [required]")
		.option("--gitlabUrl <value>", "Gitlab Url [required]")
		.option("--gitProviderId <value>", "Git Provider Id [required]")
		.option("--gitlabInternalUrl <value>", "Gitlab Internal Url (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitlab.update", "post", options, { required: ["name","gitlabId","gitlabUrl","gitProviderId"], types: {"gitlabInternalUrl":"string?"} }),
		);
	const g_gitProvider = program.command("git-provider").description("gitProvider commands");
	g_gitProvider
		.command("all-for-permissions")
		.description("All For Permissions")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitProvider.allForPermissions", "get", options),
		);
	g_gitProvider
		.command("get-all")
		.description("Get All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitProvider.getAll", "get", options),
		);
	g_gitProvider
		.command("remove")
		.description("Remove")
		.option("--gitProviderId <value>", "Git Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitProvider.remove", "post", options, { required: ["gitProviderId"] }),
		);
	g_gitProvider
		.command("toggle-share")
		.description("Toggle Share")
		.option("--gitProviderId <value>", "Git Provider Id [required]")
		.option("--sharedWithOrganization [boolean]", "Shared With Organization [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "gitProvider.toggleShare", "post", options, { required: ["gitProviderId","sharedWithOrganization"], types: {"sharedWithOrganization":"boolean"} }),
		);
	const g_libsql = program.command("libsql").description("libsql commands");
	g_libsql
		.command("change-status")
		.description("Change Status")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--applicationStatus <value>", "Application Status [required] (one of: idle, running, done, error)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.changeStatus", "post", options, { required: ["libsqlId","applicationStatus"], enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	g_libsql
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--dockerImage <value>", "Docker Image [required] (default: \"ghcr.io/tursodatabase/libsql-server:v0.24.32\")")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--description <value>", "Description [required] (nullable: pass \"null\")")
		.option("--databaseUser <value>", "Database User [required]")
		.option("--databasePassword <value>", "Database Password [required]")
		.option("--sqldNode <value>", "Sqld Node [required] (one of: primary, replica)")
		.option("--sqldPrimaryUrl <value>", "Sqld Primary Url [required] (nullable: pass \"null\")")
		.option("--enableNamespaces [boolean]", "Enable Namespaces [required] (default: false)")
		.option("--serverId <value>", "Server Id [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.create", "post", options, { required: ["name","appName","dockerImage","environmentId","description","databaseUser","databasePassword","sqldNode","sqldPrimaryUrl","enableNamespaces","serverId"], types: {"description":"string?","enableNamespaces":"boolean","serverId":"string?","sqldPrimaryUrl":"string?"}, enums: {"sqldNode":["primary","replica"]} }),
		);
	g_libsql
		.command("deploy")
		.description("Deploy")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.deploy", "post", options, { required: ["libsqlId"] }),
		);
	g_libsql
		.command("move")
		.description("Move")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.move", "post", options, { required: ["libsqlId","targetEnvironmentId"] }),
		);
	g_libsql
		.command("one")
		.description("One")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.one", "get", options, { required: ["libsqlId"] }),
		);
	g_libsql
		.command("read-logs")
		.description("Read Logs")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.readLogs", "get", options, { required: ["libsqlId"], types: {"tail":"number"} }),
		);
	g_libsql
		.command("rebuild")
		.description("Rebuild")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.rebuild", "post", options, { required: ["libsqlId"] }),
		);
	g_libsql
		.command("reload")
		.description("Reload")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.reload", "post", options, { required: ["libsqlId","appName"] }),
		);
	g_libsql
		.command("remove")
		.description("Remove")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.remove", "post", options, { required: ["libsqlId"] }),
		);
	g_libsql
		.command("save-environment")
		.description("Save Environment")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.saveEnvironment", "post", options, { required: ["libsqlId","env"], types: {"env":"string?"} }),
		);
	g_libsql
		.command("save-external-ports")
		.description("Save External Ports")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--externalPort <value>", "External Port (nullable: pass \"null\")")
		.option("--externalGRPCPort <value>", "External GRPCPort (nullable: pass \"null\")")
		.option("--externalAdminPort <value>", "External Admin Port (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.saveExternalPorts", "post", options, { required: ["libsqlId"], types: {"externalAdminPort":"number?","externalGRPCPort":"number?","externalPort":"number?"} }),
		);
	g_libsql
		.command("start")
		.description("Start")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.start", "post", options, { required: ["libsqlId"] }),
		);
	g_libsql
		.command("stop")
		.description("Stop")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.stop", "post", options, { required: ["libsqlId"] }),
		);
	g_libsql
		.command("update")
		.description("Update")
		.option("--libsqlId <value>", "Libsql Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databaseUser <value>", "Database User")
		.option("--databasePassword <value>", "Database Password")
		.option("--sqldNode <value>", "Sqld Node (one of: primary, replica)")
		.option("--sqldPrimaryUrl <value>", "Sqld Primary Url (nullable: pass \"null\")")
		.option("--enableNamespaces [boolean]", "Enable Namespaces (default: false)")
		.option("--no-enableNamespaces", "Set enableNamespaces to false")
		.option("--dockerImage <value>", "Docker Image (default: \"ghcr.io/tursodatabase/libsql-server:v0.24.32\")")
		.option("--command <value>", "Command (nullable: pass \"null\")")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--memoryReservation <value>", "Memory Reservation (nullable: pass \"null\")")
		.option("--memoryLimit <value>", "Memory Limit (nullable: pass \"null\")")
		.option("--cpuReservation <value>", "Cpu Reservation (nullable: pass \"null\")")
		.option("--cpuLimit <value>", "Cpu Limit (nullable: pass \"null\")")
		.option("--externalPort <value>", "External Port (nullable: pass \"null\")")
		.option("--externalGRPCPort <value>", "External GRPCPort (nullable: pass \"null\")")
		.option("--externalAdminPort <value>", "External Admin Port (nullable: pass \"null\")")
		.option("--applicationStatus <value>", "Application Status (one of: idle, running, done, error)")
		.option("--healthCheckSwarm <json>", "Health Check Swarm (nullable: pass \"null\") (JSON object)")
		.option("--restartPolicySwarm <json>", "Restart Policy Swarm (nullable: pass \"null\") (JSON object)")
		.option("--placementSwarm <json>", "Placement Swarm (nullable: pass \"null\") (JSON object)")
		.option("--updateConfigSwarm <json>", "Update Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--rollbackConfigSwarm <json>", "Rollback Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--modeSwarm <json>", "Mode Swarm (nullable: pass \"null\") (JSON object)")
		.option("--labelsSwarm <json>", "Labels Swarm (nullable: pass \"null\") (JSON object)")
		.option("--networkSwarm <json>", "Network Swarm (nullable: pass \"null\") (JSON array)")
		.option("--stopGracePeriodSwarm <value>", "Stop Grace Period Swarm (nullable: pass \"null\")")
		.option("--endpointSpecSwarm <json>", "Endpoint Spec Swarm (nullable: pass \"null\") (JSON object)")
		.option("--replicas <value>", "Replicas")
		.option("--networkIds <json>", "Network Ids (nullable: pass \"null\") (JSON array)")
		.option("--detachNotployNetwork [boolean]", "Detach Notploy Network")
		.option("--no-detachNotployNetwork", "Set detachNotployNetwork to false")
		.option("--createdAt <value>", "Created At")
		.option("--environmentId <value>", "Environment Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "libsql.update", "post", options, { required: ["libsqlId"], types: {"command":"string?","cpuLimit":"string?","cpuReservation":"string?","description":"string?","detachNotployNetwork":"boolean","enableNamespaces":"boolean","endpointSpecSwarm":"object?","env":"string?","externalAdminPort":"number?","externalGRPCPort":"number?","externalPort":"number?","healthCheckSwarm":"object?","labelsSwarm":"object?","memoryLimit":"string?","memoryReservation":"string?","modeSwarm":"object?","networkIds":"array?","networkSwarm":"array?","placementSwarm":"object?","replicas":"number","restartPolicySwarm":"object?","rollbackConfigSwarm":"object?","sqldPrimaryUrl":"string?","stopGracePeriodSwarm":"number?","updateConfigSwarm":"object?"}, enums: {"applicationStatus":["idle","running","done","error"],"sqldNode":["primary","replica"]} }),
		);
	const g_mariadb = program.command("mariadb").description("mariadb commands");
	g_mariadb
		.command("change-password")
		.description("Change Password")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--password <value>", "Password [required]")
		.option("--type <value>", "Type (one of: user, root) (default: \"user\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.changePassword", "post", options, { required: ["mariadbId","password"], enums: {"type":["user","root"]} }),
		);
	g_mariadb
		.command("change-status")
		.description("Change Status")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--applicationStatus <value>", "Application Status [required] (one of: idle, running, done, error)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.changeStatus", "post", options, { required: ["mariadbId","applicationStatus"], enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	g_mariadb
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--appName <value>", "App Name")
		.option("--dockerImage <value>", "Docker Image (default: \"mariadb:6\")")
		.option("--databaseRootPassword <value>", "Database Root Password")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databaseName <value>", "Database Name [required]")
		.option("--databaseUser <value>", "Database User [required]")
		.option("--databasePassword <value>", "Database Password [required]")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.create", "post", options, { required: ["name","environmentId","databaseName","databaseUser","databasePassword"], types: {"description":"string?","serverId":"string?"} }),
		);
	g_mariadb
		.command("deploy")
		.description("Deploy")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.deploy", "post", options, { required: ["mariadbId"] }),
		);
	g_mariadb
		.command("move")
		.description("Move")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.move", "post", options, { required: ["mariadbId","targetEnvironmentId"] }),
		);
	g_mariadb
		.command("one")
		.description("One")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.one", "get", options, { required: ["mariadbId"] }),
		);
	g_mariadb
		.command("read-logs")
		.description("Read Logs")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.readLogs", "get", options, { required: ["mariadbId"], types: {"tail":"number"} }),
		);
	g_mariadb
		.command("rebuild")
		.description("Rebuild")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.rebuild", "post", options, { required: ["mariadbId"] }),
		);
	g_mariadb
		.command("reload")
		.description("Reload")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.reload", "post", options, { required: ["mariadbId","appName"] }),
		);
	g_mariadb
		.command("remove")
		.description("Remove")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.remove", "post", options, { required: ["mariadbId"] }),
		);
	g_mariadb
		.command("save-environment")
		.description("Save Environment")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.saveEnvironment", "post", options, { required: ["mariadbId","env"], types: {"env":"string?"} }),
		);
	g_mariadb
		.command("save-external-port")
		.description("Save External Port")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--externalPort <value>", "External Port [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.saveExternalPort", "post", options, { required: ["mariadbId","externalPort"], types: {"externalPort":"number?"} }),
		);
	g_mariadb
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--environmentId <value>", "Environment Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_mariadb
		.command("start")
		.description("Start")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.start", "post", options, { required: ["mariadbId"] }),
		);
	g_mariadb
		.command("stop")
		.description("Stop")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.stop", "post", options, { required: ["mariadbId"] }),
		);
	g_mariadb
		.command("update")
		.description("Update")
		.option("--mariadbId <value>", "Mariadb Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databaseName <value>", "Database Name")
		.option("--databaseUser <value>", "Database User")
		.option("--databasePassword <value>", "Database Password")
		.option("--databaseRootPassword <value>", "Database Root Password")
		.option("--dockerImage <value>", "Docker Image")
		.option("--command <value>", "Command (nullable: pass \"null\")")
		.option("--args <json>", "Args (nullable: pass \"null\") (JSON array)")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--memoryReservation <value>", "Memory Reservation (nullable: pass \"null\")")
		.option("--memoryLimit <value>", "Memory Limit (nullable: pass \"null\")")
		.option("--cpuReservation <value>", "Cpu Reservation (nullable: pass \"null\")")
		.option("--cpuLimit <value>", "Cpu Limit (nullable: pass \"null\")")
		.option("--externalPort <value>", "External Port (nullable: pass \"null\")")
		.option("--applicationStatus <value>", "Application Status (one of: idle, running, done, error)")
		.option("--healthCheckSwarm <json>", "Health Check Swarm (nullable: pass \"null\") (JSON object)")
		.option("--restartPolicySwarm <json>", "Restart Policy Swarm (nullable: pass \"null\") (JSON object)")
		.option("--placementSwarm <json>", "Placement Swarm (nullable: pass \"null\") (JSON object)")
		.option("--updateConfigSwarm <json>", "Update Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--rollbackConfigSwarm <json>", "Rollback Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--modeSwarm <json>", "Mode Swarm (nullable: pass \"null\") (JSON object)")
		.option("--labelsSwarm <json>", "Labels Swarm (nullable: pass \"null\") (JSON object)")
		.option("--networkSwarm <json>", "Network Swarm (nullable: pass \"null\") (JSON array)")
		.option("--stopGracePeriodSwarm <value>", "Stop Grace Period Swarm (nullable: pass \"null\")")
		.option("--endpointSpecSwarm <json>", "Endpoint Spec Swarm (nullable: pass \"null\") (JSON object)")
		.option("--ulimitsSwarm <json>", "Ulimits Swarm (nullable: pass \"null\") (JSON array)")
		.option("--replicas <value>", "Replicas")
		.option("--createdAt <value>", "Created At")
		.option("--environmentId <value>", "Environment Id")
		.option("--networkIds <json>", "Network Ids (nullable: pass \"null\") (JSON array)")
		.option("--detachNotployNetwork [boolean]", "Detach Notploy Network")
		.option("--no-detachNotployNetwork", "Set detachNotployNetwork to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mariadb.update", "post", options, { required: ["mariadbId"], types: {"args":"array?","command":"string?","cpuLimit":"string?","cpuReservation":"string?","description":"string?","detachNotployNetwork":"boolean","endpointSpecSwarm":"object?","env":"string?","externalPort":"number?","healthCheckSwarm":"object?","labelsSwarm":"object?","memoryLimit":"string?","memoryReservation":"string?","modeSwarm":"object?","networkIds":"array?","networkSwarm":"array?","placementSwarm":"object?","replicas":"number","restartPolicySwarm":"object?","rollbackConfigSwarm":"object?","stopGracePeriodSwarm":"number?","ulimitsSwarm":"array?","updateConfigSwarm":"object?"}, enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	const g_mongo = program.command("mongo").description("mongo commands");
	g_mongo
		.command("change-password")
		.description("Change Password")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--password <value>", "Password [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.changePassword", "post", options, { required: ["mongoId","password"] }),
		);
	g_mongo
		.command("change-status")
		.description("Change Status")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--applicationStatus <value>", "Application Status [required] (one of: idle, running, done, error)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.changeStatus", "post", options, { required: ["mongoId","applicationStatus"], enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	g_mongo
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--appName <value>", "App Name")
		.option("--dockerImage <value>", "Docker Image (default: \"mongo:15\")")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databaseUser <value>", "Database User [required]")
		.option("--databasePassword <value>", "Database Password [required]")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--replicaSets [boolean]", "Replica Sets (default: false) (nullable: pass \"null\")")
		.option("--no-replicaSets", "Set replicaSets to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.create", "post", options, { required: ["name","environmentId","databaseUser","databasePassword"], types: {"description":"string?","replicaSets":"boolean?","serverId":"string?"} }),
		);
	g_mongo
		.command("deploy")
		.description("Deploy")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.deploy", "post", options, { required: ["mongoId"] }),
		);
	g_mongo
		.command("move")
		.description("Move")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.move", "post", options, { required: ["mongoId","targetEnvironmentId"] }),
		);
	g_mongo
		.command("one")
		.description("One")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.one", "get", options, { required: ["mongoId"] }),
		);
	g_mongo
		.command("read-logs")
		.description("Read Logs")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.readLogs", "get", options, { required: ["mongoId"], types: {"tail":"number"} }),
		);
	g_mongo
		.command("rebuild")
		.description("Rebuild")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.rebuild", "post", options, { required: ["mongoId"] }),
		);
	g_mongo
		.command("reload")
		.description("Reload")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.reload", "post", options, { required: ["mongoId","appName"] }),
		);
	g_mongo
		.command("remove")
		.description("Remove")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.remove", "post", options, { required: ["mongoId"] }),
		);
	g_mongo
		.command("save-environment")
		.description("Save Environment")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.saveEnvironment", "post", options, { required: ["mongoId","env"], types: {"env":"string?"} }),
		);
	g_mongo
		.command("save-external-port")
		.description("Save External Port")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--externalPort <value>", "External Port [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.saveExternalPort", "post", options, { required: ["mongoId","externalPort"], types: {"externalPort":"number?"} }),
		);
	g_mongo
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--environmentId <value>", "Environment Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_mongo
		.command("start")
		.description("Start")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.start", "post", options, { required: ["mongoId"] }),
		);
	g_mongo
		.command("stop")
		.description("Stop")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.stop", "post", options, { required: ["mongoId"] }),
		);
	g_mongo
		.command("update")
		.description("Update")
		.option("--mongoId <value>", "Mongo Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databaseUser <value>", "Database User")
		.option("--databasePassword <value>", "Database Password")
		.option("--dockerImage <value>", "Docker Image")
		.option("--command <value>", "Command (nullable: pass \"null\")")
		.option("--args <json>", "Args (nullable: pass \"null\") (JSON array)")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--memoryReservation <value>", "Memory Reservation (nullable: pass \"null\")")
		.option("--memoryLimit <value>", "Memory Limit (nullable: pass \"null\")")
		.option("--cpuReservation <value>", "Cpu Reservation (nullable: pass \"null\")")
		.option("--cpuLimit <value>", "Cpu Limit (nullable: pass \"null\")")
		.option("--externalPort <value>", "External Port (nullable: pass \"null\")")
		.option("--applicationStatus <value>", "Application Status (one of: idle, running, done, error)")
		.option("--healthCheckSwarm <json>", "Health Check Swarm (nullable: pass \"null\") (JSON object)")
		.option("--restartPolicySwarm <json>", "Restart Policy Swarm (nullable: pass \"null\") (JSON object)")
		.option("--placementSwarm <json>", "Placement Swarm (nullable: pass \"null\") (JSON object)")
		.option("--updateConfigSwarm <json>", "Update Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--rollbackConfigSwarm <json>", "Rollback Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--modeSwarm <json>", "Mode Swarm (nullable: pass \"null\") (JSON object)")
		.option("--labelsSwarm <json>", "Labels Swarm (nullable: pass \"null\") (JSON object)")
		.option("--networkSwarm <json>", "Network Swarm (nullable: pass \"null\") (JSON array)")
		.option("--stopGracePeriodSwarm <value>", "Stop Grace Period Swarm (nullable: pass \"null\")")
		.option("--endpointSpecSwarm <json>", "Endpoint Spec Swarm (nullable: pass \"null\") (JSON object)")
		.option("--ulimitsSwarm <json>", "Ulimits Swarm (nullable: pass \"null\") (JSON array)")
		.option("--replicas <value>", "Replicas")
		.option("--createdAt <value>", "Created At")
		.option("--environmentId <value>", "Environment Id")
		.option("--replicaSets [boolean]", "Replica Sets")
		.option("--no-replicaSets", "Set replicaSets to false")
		.option("--networkIds <json>", "Network Ids (nullable: pass \"null\") (JSON array)")
		.option("--detachNotployNetwork [boolean]", "Detach Notploy Network")
		.option("--no-detachNotployNetwork", "Set detachNotployNetwork to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mongo.update", "post", options, { required: ["mongoId"], types: {"args":"array?","command":"string?","cpuLimit":"string?","cpuReservation":"string?","description":"string?","detachNotployNetwork":"boolean","endpointSpecSwarm":"object?","env":"string?","externalPort":"number?","healthCheckSwarm":"object?","labelsSwarm":"object?","memoryLimit":"string?","memoryReservation":"string?","modeSwarm":"object?","networkIds":"array?","networkSwarm":"array?","placementSwarm":"object?","replicas":"number","replicaSets":"boolean","restartPolicySwarm":"object?","rollbackConfigSwarm":"object?","stopGracePeriodSwarm":"number?","ulimitsSwarm":"array?","updateConfigSwarm":"object?"}, enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	const g_mounts = program.command("mounts").description("mounts commands");
	g_mounts
		.command("all-named-by-application-id")
		.description("All Named By Application Id")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mounts.allNamedByApplicationId", "get", options, { required: ["applicationId"] }),
		);
	g_mounts
		.command("create")
		.description("Create")
		.option("--type <value>", "Type [required] (one of: bind, volume, file)")
		.option("--hostPath <value>", "Host Path (nullable: pass \"null\")")
		.option("--volumeName <value>", "Volume Name (nullable: pass \"null\")")
		.option("--content <value>", "Content (nullable: pass \"null\")")
		.option("--mountPath <value>", "Mount Path [required]")
		.option("--filePath <value>", "File Path (nullable: pass \"null\")")
		.option("--serviceType <value>", "Service Type (one of: application, postgres, mysql, mariadb, mongo, redis, compose, libsql)")
		.option("--serviceId <value>", "Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mounts.create", "post", options, { required: ["type","mountPath","serviceId"], types: {"content":"string?","filePath":"string?","hostPath":"string?","volumeName":"string?"}, enums: {"serviceType":["application","postgres","mysql","mariadb","mongo","redis","compose","libsql"],"type":["bind","volume","file"]} }),
		);
	g_mounts
		.command("list-by-service-id")
		.description("List By Service Id")
		.option("--serviceType <value>", "Service Type [required]")
		.option("--serviceId <value>", "Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mounts.listByServiceId", "get", options, { required: ["serviceType","serviceId"] }),
		);
	g_mounts
		.command("one")
		.description("One")
		.option("--mountId <value>", "Mount Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mounts.one", "get", options, { required: ["mountId"] }),
		);
	g_mounts
		.command("remove")
		.description("Remove")
		.option("--mountId <value>", "Mount Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mounts.remove", "post", options, { required: ["mountId"] }),
		);
	g_mounts
		.command("update")
		.description("Update")
		.option("--mountId <value>", "Mount Id [required]")
		.option("--type <value>", "Type (one of: bind, volume, file)")
		.option("--hostPath <value>", "Host Path (nullable: pass \"null\")")
		.option("--volumeName <value>", "Volume Name (nullable: pass \"null\")")
		.option("--filePath <value>", "File Path (nullable: pass \"null\")")
		.option("--content <value>", "Content (nullable: pass \"null\")")
		.option("--serviceType <value>", "Service Type (one of: application, postgres, mysql, mariadb, mongo, redis, compose, libsql)")
		.option("--mountPath <value>", "Mount Path")
		.option("--applicationId <value>", "Application Id (nullable: pass \"null\")")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--libsqlId <value>", "Libsql Id (nullable: pass \"null\")")
		.option("--mariadbId <value>", "Mariadb Id (nullable: pass \"null\")")
		.option("--mongoId <value>", "Mongo Id (nullable: pass \"null\")")
		.option("--mysqlId <value>", "Mysql Id (nullable: pass \"null\")")
		.option("--postgresId <value>", "Postgres Id (nullable: pass \"null\")")
		.option("--redisId <value>", "Redis Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mounts.update", "post", options, { required: ["mountId"], types: {"applicationId":"string?","composeId":"string?","content":"string?","filePath":"string?","hostPath":"string?","libsqlId":"string?","mariadbId":"string?","mongoId":"string?","mysqlId":"string?","postgresId":"string?","redisId":"string?","volumeName":"string?"}, enums: {"serviceType":["application","postgres","mysql","mariadb","mongo","redis","compose","libsql"],"type":["bind","volume","file"]} }),
		);
	const g_mysql = program.command("mysql").description("mysql commands");
	g_mysql
		.command("change-password")
		.description("Change Password")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--password <value>", "Password [required]")
		.option("--type <value>", "Type (one of: user, root) (default: \"user\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.changePassword", "post", options, { required: ["mysqlId","password"], enums: {"type":["user","root"]} }),
		);
	g_mysql
		.command("change-status")
		.description("Change Status")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--applicationStatus <value>", "Application Status [required] (one of: idle, running, done, error)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.changeStatus", "post", options, { required: ["mysqlId","applicationStatus"], enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	g_mysql
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--appName <value>", "App Name")
		.option("--dockerImage <value>", "Docker Image (default: \"mysql:8\")")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databaseName <value>", "Database Name [required]")
		.option("--databaseUser <value>", "Database User [required]")
		.option("--databasePassword <value>", "Database Password [required]")
		.option("--databaseRootPassword <value>", "Database Root Password")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.create", "post", options, { required: ["name","environmentId","databaseName","databaseUser","databasePassword"], types: {"description":"string?","serverId":"string?"} }),
		);
	g_mysql
		.command("deploy")
		.description("Deploy")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.deploy", "post", options, { required: ["mysqlId"] }),
		);
	g_mysql
		.command("move")
		.description("Move")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.move", "post", options, { required: ["mysqlId","targetEnvironmentId"] }),
		);
	g_mysql
		.command("one")
		.description("One")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.one", "get", options, { required: ["mysqlId"] }),
		);
	g_mysql
		.command("read-logs")
		.description("Read Logs")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.readLogs", "get", options, { required: ["mysqlId"], types: {"tail":"number"} }),
		);
	g_mysql
		.command("rebuild")
		.description("Rebuild")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.rebuild", "post", options, { required: ["mysqlId"] }),
		);
	g_mysql
		.command("reload")
		.description("Reload")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.reload", "post", options, { required: ["mysqlId","appName"] }),
		);
	g_mysql
		.command("remove")
		.description("Remove")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.remove", "post", options, { required: ["mysqlId"] }),
		);
	g_mysql
		.command("save-environment")
		.description("Save Environment")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.saveEnvironment", "post", options, { required: ["mysqlId","env"], types: {"env":"string?"} }),
		);
	g_mysql
		.command("save-external-port")
		.description("Save External Port")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--externalPort <value>", "External Port [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.saveExternalPort", "post", options, { required: ["mysqlId","externalPort"], types: {"externalPort":"number?"} }),
		);
	g_mysql
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--environmentId <value>", "Environment Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_mysql
		.command("start")
		.description("Start")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.start", "post", options, { required: ["mysqlId"] }),
		);
	g_mysql
		.command("stop")
		.description("Stop")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.stop", "post", options, { required: ["mysqlId"] }),
		);
	g_mysql
		.command("update")
		.description("Update")
		.option("--mysqlId <value>", "Mysql Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databaseName <value>", "Database Name")
		.option("--databaseUser <value>", "Database User")
		.option("--databasePassword <value>", "Database Password")
		.option("--databaseRootPassword <value>", "Database Root Password")
		.option("--dockerImage <value>", "Docker Image")
		.option("--command <value>", "Command (nullable: pass \"null\")")
		.option("--args <json>", "Args (nullable: pass \"null\") (JSON array)")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--memoryReservation <value>", "Memory Reservation (nullable: pass \"null\")")
		.option("--memoryLimit <value>", "Memory Limit (nullable: pass \"null\")")
		.option("--cpuReservation <value>", "Cpu Reservation (nullable: pass \"null\")")
		.option("--cpuLimit <value>", "Cpu Limit (nullable: pass \"null\")")
		.option("--externalPort <value>", "External Port (nullable: pass \"null\")")
		.option("--applicationStatus <value>", "Application Status (one of: idle, running, done, error)")
		.option("--healthCheckSwarm <json>", "Health Check Swarm (nullable: pass \"null\") (JSON object)")
		.option("--restartPolicySwarm <json>", "Restart Policy Swarm (nullable: pass \"null\") (JSON object)")
		.option("--placementSwarm <json>", "Placement Swarm (nullable: pass \"null\") (JSON object)")
		.option("--updateConfigSwarm <json>", "Update Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--rollbackConfigSwarm <json>", "Rollback Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--modeSwarm <json>", "Mode Swarm (nullable: pass \"null\") (JSON object)")
		.option("--labelsSwarm <json>", "Labels Swarm (nullable: pass \"null\") (JSON object)")
		.option("--networkSwarm <json>", "Network Swarm (nullable: pass \"null\") (JSON array)")
		.option("--stopGracePeriodSwarm <value>", "Stop Grace Period Swarm (nullable: pass \"null\")")
		.option("--endpointSpecSwarm <json>", "Endpoint Spec Swarm (nullable: pass \"null\") (JSON object)")
		.option("--ulimitsSwarm <json>", "Ulimits Swarm (nullable: pass \"null\") (JSON array)")
		.option("--replicas <value>", "Replicas")
		.option("--createdAt <value>", "Created At")
		.option("--environmentId <value>", "Environment Id")
		.option("--networkIds <json>", "Network Ids (nullable: pass \"null\") (JSON array)")
		.option("--detachNotployNetwork [boolean]", "Detach Notploy Network")
		.option("--no-detachNotployNetwork", "Set detachNotployNetwork to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "mysql.update", "post", options, { required: ["mysqlId"], types: {"args":"array?","command":"string?","cpuLimit":"string?","cpuReservation":"string?","description":"string?","detachNotployNetwork":"boolean","endpointSpecSwarm":"object?","env":"string?","externalPort":"number?","healthCheckSwarm":"object?","labelsSwarm":"object?","memoryLimit":"string?","memoryReservation":"string?","modeSwarm":"object?","networkIds":"array?","networkSwarm":"array?","placementSwarm":"object?","replicas":"number","restartPolicySwarm":"object?","rollbackConfigSwarm":"object?","stopGracePeriodSwarm":"number?","ulimitsSwarm":"array?","updateConfigSwarm":"object?"}, enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	const g_network = program.command("network").description("network commands");
	g_network
		.command("all")
		.description("All")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.all", "get", options),
		);
	g_network
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--driver <value>", "Driver (one of: bridge, overlay)")
		.option("--internal [boolean]", "Internal")
		.option("--no-internal", "Set internal to false")
		.option("--attachable [boolean]", "Attachable")
		.option("--no-attachable", "Set attachable to false")
		.option("--enableIPv4 [boolean]", "Enable IPv4")
		.option("--no-enableIPv4", "Set enableIPv4 to false")
		.option("--enableIPv6 [boolean]", "Enable IPv6")
		.option("--no-enableIPv6", "Set enableIPv6 to false")
		.option("--mtu <value>", "Mtu (nullable: pass \"null\")")
		.option("--ipam <json>", "Ipam (nullable: pass \"null\") (JSON object)")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--networkProviderId <value>", "Network Provider Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.create", "post", options, { required: ["name"], types: {"attachable":"boolean","enableIPv4":"boolean","enableIPv6":"boolean","internal":"boolean","ipam":"object?","mtu":"number?","networkProviderId":"string?","serverId":"string?"}, enums: {"driver":["bridge","overlay"]} }),
		);
	g_network
		.command("import")
		.description("Import")
		.option("--serverId <value>", "Server Id")
		.option("--names <json>", "Names [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.import", "post", options, { required: ["names"], types: {"names":"array"} }),
		);
	g_network
		.command("inspect")
		.description("Inspect")
		.option("--networkId <value>", "Network Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.inspect", "get", options, { required: ["networkId"] }),
		);
	g_network
		.command("inventory")
		.description("Inventory")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.inventory", "get", options),
		);
	g_network
		.command("networks-to-sync")
		.description("Networks To Sync")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.networksToSync", "get", options),
		);
	g_network
		.command("one")
		.description("One")
		.option("--networkId <value>", "Network Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.one", "get", options, { required: ["networkId"] }),
		);
	g_network
		.command("recreate")
		.description("Recreate")
		.option("--networkId <value>", "Network Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.recreate", "post", options, { required: ["networkId"] }),
		);
	g_network
		.command("remove")
		.description("Remove")
		.option("--networkId <value>", "Network Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.remove", "post", options, { required: ["networkId"] }),
		);
	g_network
		.command("resync")
		.description("Resync")
		.option("--networkId <value>", "Network Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "network.resync", "post", options, { required: ["networkId"] }),
		);
	const g_networkProvider = program.command("network-provider").description("networkProvider commands");
	g_networkProvider
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.all", "get", options),
		);
	g_networkProvider
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--peers <json>", "Peers (default: []) (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.create", "post", options, { required: ["name","config"], types: {"config":"object","peers":"array"} }),
		);
	g_networkProvider
		.command("descriptors")
		.description("Descriptors")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.descriptors", "get", options),
		);
	g_networkProvider
		.command("health")
		.description("Health")
		.option("--networkProviderId <value>", "Network Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.health", "get", options, { required: ["networkProviderId"] }),
		);
	g_networkProvider
		.command("one")
		.description("One")
		.option("--networkProviderId <value>", "Network Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.one", "get", options, { required: ["networkProviderId"] }),
		);
	g_networkProvider
		.command("peers")
		.description("Peers")
		.option("--networkProviderId <value>", "Network Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.peers", "get", options, { required: ["networkProviderId"] }),
		);
	g_networkProvider
		.command("remove")
		.description("Remove")
		.option("--networkProviderId <value>", "Network Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.remove", "post", options, { required: ["networkProviderId"] }),
		);
	g_networkProvider
		.command("test-connection")
		.description("Test Connection")
		.option("--networkProviderId <value>", "Network Provider Id")
		.option("--config <json>", "Config (JSON object)")
		.option("--peers <json>", "Peers (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.testConnection", "post", options, { types: {"config":"object","peers":"array"} }),
		);
	g_networkProvider
		.command("update")
		.description("Update")
		.option("--networkProviderId <value>", "Network Provider Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--peers <json>", "Peers (default: []) (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "networkProvider.update", "post", options, { required: ["networkProviderId","name","config"], types: {"config":"object","peers":"array"} }),
		);
	const g_notification = program.command("notification").description("notification commands");
	g_notification
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.all", "get", options),
		);
	g_notification
		.command("create-custom")
		.description("Create Custom")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--endpoint <value>", "Endpoint [required]")
		.option("--headers <json>", "Headers (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createCustom", "post", options, { required: ["name","endpoint"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","headers":"object","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-discord")
		.description("Create Discord")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--decoration [boolean]", "Decoration [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createDiscord", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","webhookUrl","decoration"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","decoration":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-email")
		.description("Create Email")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--smtpServer <value>", "Smtp Server [required]")
		.option("--smtpPort <value>", "Smtp Port [required]")
		.option("--username <value>", "Username [required]")
		.option("--password <value>", "Password [required]")
		.option("--fromAddress <value>", "From Address [required]")
		.option("--toAddresses <json>", "To Addresses [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createEmail", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","smtpServer","smtpPort","username","password","fromAddress","toAddresses"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","smtpPort":"number","toAddresses":"array","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-gotify")
		.description("Create Gotify")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--serverUrl <value>", "Server Url [required]")
		.option("--appToken <value>", "App Token [required]")
		.option("--priority <value>", "Priority [required]")
		.option("--decoration [boolean]", "Decoration [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createGotify", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","serverUrl","appToken","priority","decoration"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","decoration":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","priority":"number","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-lark")
		.description("Create Lark")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createLark", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","webhookUrl"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-mattermost")
		.description("Create Mattermost")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--channel <value>", "Channel")
		.option("--username <value>", "Username")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createMattermost", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","webhookUrl"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-ntfy")
		.description("Create Ntfy")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--serverUrl <value>", "Server Url [required]")
		.option("--topic <value>", "Topic [required]")
		.option("--accessToken <value>", "Access Token [required]")
		.option("--priority <value>", "Priority [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createNtfy", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","serverUrl","topic","accessToken","priority"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","priority":"number","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-pushover")
		.description("Create Pushover")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--userKey <value>", "User Key [required]")
		.option("--apiToken <value>", "Api Token [required]")
		.option("--priority <value>", "Priority (default: 0)")
		.option("--retry <value>", "Retry (nullable: pass \"null\")")
		.option("--expire <value>", "Expire (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createPushover", "post", options, { required: ["name","userKey","apiToken"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","expire":"number?","notployBackup":"boolean","notployRestart":"boolean","priority":"number","retry":"number?","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-resend")
		.description("Create Resend")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--apiKey <value>", "Api Key [required]")
		.option("--fromAddress <value>", "From Address [required]")
		.option("--toAddresses <json>", "To Addresses [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createResend", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","apiKey","fromAddress","toAddresses"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","toAddresses":"array","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-slack")
		.description("Create Slack")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--channel <value>", "Channel [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createSlack", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","webhookUrl","channel"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-teams")
		.description("Create Teams")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createTeams", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","webhookUrl"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("create-telegram")
		.description("Create Telegram")
		.option("--appBuildError [boolean]", "App Build Error [required]")
		.option("--databaseBackup [boolean]", "Database Backup [required]")
		.option("--notployBackup [boolean]", "Notploy Backup [required]")
		.option("--volumeBackup [boolean]", "Volume Backup [required]")
		.option("--notployRestart [boolean]", "Notploy Restart [required]")
		.option("--name <value>", "Name [required]")
		.option("--appDeploy [boolean]", "App Deploy [required]")
		.option("--dockerCleanup [boolean]", "Docker Cleanup [required]")
		.option("--serverThreshold [boolean]", "Server Threshold [required]")
		.option("--botToken <value>", "Bot Token [required]")
		.option("--chatId <value>", "Chat Id [required]")
		.option("--messageThreadId <value>", "Message Thread Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.createTelegram", "post", options, { required: ["appBuildError","databaseBackup","notployBackup","volumeBackup","notployRestart","name","appDeploy","dockerCleanup","serverThreshold","botToken","chatId","messageThreadId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("get-email-providers")
		.description("Get Email Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.getEmailProviders", "get", options),
		);
	g_notification
		.command("one")
		.description("One")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.one", "get", options, { required: ["notificationId"] }),
		);
	g_notification
		.command("receive-notification")
		.description("Receive Notification")
		.option("--ServerType <value>", "Server Type (one of: Notploy, Remote) (default: \"Notploy\")")
		.option("--Type <value>", "Type [required] (one of: Memory, CPU)")
		.option("--Value <value>", "Value [required]")
		.option("--Threshold <value>", "Threshold [required]")
		.option("--Message <value>", "Message [required]")
		.option("--Timestamp <value>", "Timestamp [required]")
		.option("--Token <value>", "Token [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.receiveNotification", "post", options, { required: ["Type","Value","Threshold","Message","Timestamp","Token"], types: {"Threshold":"number","Value":"number"}, enums: {"ServerType":["Notploy","Remote"],"Type":["Memory","CPU"]} }),
		);
	g_notification
		.command("remove")
		.description("Remove")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.remove", "post", options, { required: ["notificationId"] }),
		);
	g_notification
		.command("test-custom-connection")
		.description("Test Custom Connection")
		.option("--endpoint <value>", "Endpoint [required]")
		.option("--headers <json>", "Headers (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testCustomConnection", "post", options, { required: ["endpoint"], types: {"headers":"object"} }),
		);
	g_notification
		.command("test-discord-connection")
		.description("Test Discord Connection")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--decoration [boolean]", "Decoration")
		.option("--no-decoration", "Set decoration to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testDiscordConnection", "post", options, { required: ["webhookUrl"], types: {"decoration":"boolean"} }),
		);
	g_notification
		.command("test-email-connection")
		.description("Test Email Connection")
		.option("--smtpServer <value>", "Smtp Server [required]")
		.option("--smtpPort <value>", "Smtp Port [required]")
		.option("--username <value>", "Username [required]")
		.option("--password <value>", "Password [required]")
		.option("--toAddresses <json>", "To Addresses [required] (JSON array)")
		.option("--fromAddress <value>", "From Address [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testEmailConnection", "post", options, { required: ["smtpServer","smtpPort","username","password","toAddresses","fromAddress"], types: {"smtpPort":"number","toAddresses":"array"} }),
		);
	g_notification
		.command("test-gotify-connection")
		.description("Test Gotify Connection")
		.option("--serverUrl <value>", "Server Url [required]")
		.option("--appToken <value>", "App Token [required]")
		.option("--priority <value>", "Priority [required]")
		.option("--decoration [boolean]", "Decoration")
		.option("--no-decoration", "Set decoration to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testGotifyConnection", "post", options, { required: ["serverUrl","appToken","priority"], types: {"decoration":"boolean","priority":"number"} }),
		);
	g_notification
		.command("test-lark-connection")
		.description("Test Lark Connection")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testLarkConnection", "post", options, { required: ["webhookUrl"] }),
		);
	g_notification
		.command("test-mattermost-connection")
		.description("Test Mattermost Connection")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--channel <value>", "Channel")
		.option("--username <value>", "Username")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testMattermostConnection", "post", options, { required: ["webhookUrl"] }),
		);
	g_notification
		.command("test-ntfy-connection")
		.description("Test Ntfy Connection")
		.option("--serverUrl <value>", "Server Url [required]")
		.option("--topic <value>", "Topic [required]")
		.option("--accessToken <value>", "Access Token [required]")
		.option("--priority <value>", "Priority [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testNtfyConnection", "post", options, { required: ["serverUrl","topic","accessToken","priority"], types: {"priority":"number"} }),
		);
	g_notification
		.command("test-pushover-connection")
		.description("Test Pushover Connection")
		.option("--userKey <value>", "User Key [required]")
		.option("--apiToken <value>", "Api Token [required]")
		.option("--priority <value>", "Priority [required]")
		.option("--retry <value>", "Retry (nullable: pass \"null\")")
		.option("--expire <value>", "Expire (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testPushoverConnection", "post", options, { required: ["userKey","apiToken","priority"], types: {"expire":"number?","priority":"number","retry":"number?"} }),
		);
	g_notification
		.command("test-resend-connection")
		.description("Test Resend Connection")
		.option("--apiKey <value>", "Api Key [required]")
		.option("--fromAddress <value>", "From Address [required]")
		.option("--toAddresses <json>", "To Addresses [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testResendConnection", "post", options, { required: ["apiKey","fromAddress","toAddresses"], types: {"toAddresses":"array"} }),
		);
	g_notification
		.command("test-slack-connection")
		.description("Test Slack Connection")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--channel <value>", "Channel [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testSlackConnection", "post", options, { required: ["webhookUrl","channel"] }),
		);
	g_notification
		.command("test-teams-connection")
		.description("Test Teams Connection")
		.option("--webhookUrl <value>", "Webhook Url [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testTeamsConnection", "post", options, { required: ["webhookUrl"] }),
		);
	g_notification
		.command("test-telegram-connection")
		.description("Test Telegram Connection")
		.option("--botToken <value>", "Bot Token [required]")
		.option("--chatId <value>", "Chat Id [required]")
		.option("--messageThreadId <value>", "Message Thread Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.testTelegramConnection", "post", options, { required: ["botToken","chatId","messageThreadId"] }),
		);
	g_notification
		.command("update-custom")
		.description("Update Custom")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--endpoint <value>", "Endpoint")
		.option("--headers <json>", "Headers (JSON object)")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--customId <value>", "Custom Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateCustom", "post", options, { required: ["notificationId","customId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","headers":"object","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-discord")
		.description("Update Discord")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--webhookUrl <value>", "Webhook Url")
		.option("--decoration [boolean]", "Decoration")
		.option("--no-decoration", "Set decoration to false")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--discordId <value>", "Discord Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateDiscord", "post", options, { required: ["notificationId","discordId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","decoration":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-email")
		.description("Update Email")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--smtpServer <value>", "Smtp Server")
		.option("--smtpPort <value>", "Smtp Port")
		.option("--username <value>", "Username")
		.option("--password <value>", "Password")
		.option("--fromAddress <value>", "From Address")
		.option("--toAddresses <json>", "To Addresses (JSON array)")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--emailId <value>", "Email Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateEmail", "post", options, { required: ["notificationId","emailId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","smtpPort":"number","toAddresses":"array","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-gotify")
		.description("Update Gotify")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--serverUrl <value>", "Server Url")
		.option("--appToken <value>", "App Token")
		.option("--priority <value>", "Priority")
		.option("--decoration [boolean]", "Decoration")
		.option("--no-decoration", "Set decoration to false")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--gotifyId <value>", "Gotify Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateGotify", "post", options, { required: ["notificationId","gotifyId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","decoration":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","priority":"number","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-lark")
		.description("Update Lark")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--webhookUrl <value>", "Webhook Url")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--larkId <value>", "Lark Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateLark", "post", options, { required: ["notificationId","larkId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-mattermost")
		.description("Update Mattermost")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--webhookUrl <value>", "Webhook Url")
		.option("--channel <value>", "Channel")
		.option("--username <value>", "Username")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--mattermostId <value>", "Mattermost Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateMattermost", "post", options, { required: ["notificationId","mattermostId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-ntfy")
		.description("Update Ntfy")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--serverUrl <value>", "Server Url")
		.option("--topic <value>", "Topic")
		.option("--accessToken <value>", "Access Token")
		.option("--priority <value>", "Priority")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--ntfyId <value>", "Ntfy Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateNtfy", "post", options, { required: ["notificationId","ntfyId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","priority":"number","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-pushover")
		.description("Update Pushover")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--pushoverId <value>", "Pushover Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--userKey <value>", "User Key")
		.option("--apiToken <value>", "Api Token")
		.option("--priority <value>", "Priority")
		.option("--retry <value>", "Retry (nullable: pass \"null\")")
		.option("--expire <value>", "Expire (nullable: pass \"null\")")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updatePushover", "post", options, { required: ["notificationId","pushoverId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","expire":"number?","notployBackup":"boolean","notployRestart":"boolean","priority":"number","retry":"number?","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-resend")
		.description("Update Resend")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--apiKey <value>", "Api Key")
		.option("--fromAddress <value>", "From Address")
		.option("--toAddresses <json>", "To Addresses (JSON array)")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--resendId <value>", "Resend Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateResend", "post", options, { required: ["notificationId","resendId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","toAddresses":"array","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-slack")
		.description("Update Slack")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--webhookUrl <value>", "Webhook Url")
		.option("--channel <value>", "Channel")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--slackId <value>", "Slack Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateSlack", "post", options, { required: ["notificationId","slackId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-teams")
		.description("Update Teams")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--webhookUrl <value>", "Webhook Url")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--teamsId <value>", "Teams Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateTeams", "post", options, { required: ["notificationId","teamsId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	g_notification
		.command("update-telegram")
		.description("Update Telegram")
		.option("--appBuildError [boolean]", "App Build Error")
		.option("--no-appBuildError", "Set appBuildError to false")
		.option("--databaseBackup [boolean]", "Database Backup")
		.option("--no-databaseBackup", "Set databaseBackup to false")
		.option("--notployBackup [boolean]", "Notploy Backup")
		.option("--no-notployBackup", "Set notployBackup to false")
		.option("--volumeBackup [boolean]", "Volume Backup")
		.option("--no-volumeBackup", "Set volumeBackup to false")
		.option("--notployRestart [boolean]", "Notploy Restart")
		.option("--no-notployRestart", "Set notployRestart to false")
		.option("--name <value>", "Name")
		.option("--appDeploy [boolean]", "App Deploy")
		.option("--no-appDeploy", "Set appDeploy to false")
		.option("--dockerCleanup [boolean]", "Docker Cleanup")
		.option("--no-dockerCleanup", "Set dockerCleanup to false")
		.option("--serverThreshold [boolean]", "Server Threshold")
		.option("--no-serverThreshold", "Set serverThreshold to false")
		.option("--botToken <value>", "Bot Token")
		.option("--chatId <value>", "Chat Id")
		.option("--messageThreadId <value>", "Message Thread Id")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--telegramId <value>", "Telegram Id [required]")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "notification.updateTelegram", "post", options, { required: ["notificationId","telegramId"], types: {"appBuildError":"boolean","appDeploy":"boolean","databaseBackup":"boolean","dockerCleanup":"boolean","notployBackup":"boolean","notployRestart":"boolean","serverThreshold":"boolean","volumeBackup":"boolean"} }),
		);
	const g_objectStorage = program.command("object-storage").description("objectStorage commands");
	g_objectStorage
		.command("bucket")
		.description("Bucket")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.bucket", "get", options, { required: ["objectStorageBucketId"] }),
		);
	g_objectStorage
		.command("buckets")
		.description("Buckets")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.buckets", "get", options),
		);
	g_objectStorage
		.command("buckets-by-provider")
		.description("Buckets By Provider")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.bucketsByProvider", "get", options, { required: ["objectStorageProviderId"] }),
		);
	g_objectStorage
		.command("create-bucket")
		.description("Create Bucket")
		.option("--name <value>", "Name [required]")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id [required]")
		.option("--bucket <value>", "Bucket [required]")
		.option("--region <value>", "Region (default: \"\")")
		.option("--endpoint <value>", "Endpoint (default: \"\")")
		.option("--versioning [boolean]", "Versioning (default: false)")
		.option("--no-versioning", "Set versioning to false")
		.option("--lifecycle <json>", "Lifecycle (default: []) (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.createBucket", "post", options, { required: ["name","objectStorageProviderId","bucket"], types: {"lifecycle":"array","versioning":"boolean"} }),
		);
	g_objectStorage
		.command("create-provider")
		.description("Create Provider")
		.option("--name <value>", "Name [required]")
		.option("--providerType <value>", "Provider Type [required] (one of: aws, cloudflare-r2, scaleway, wasabi, digitalocean, backblaze, ovh, linode, storj, idrive, minio, rustfs, ceph, seaweedfs, garage, s3-compatible, notploy-internal)")
		.option("--category <value>", "Category [required] (one of: external, self-hosted, internal)")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.createProvider", "post", options, { required: ["name","providerType","category","config"], types: {"config":"object"}, enums: {"category":["external","self-hosted","internal"],"providerType":["aws","cloudflare-r2","scaleway","wasabi","digitalocean","backblaze","ovh","linode","storj","idrive","minio","rustfs","ceph","seaweedfs","garage","s3-compatible","notploy-internal"]} }),
		);
	g_objectStorage
		.command("descriptors")
		.description("Descriptors")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.descriptors", "get", options),
		);
	g_objectStorage
		.command("provider")
		.description("Provider")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.provider", "get", options, { required: ["objectStorageProviderId"] }),
		);
	g_objectStorage
		.command("provider-health")
		.description("Provider Health")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.providerHealth", "get", options, { required: ["objectStorageProviderId"] }),
		);
	g_objectStorage
		.command("providers")
		.description("Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.providers", "get", options),
		);
	g_objectStorage
		.command("remove-bucket")
		.description("Remove Bucket")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.removeBucket", "post", options, { required: ["objectStorageBucketId"] }),
		);
	g_objectStorage
		.command("remove-provider")
		.description("Remove Provider")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.removeProvider", "post", options, { required: ["objectStorageProviderId"] }),
		);
	g_objectStorage
		.command("test-bucket")
		.description("Test Bucket")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.testBucket", "post", options, { required: ["objectStorageBucketId"] }),
		);
	g_objectStorage
		.command("test-connection")
		.description("Test Connection")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id")
		.option("--providerType <value>", "Provider Type (one of: aws, cloudflare-r2, scaleway, wasabi, digitalocean, backblaze, ovh, linode, storj, idrive, minio, rustfs, ceph, seaweedfs, garage, s3-compatible, notploy-internal)")
		.option("--category <value>", "Category (one of: external, self-hosted, internal)")
		.option("--config <json>", "Config (JSON object)")
		.option("--bucket <value>", "Bucket")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.testConnection", "post", options, { types: {"config":"object"}, enums: {"category":["external","self-hosted","internal"],"providerType":["aws","cloudflare-r2","scaleway","wasabi","digitalocean","backblaze","ovh","linode","storj","idrive","minio","rustfs","ceph","seaweedfs","garage","s3-compatible","notploy-internal"]} }),
		);
	g_objectStorage
		.command("update-bucket")
		.description("Update Bucket")
		.option("--name <value>", "Name [required]")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id [required]")
		.option("--bucket <value>", "Bucket [required]")
		.option("--region <value>", "Region (default: \"\")")
		.option("--endpoint <value>", "Endpoint (default: \"\")")
		.option("--versioning [boolean]", "Versioning (default: false)")
		.option("--no-versioning", "Set versioning to false")
		.option("--lifecycle <json>", "Lifecycle (default: []) (JSON array)")
		.option("--objectStorageBucketId <value>", "Object Storage Bucket Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.updateBucket", "post", options, { required: ["name","objectStorageProviderId","bucket","objectStorageBucketId"], types: {"lifecycle":"array","versioning":"boolean"} }),
		);
	g_objectStorage
		.command("update-provider")
		.description("Update Provider")
		.option("--name <value>", "Name [required]")
		.option("--providerType <value>", "Provider Type [required] (one of: aws, cloudflare-r2, scaleway, wasabi, digitalocean, backblaze, ovh, linode, storj, idrive, minio, rustfs, ceph, seaweedfs, garage, s3-compatible, notploy-internal)")
		.option("--category <value>", "Category [required] (one of: external, self-hosted, internal)")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--serverId <value>", "Server Id")
		.option("--objectStorageProviderId <value>", "Object Storage Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "objectStorage.updateProvider", "post", options, { required: ["name","providerType","category","config","objectStorageProviderId"], types: {"config":"object"}, enums: {"category":["external","self-hosted","internal"],"providerType":["aws","cloudflare-r2","scaleway","wasabi","digitalocean","backblaze","ovh","linode","storj","idrive","minio","rustfs","ceph","seaweedfs","garage","s3-compatible","notploy-internal"]} }),
		);
	const g_onion = program.command("onion").description("onion commands");
	g_onion
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--serviceName <value>", "Service Name [required]")
		.option("--targetPort <value>", "Target Port [required]")
		.option("--virtualPort <value>", "Virtual Port")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.create", "post", options, { required: ["name","composeId","serviceName","targetPort"], types: {"targetPort":"number","virtualPort":"number"} }),
		);
	g_onion
		.command("delete")
		.description("Delete")
		.option("--onionServiceId <value>", "Onion Service Id [required]")
		.option("--deleteIdentity [boolean]", "Delete Identity (default: false)")
		.option("--no-deleteIdentity", "Set deleteIdentity to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.delete", "post", options, { required: ["onionServiceId"], types: {"deleteIdentity":"boolean"} }),
		);
	g_onion
		.command("list")
		.description("List")
		.option("--composeId <value>", "Compose Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.list", "get", options, { required: ["composeId"] }),
		);
	g_onion
		.command("one")
		.description("One")
		.option("--onionServiceId <value>", "Onion Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.one", "get", options, { required: ["onionServiceId"] }),
		);
	g_onion
		.command("restart")
		.description("Restart")
		.option("--onionServiceId <value>", "Onion Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.restart", "post", options, { required: ["onionServiceId"] }),
		);
	g_onion
		.command("start")
		.description("Start")
		.option("--onionServiceId <value>", "Onion Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.start", "post", options, { required: ["onionServiceId"] }),
		);
	g_onion
		.command("status")
		.description("Status")
		.option("--onionServiceId <value>", "Onion Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.status", "get", options, { required: ["onionServiceId"] }),
		);
	g_onion
		.command("stop")
		.description("Stop")
		.option("--onionServiceId <value>", "Onion Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.stop", "post", options, { required: ["onionServiceId"] }),
		);
	g_onion
		.command("update")
		.description("Update")
		.option("--name <value>", "Name")
		.option("--serviceName <value>", "Service Name")
		.option("--targetPort <value>", "Target Port")
		.option("--virtualPort <value>", "Virtual Port")
		.option("--onionServiceId <value>", "Onion Service Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "onion.update", "post", options, { required: ["onionServiceId"], types: {"targetPort":"number","virtualPort":"number"} }),
		);
	const g_operationalEvent = program.command("operational-event").description("operationalEvent commands");
	g_operationalEvent
		.command("acknowledge")
		.description("Acknowledge")
		.option("--eventId <value>", "Event Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "operationalEvent.acknowledge", "post", options, { required: ["eventId"] }),
		);
	g_operationalEvent
		.command("list")
		.description("List")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "operationalEvent.list", "get", options),
		);
	const g_organization = program.command("organization").description("organization commands");
	g_organization
		.command("active")
		.description("Active")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.active", "get", options),
		);
	g_organization
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.all", "get", options),
		);
	g_organization
		.command("all-invitations")
		.description("All Invitations")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.allInvitations", "get", options),
		);
	g_organization
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--logo <value>", "Logo")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.create", "post", options, { required: ["name"] }),
		);
	g_organization
		.command("delete")
		.description("Delete")
		.option("--organizationId <value>", "Organization Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.delete", "post", options, { required: ["organizationId"] }),
		);
	g_organization
		.command("invite-member")
		.description("Invite Member")
		.option("--email <value>", "Email [required]")
		.option("--role <value>", "Role [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.inviteMember", "post", options, { required: ["email","role"] }),
		);
	g_organization
		.command("one")
		.description("One")
		.option("--organizationId <value>", "Organization Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.one", "get", options, { required: ["organizationId"] }),
		);
	g_organization
		.command("remove-invitation")
		.description("Remove Invitation")
		.option("--invitationId <value>", "Invitation Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.removeInvitation", "post", options, { required: ["invitationId"] }),
		);
	g_organization
		.command("set-default")
		.description("Set Default")
		.option("--organizationId <value>", "Organization Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.setDefault", "post", options, { required: ["organizationId"] }),
		);
	g_organization
		.command("update")
		.description("Update")
		.option("--organizationId <value>", "Organization Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--logo <value>", "Logo")
		.option("--defaultRole <value>", "Default Role (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.update", "post", options, { required: ["organizationId","name"], types: {"defaultRole":"string?"} }),
		);
	g_organization
		.command("update-member-role")
		.description("Update Member Role")
		.option("--memberId <value>", "Member Id [required]")
		.option("--role <value>", "Role [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "organization.updateMemberRole", "post", options, { required: ["memberId","role"] }),
		);
	const g_overview = program.command("overview").description("overview commands");
	g_overview
		.command("backups")
		.description("Backups")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "overview.backups", "get", options),
		);
	g_overview
		.command("domains")
		.description("Domains")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "overview.domains", "get", options),
		);
	g_overview
		.command("services")
		.description("Services")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "overview.services", "get", options),
		);
	const g_patch = program.command("patch").description("patch commands");
	g_patch
		.command("by-entity-id")
		.description("By Entity Id")
		.option("--id <value>", "Id [required]")
		.option("--type <value>", "Type [required] (one of: application, compose)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.byEntityId", "get", options, { required: ["id","type"], enums: {"type":["application","compose"]} }),
		);
	g_patch
		.command("clean-patch-repos")
		.description("Clean Patch Repos")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.cleanPatchRepos", "post", options),
		);
	g_patch
		.command("create")
		.description("Create")
		.option("--filePath <value>", "File Path [required]")
		.option("--content <value>", "Content [required]")
		.option("--type <value>", "Type (one of: create, update, delete)")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--applicationId <value>", "Application Id (nullable: pass \"null\")")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.create", "post", options, { required: ["filePath","content"], types: {"applicationId":"string?","composeId":"string?","enabled":"boolean"}, enums: {"type":["create","update","delete"]} }),
		);
	g_patch
		.command("delete")
		.description("Delete")
		.option("--patchId <value>", "Patch Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.delete", "post", options, { required: ["patchId"] }),
		);
	g_patch
		.command("ensure-repo")
		.description("Ensure Repo")
		.option("--id <value>", "Id [required]")
		.option("--type <value>", "Type [required] (one of: application, compose)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.ensureRepo", "post", options, { required: ["id","type"], enums: {"type":["application","compose"]} }),
		);
	g_patch
		.command("mark-file-for-deletion")
		.description("Mark File For Deletion")
		.option("--id <value>", "Id [required]")
		.option("--type <value>", "Type [required] (one of: application, compose)")
		.option("--filePath <value>", "File Path [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.markFileForDeletion", "post", options, { required: ["id","type","filePath"], enums: {"type":["application","compose"]} }),
		);
	g_patch
		.command("one")
		.description("One")
		.option("--patchId <value>", "Patch Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.one", "get", options, { required: ["patchId"] }),
		);
	g_patch
		.command("read-repo-directories")
		.description("Read Repo Directories")
		.option("--id <value>", "Id [required]")
		.option("--type <value>", "Type [required] (one of: application, compose)")
		.option("--repoPath <value>", "Repo Path [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.readRepoDirectories", "get", options, { required: ["id","type","repoPath"], enums: {"type":["application","compose"]} }),
		);
	g_patch
		.command("read-repo-file")
		.description("Read Repo File")
		.option("--id <value>", "Id [required]")
		.option("--type <value>", "Type [required] (one of: application, compose)")
		.option("--filePath <value>", "File Path [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.readRepoFile", "get", options, { required: ["id","type","filePath"], enums: {"type":["application","compose"]} }),
		);
	g_patch
		.command("save-file-as-patch")
		.description("Save File As Patch")
		.option("--id <value>", "Id [required]")
		.option("--type <value>", "Type [required] (one of: application, compose)")
		.option("--filePath <value>", "File Path [required]")
		.option("--content <value>", "Content [required]")
		.option("--patchType <value>", "Patch Type (one of: create, update) (default: \"update\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.saveFileAsPatch", "post", options, { required: ["id","type","filePath","content"], enums: {"patchType":["create","update"],"type":["application","compose"]} }),
		);
	g_patch
		.command("toggle-enabled")
		.description("Toggle Enabled")
		.option("--patchId <value>", "Patch Id [required]")
		.option("--enabled [boolean]", "Enabled [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.toggleEnabled", "post", options, { required: ["patchId","enabled"], types: {"enabled":"boolean"} }),
		);
	g_patch
		.command("update")
		.description("Update")
		.option("--patchId <value>", "Patch Id [required]")
		.option("--type <value>", "Type (one of: create, update, delete)")
		.option("--filePath <value>", "File Path")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--content <value>", "Content")
		.option("--createdAt <value>", "Created At")
		.option("--updatedAt <value>", "Updated At (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "patch.update", "post", options, { required: ["patchId"], types: {"enabled":"boolean","updatedAt":"string?"}, enums: {"type":["create","update","delete"]} }),
		);
	const g_port = program.command("port").description("port commands");
	g_port
		.command("create")
		.description("Create")
		.option("--publishedPort <value>", "Published Port [required]")
		.option("--publishMode <value>", "Publish Mode [required] (one of: ingress, host) (default: \"ingress\")")
		.option("--targetPort <value>", "Target Port [required]")
		.option("--protocol <value>", "Protocol [required] (one of: tcp, udp) (default: \"tcp\")")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "port.create", "post", options, { required: ["publishedPort","publishMode","targetPort","protocol","applicationId"], types: {"publishedPort":"number","targetPort":"number"}, enums: {"protocol":["tcp","udp"],"publishMode":["ingress","host"]} }),
		);
	g_port
		.command("delete")
		.description("Delete")
		.option("--portId <value>", "Port Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "port.delete", "post", options, { required: ["portId"] }),
		);
	g_port
		.command("one")
		.description("One")
		.option("--portId <value>", "Port Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "port.one", "get", options, { required: ["portId"] }),
		);
	g_port
		.command("update")
		.description("Update")
		.option("--portId <value>", "Port Id [required]")
		.option("--publishedPort <value>", "Published Port [required]")
		.option("--publishMode <value>", "Publish Mode [required] (one of: ingress, host) (default: \"ingress\")")
		.option("--targetPort <value>", "Target Port [required]")
		.option("--protocol <value>", "Protocol [required] (one of: tcp, udp) (default: \"tcp\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "port.update", "post", options, { required: ["portId","publishedPort","publishMode","targetPort","protocol"], types: {"publishedPort":"number","targetPort":"number"}, enums: {"protocol":["tcp","udp"],"publishMode":["ingress","host"]} }),
		);
	const g_postgres = program.command("postgres").description("postgres commands");
	g_postgres
		.command("change-password")
		.description("Change Password")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--password <value>", "Password [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.changePassword", "post", options, { required: ["postgresId","password"] }),
		);
	g_postgres
		.command("change-status")
		.description("Change Status")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--applicationStatus <value>", "Application Status [required] (one of: idle, running, done, error)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.changeStatus", "post", options, { required: ["postgresId","applicationStatus"], enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	g_postgres
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--appName <value>", "App Name")
		.option("--databaseName <value>", "Database Name [required]")
		.option("--databaseUser <value>", "Database User [required]")
		.option("--databasePassword <value>", "Database Password [required]")
		.option("--dockerImage <value>", "Docker Image (default: \"postgres:18\")")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.create", "post", options, { required: ["name","databaseName","databaseUser","databasePassword","environmentId"], types: {"description":"string?","serverId":"string?"} }),
		);
	g_postgres
		.command("deploy")
		.description("Deploy")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.deploy", "post", options, { required: ["postgresId"] }),
		);
	g_postgres
		.command("move")
		.description("Move")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.move", "post", options, { required: ["postgresId","targetEnvironmentId"] }),
		);
	g_postgres
		.command("one")
		.description("One")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.one", "get", options, { required: ["postgresId"] }),
		);
	g_postgres
		.command("read-logs")
		.description("Read Logs")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.readLogs", "get", options, { required: ["postgresId"], types: {"tail":"number"} }),
		);
	g_postgres
		.command("rebuild")
		.description("Rebuild")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.rebuild", "post", options, { required: ["postgresId"] }),
		);
	g_postgres
		.command("reload")
		.description("Reload")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.reload", "post", options, { required: ["postgresId","appName"] }),
		);
	g_postgres
		.command("remove")
		.description("Remove")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.remove", "post", options, { required: ["postgresId"] }),
		);
	g_postgres
		.command("save-environment")
		.description("Save Environment")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.saveEnvironment", "post", options, { required: ["postgresId","env"], types: {"env":"string?"} }),
		);
	g_postgres
		.command("save-external-port")
		.description("Save External Port")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--externalPort <value>", "External Port [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.saveExternalPort", "post", options, { required: ["postgresId","externalPort"], types: {"externalPort":"number?"} }),
		);
	g_postgres
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--environmentId <value>", "Environment Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_postgres
		.command("start")
		.description("Start")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.start", "post", options, { required: ["postgresId"] }),
		);
	g_postgres
		.command("stop")
		.description("Stop")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.stop", "post", options, { required: ["postgresId"] }),
		);
	g_postgres
		.command("update")
		.description("Update")
		.option("--postgresId <value>", "Postgres Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--databaseName <value>", "Database Name")
		.option("--databaseUser <value>", "Database User")
		.option("--databasePassword <value>", "Database Password")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--dockerImage <value>", "Docker Image")
		.option("--command <value>", "Command (nullable: pass \"null\")")
		.option("--args <json>", "Args (nullable: pass \"null\") (JSON array)")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--memoryReservation <value>", "Memory Reservation (nullable: pass \"null\")")
		.option("--externalPort <value>", "External Port (nullable: pass \"null\")")
		.option("--memoryLimit <value>", "Memory Limit (nullable: pass \"null\")")
		.option("--cpuReservation <value>", "Cpu Reservation (nullable: pass \"null\")")
		.option("--cpuLimit <value>", "Cpu Limit (nullable: pass \"null\")")
		.option("--applicationStatus <value>", "Application Status (one of: idle, running, done, error)")
		.option("--healthCheckSwarm <json>", "Health Check Swarm (nullable: pass \"null\") (JSON object)")
		.option("--restartPolicySwarm <json>", "Restart Policy Swarm (nullable: pass \"null\") (JSON object)")
		.option("--placementSwarm <json>", "Placement Swarm (nullable: pass \"null\") (JSON object)")
		.option("--updateConfigSwarm <json>", "Update Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--rollbackConfigSwarm <json>", "Rollback Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--modeSwarm <json>", "Mode Swarm (nullable: pass \"null\") (JSON object)")
		.option("--labelsSwarm <json>", "Labels Swarm (nullable: pass \"null\") (JSON object)")
		.option("--networkSwarm <json>", "Network Swarm (nullable: pass \"null\") (JSON array)")
		.option("--stopGracePeriodSwarm <value>", "Stop Grace Period Swarm (nullable: pass \"null\")")
		.option("--endpointSpecSwarm <json>", "Endpoint Spec Swarm (nullable: pass \"null\") (JSON object)")
		.option("--ulimitsSwarm <json>", "Ulimits Swarm (nullable: pass \"null\") (JSON array)")
		.option("--replicas <value>", "Replicas")
		.option("--createdAt <value>", "Created At")
		.option("--environmentId <value>", "Environment Id")
		.option("--networkIds <json>", "Network Ids (nullable: pass \"null\") (JSON array)")
		.option("--detachNotployNetwork [boolean]", "Detach Notploy Network")
		.option("--no-detachNotployNetwork", "Set detachNotployNetwork to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "postgres.update", "post", options, { required: ["postgresId"], types: {"args":"array?","command":"string?","cpuLimit":"string?","cpuReservation":"string?","description":"string?","detachNotployNetwork":"boolean","endpointSpecSwarm":"object?","env":"string?","externalPort":"number?","healthCheckSwarm":"object?","labelsSwarm":"object?","memoryLimit":"string?","memoryReservation":"string?","modeSwarm":"object?","networkIds":"array?","networkSwarm":"array?","placementSwarm":"object?","replicas":"number","restartPolicySwarm":"object?","rollbackConfigSwarm":"object?","stopGracePeriodSwarm":"number?","ulimitsSwarm":"array?","updateConfigSwarm":"object?"}, enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	const g_previewDeployment = program.command("preview-deployment").description("previewDeployment commands");
	g_previewDeployment
		.command("all")
		.description("All")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "previewDeployment.all", "get", options, { required: ["applicationId"] }),
		);
	g_previewDeployment
		.command("delete")
		.description("Delete")
		.option("--previewDeploymentId <value>", "Preview Deployment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "previewDeployment.delete", "post", options, { required: ["previewDeploymentId"] }),
		);
	g_previewDeployment
		.command("one")
		.description("One")
		.option("--previewDeploymentId <value>", "Preview Deployment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "previewDeployment.one", "get", options, { required: ["previewDeploymentId"] }),
		);
	g_previewDeployment
		.command("redeploy")
		.description("Redeploy")
		.option("--previewDeploymentId <value>", "Preview Deployment Id [required]")
		.option("--title <value>", "Title")
		.option("--description <value>", "Description")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "previewDeployment.redeploy", "post", options, { required: ["previewDeploymentId"] }),
		);
	const g_project = program.command("project").description("project commands");
	g_project
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.all", "get", options),
		);
	g_project
		.command("all-for-permissions")
		.description("All For Permissions")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.allForPermissions", "get", options),
		);
	g_project
		.command("complete-onboarding")
		.description("Complete Onboarding")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.completeOnboarding", "post", options),
		);
	g_project
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--env <value>", "Env")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.create", "post", options, { required: ["name"], types: {"description":"string?"} }),
		);
	g_project
		.command("duplicate")
		.description("Duplicate")
		.option("--sourceEnvironmentId <value>", "Source Environment Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description")
		.option("--includeServices [boolean]", "Include Services (default: true)")
		.option("--no-includeServices", "Set includeServices to false")
		.option("--selectedServices <json>", "Selected Services (JSON array)")
		.option("--duplicateInSameProject [boolean]", "Duplicate In Same Project (default: false)")
		.option("--no-duplicateInSameProject", "Set duplicateInSameProject to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.duplicate", "post", options, { required: ["sourceEnvironmentId","name"], types: {"duplicateInSameProject":"boolean","includeServices":"boolean","selectedServices":"array"} }),
		);
	g_project
		.command("home-stats")
		.description("Home Stats")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.homeStats", "get", options),
		);
	g_project
		.command("onboarding-status")
		.description("Onboarding Status")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.onboardingStatus", "get", options),
		);
	g_project
		.command("one")
		.description("One")
		.option("--projectId <value>", "Project Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.one", "get", options, { required: ["projectId"] }),
		);
	g_project
		.command("remove")
		.description("Remove")
		.option("--projectId <value>", "Project Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.remove", "post", options, { required: ["projectId"] }),
		);
	g_project
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--description <value>", "Description")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_project
		.command("update")
		.description("Update")
		.option("--projectId <value>", "Project Id [required]")
		.option("--name <value>", "Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--createdAt <value>", "Created At")
		.option("--organizationId <value>", "Organization Id")
		.option("--env <value>", "Env")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "project.update", "post", options, { required: ["projectId"], types: {"description":"string?"} }),
		);
	const g_redirects = program.command("redirects").description("redirects commands");
	g_redirects
		.command("create")
		.description("Create")
		.option("--regex <value>", "Regex [required]")
		.option("--replacement <value>", "Replacement [required]")
		.option("--permanent [boolean]", "Permanent [required]")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redirects.create", "post", options, { required: ["regex","replacement","permanent","applicationId"], types: {"permanent":"boolean"} }),
		);
	g_redirects
		.command("delete")
		.description("Delete")
		.option("--redirectId <value>", "Redirect Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redirects.delete", "post", options, { required: ["redirectId"] }),
		);
	g_redirects
		.command("one")
		.description("One")
		.option("--redirectId <value>", "Redirect Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redirects.one", "get", options, { required: ["redirectId"] }),
		);
	g_redirects
		.command("update")
		.description("Update")
		.option("--redirectId <value>", "Redirect Id [required]")
		.option("--regex <value>", "Regex [required]")
		.option("--replacement <value>", "Replacement [required]")
		.option("--permanent [boolean]", "Permanent [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redirects.update", "post", options, { required: ["redirectId","regex","replacement","permanent"], types: {"permanent":"boolean"} }),
		);
	const g_redis = program.command("redis").description("redis commands");
	g_redis
		.command("change-password")
		.description("Change Password")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--password <value>", "Password [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.changePassword", "post", options, { required: ["redisId","password"] }),
		);
	g_redis
		.command("change-status")
		.description("Change Status")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--applicationStatus <value>", "Application Status [required] (one of: idle, running, done, error)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.changeStatus", "post", options, { required: ["redisId","applicationStatus"], enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	g_redis
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--appName <value>", "App Name")
		.option("--databasePassword <value>", "Database Password [required]")
		.option("--dockerImage <value>", "Docker Image (default: \"redis:8\")")
		.option("--environmentId <value>", "Environment Id [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.create", "post", options, { required: ["name","databasePassword","environmentId"], types: {"description":"string?","serverId":"string?"} }),
		);
	g_redis
		.command("deploy")
		.description("Deploy")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.deploy", "post", options, { required: ["redisId"] }),
		);
	g_redis
		.command("move")
		.description("Move")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--targetEnvironmentId <value>", "Target Environment Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.move", "post", options, { required: ["redisId","targetEnvironmentId"] }),
		);
	g_redis
		.command("one")
		.description("One")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.one", "get", options, { required: ["redisId"] }),
		);
	g_redis
		.command("read-logs")
		.description("Read Logs")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--tail <value>", "Tail (default: 100)")
		.option("--since <value>", "Since (default: \"all\")")
		.option("--search <value>", "Search")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.readLogs", "get", options, { required: ["redisId"], types: {"tail":"number"} }),
		);
	g_redis
		.command("rebuild")
		.description("Rebuild")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.rebuild", "post", options, { required: ["redisId"] }),
		);
	g_redis
		.command("reload")
		.description("Reload")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.reload", "post", options, { required: ["redisId","appName"] }),
		);
	g_redis
		.command("remove")
		.description("Remove")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.remove", "post", options, { required: ["redisId"] }),
		);
	g_redis
		.command("save-environment")
		.description("Save Environment")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--env <value>", "Env [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.saveEnvironment", "post", options, { required: ["redisId","env"], types: {"env":"string?"} }),
		);
	g_redis
		.command("save-external-port")
		.description("Save External Port")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--externalPort <value>", "External Port [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.saveExternalPort", "post", options, { required: ["redisId","externalPort"], types: {"externalPort":"number?"} }),
		);
	g_redis
		.command("search")
		.description("Search")
		.option("--q <value>", "Q")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description")
		.option("--projectId <value>", "Project Id")
		.option("--environmentId <value>", "Environment Id")
		.option("--limit <value>", "Limit (default: 20)")
		.option("--offset <value>", "Offset (default: 0)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.search", "get", options, { types: {"limit":"number","offset":"number"} }),
		);
	g_redis
		.command("start")
		.description("Start")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.start", "post", options, { required: ["redisId"] }),
		);
	g_redis
		.command("stop")
		.description("Stop")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.stop", "post", options, { required: ["redisId"] }),
		);
	g_redis
		.command("update")
		.description("Update")
		.option("--redisId <value>", "Redis Id [required]")
		.option("--name <value>", "Name")
		.option("--appName <value>", "App Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--databasePassword <value>", "Database Password")
		.option("--dockerImage <value>", "Docker Image")
		.option("--command <value>", "Command (nullable: pass \"null\")")
		.option("--args <json>", "Args (nullable: pass \"null\") (JSON array)")
		.option("--env <value>", "Env (nullable: pass \"null\")")
		.option("--memoryReservation <value>", "Memory Reservation (nullable: pass \"null\")")
		.option("--memoryLimit <value>", "Memory Limit (nullable: pass \"null\")")
		.option("--cpuReservation <value>", "Cpu Reservation (nullable: pass \"null\")")
		.option("--cpuLimit <value>", "Cpu Limit (nullable: pass \"null\")")
		.option("--externalPort <value>", "External Port (nullable: pass \"null\")")
		.option("--createdAt <value>", "Created At")
		.option("--applicationStatus <value>", "Application Status (one of: idle, running, done, error)")
		.option("--healthCheckSwarm <json>", "Health Check Swarm (nullable: pass \"null\") (JSON object)")
		.option("--restartPolicySwarm <json>", "Restart Policy Swarm (nullable: pass \"null\") (JSON object)")
		.option("--placementSwarm <json>", "Placement Swarm (nullable: pass \"null\") (JSON object)")
		.option("--updateConfigSwarm <json>", "Update Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--rollbackConfigSwarm <json>", "Rollback Config Swarm (nullable: pass \"null\") (JSON object)")
		.option("--modeSwarm <json>", "Mode Swarm (nullable: pass \"null\") (JSON object)")
		.option("--labelsSwarm <json>", "Labels Swarm (nullable: pass \"null\") (JSON object)")
		.option("--networkSwarm <json>", "Network Swarm (nullable: pass \"null\") (JSON array)")
		.option("--stopGracePeriodSwarm <value>", "Stop Grace Period Swarm (nullable: pass \"null\")")
		.option("--endpointSpecSwarm <json>", "Endpoint Spec Swarm (nullable: pass \"null\") (JSON object)")
		.option("--ulimitsSwarm <json>", "Ulimits Swarm (nullable: pass \"null\") (JSON array)")
		.option("--replicas <value>", "Replicas")
		.option("--environmentId <value>", "Environment Id")
		.option("--networkIds <json>", "Network Ids (nullable: pass \"null\") (JSON array)")
		.option("--detachNotployNetwork [boolean]", "Detach Notploy Network")
		.option("--no-detachNotployNetwork", "Set detachNotployNetwork to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "redis.update", "post", options, { required: ["redisId"], types: {"args":"array?","command":"string?","cpuLimit":"string?","cpuReservation":"string?","description":"string?","detachNotployNetwork":"boolean","endpointSpecSwarm":"object?","env":"string?","externalPort":"number?","healthCheckSwarm":"object?","labelsSwarm":"object?","memoryLimit":"string?","memoryReservation":"string?","modeSwarm":"object?","networkIds":"array?","networkSwarm":"array?","placementSwarm":"object?","replicas":"number","restartPolicySwarm":"object?","rollbackConfigSwarm":"object?","stopGracePeriodSwarm":"number?","ulimitsSwarm":"array?","updateConfigSwarm":"object?"}, enums: {"applicationStatus":["idle","running","done","error"]} }),
		);
	const g_registry = program.command("registry").description("registry commands");
	g_registry
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.all", "get", options),
		);
	g_registry
		.command("capabilities")
		.description("Capabilities")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.capabilities", "get", options, { required: ["registryId"] }),
		);
	g_registry
		.command("create")
		.description("Create")
		.option("--registryName <value>", "Registry Name [required]")
		.option("--providerType <value>", "Provider Type (one of: docker-hub, ghcr, gitlab, ecr, gar, acr, quay, artifactory, harbor, zot, distribution, nexus, generic-oci) (default: \"generic-oci\")")
		.option("--username <value>", "Username (nullable: pass \"null\")")
		.option("--password <value>", "Password (nullable: pass \"null\")")
		.option("--registryUrl <value>", "Registry Url [required]")
		.option("--namespace <value>", "Namespace (nullable: pass \"null\")")
		.option("--imagePrefix <value>", "Image Prefix (nullable: pass \"null\")")
		.option("--authMethod <value>", "Auth Method (one of: none, basic, token) (default: \"basic\")")
		.option("--credentialSource <value>", "Credential Source (one of: secret, inline) (default: \"inline\")")
		.option("--vaultSecretId <value>", "Vault Secret Id (nullable: pass \"null\")")
		.option("--allowAnonymous [boolean]", "Allow Anonymous (default: false)")
		.option("--no-allowAnonymous", "Set allowAnonymous to false")
		.option("--registryType <value>", "Registry Type (one of: cloud, selfHosted) (default: \"cloud\")")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.create", "post", options, { required: ["registryName","registryUrl"], types: {"allowAnonymous":"boolean","imagePrefix":"string?","namespace":"string?","password":"string?","username":"string?","vaultSecretId":"string?"}, enums: {"authMethod":["none","basic","token"],"credentialSource":["secret","inline"],"providerType":["docker-hub","ghcr","gitlab","ecr","gar","acr","quay","artifactory","harbor","zot","distribution","nexus","generic-oci"],"registryType":["cloud","selfHosted"]} }),
		);
	g_registry
		.command("delete-image")
		.description("Delete Image")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--repository <value>", "Repository [required]")
		.option("--digest <value>", "Digest [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.deleteImage", "post", options, { required: ["registryId","repository","digest"] }),
		);
	g_registry
		.command("descriptors")
		.description("Descriptors")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.descriptors", "get", options),
		);
	g_registry
		.command("get-digest")
		.description("Get Digest")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--repository <value>", "Repository [required]")
		.option("--reference <value>", "Reference [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.getDigest", "get", options, { required: ["registryId","repository","reference"] }),
		);
	g_registry
		.command("get-manifest")
		.description("Get Manifest")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--repository <value>", "Repository [required]")
		.option("--reference <value>", "Reference [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.getManifest", "get", options, { required: ["registryId","repository","reference"] }),
		);
	g_registry
		.command("health")
		.description("Health")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.health", "get", options, { required: ["registryId"] }),
		);
	g_registry
		.command("list-repositories")
		.description("List Repositories")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.listRepositories", "get", options, { required: ["registryId"] }),
		);
	g_registry
		.command("list-tags")
		.description("List Tags")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--repository <value>", "Repository [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.listTags", "get", options, { required: ["registryId","repository"] }),
		);
	g_registry
		.command("one")
		.description("One")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.one", "get", options, { required: ["registryId"] }),
		);
	g_registry
		.command("remove")
		.description("Remove")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.remove", "post", options, { required: ["registryId"] }),
		);
	g_registry
		.command("secret-options")
		.description("Secret Options")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.secretOptions", "get", options),
		);
	g_registry
		.command("test-connection")
		.description("Test Connection")
		.option("--registryId <value>", "Registry Id")
		.option("--providerType <value>", "Provider Type (one of: docker-hub, ghcr, gitlab, ecr, gar, acr, quay, artifactory, harbor, zot, distribution, nexus, generic-oci)")
		.option("--registryUrl <value>", "Registry Url")
		.option("--namespace <value>", "Namespace (nullable: pass \"null\")")
		.option("--authMethod <value>", "Auth Method (one of: none, basic, token)")
		.option("--credentialSource <value>", "Credential Source (one of: secret, inline)")
		.option("--vaultSecretId <value>", "Vault Secret Id (nullable: pass \"null\")")
		.option("--username <value>", "Username (nullable: pass \"null\")")
		.option("--password <value>", "Password (nullable: pass \"null\")")
		.option("--allowAnonymous [boolean]", "Allow Anonymous")
		.option("--no-allowAnonymous", "Set allowAnonymous to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.testConnection", "post", options, { types: {"allowAnonymous":"boolean","namespace":"string?","password":"string?","username":"string?","vaultSecretId":"string?"}, enums: {"authMethod":["none","basic","token"],"credentialSource":["secret","inline"],"providerType":["docker-hub","ghcr","gitlab","ecr","gar","acr","quay","artifactory","harbor","zot","distribution","nexus","generic-oci"]} }),
		);
	g_registry
		.command("test-registry")
		.description("Test Registry")
		.option("--registryId <value>", "Registry Id")
		.option("--providerType <value>", "Provider Type (one of: docker-hub, ghcr, gitlab, ecr, gar, acr, quay, artifactory, harbor, zot, distribution, nexus, generic-oci)")
		.option("--registryUrl <value>", "Registry Url")
		.option("--namespace <value>", "Namespace (nullable: pass \"null\")")
		.option("--authMethod <value>", "Auth Method (one of: none, basic, token)")
		.option("--credentialSource <value>", "Credential Source (one of: secret, inline)")
		.option("--vaultSecretId <value>", "Vault Secret Id (nullable: pass \"null\")")
		.option("--username <value>", "Username (nullable: pass \"null\")")
		.option("--password <value>", "Password (nullable: pass \"null\")")
		.option("--allowAnonymous [boolean]", "Allow Anonymous")
		.option("--no-allowAnonymous", "Set allowAnonymous to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.testRegistry", "post", options, { types: {"allowAnonymous":"boolean","namespace":"string?","password":"string?","username":"string?","vaultSecretId":"string?"}, enums: {"authMethod":["none","basic","token"],"credentialSource":["secret","inline"],"providerType":["docker-hub","ghcr","gitlab","ecr","gar","acr","quay","artifactory","harbor","zot","distribution","nexus","generic-oci"]} }),
		);
	g_registry
		.command("test-registry-by-id")
		.description("Test Registry By Id")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.testRegistryById", "post", options, { required: ["registryId"] }),
		);
	g_registry
		.command("update")
		.description("Update")
		.option("--registryId <value>", "Registry Id [required]")
		.option("--registryName <value>", "Registry Name")
		.option("--providerType <value>", "Provider Type (one of: docker-hub, ghcr, gitlab, ecr, gar, acr, quay, artifactory, harbor, zot, distribution, nexus, generic-oci)")
		.option("--registryUrl <value>", "Registry Url")
		.option("--namespace <value>", "Namespace (nullable: pass \"null\")")
		.option("--imagePrefix <value>", "Image Prefix (nullable: pass \"null\")")
		.option("--authMethod <value>", "Auth Method (one of: none, basic, token)")
		.option("--credentialSource <value>", "Credential Source (one of: secret, inline)")
		.option("--vaultSecretId <value>", "Vault Secret Id (nullable: pass \"null\")")
		.option("--username <value>", "Username (nullable: pass \"null\")")
		.option("--password <value>", "Password (nullable: pass \"null\")")
		.option("--allowAnonymous [boolean]", "Allow Anonymous")
		.option("--no-allowAnonymous", "Set allowAnonymous to false")
		.option("--createdAt <value>", "Created At")
		.option("--registryType <value>", "Registry Type (one of: cloud, selfHosted)")
		.option("--organizationId <value>", "Organization Id")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "registry.update", "post", options, { required: ["registryId"], types: {"allowAnonymous":"boolean","imagePrefix":"string?","namespace":"string?","password":"string?","username":"string?","vaultSecretId":"string?"}, enums: {"authMethod":["none","basic","token"],"credentialSource":["secret","inline"],"providerType":["docker-hub","ghcr","gitlab","ecr","gar","acr","quay","artifactory","harbor","zot","distribution","nexus","generic-oci"],"registryType":["cloud","selfHosted"]} }),
		);
	const g_rollback = program.command("rollback").description("rollback commands");
	g_rollback
		.command("delete")
		.description("Delete")
		.option("--rollbackId <value>", "Rollback Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "rollback.delete", "post", options, { required: ["rollbackId"] }),
		);
	g_rollback
		.command("rollback")
		.description("Rollback")
		.option("--rollbackId <value>", "Rollback Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "rollback.rollback", "post", options, { required: ["rollbackId"] }),
		);
	const g_schedule = program.command("schedule").description("schedule commands");
	g_schedule
		.command("create")
		.description("Create")
		.option("--scheduleId <value>", "Schedule Id")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--cronExpression <value>", "Cron Expression [required]")
		.option("--appName <value>", "App Name")
		.option("--serviceName <value>", "Service Name (nullable: pass \"null\")")
		.option("--shellType <value>", "Shell Type (one of: bash, sh)")
		.option("--scheduleType <value>", "Schedule Type (one of: application, compose, server, notploy-server)")
		.option("--command <value>", "Command [required]")
		.option("--script <value>", "Script (nullable: pass \"null\")")
		.option("--applicationId <value>", "Application Id (nullable: pass \"null\")")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--organizationId <value>", "Organization Id (nullable: pass \"null\")")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--timezone <value>", "Timezone (nullable: pass \"null\")")
		.option("--createdAt <value>", "Created At")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "schedule.create", "post", options, { required: ["name","cronExpression","command"], types: {"applicationId":"string?","composeId":"string?","description":"string?","enabled":"boolean","organizationId":"string?","script":"string?","serverId":"string?","serviceName":"string?","timezone":"string?"}, enums: {"scheduleType":["application","compose","server","notploy-server"],"shellType":["bash","sh"]} }),
		);
	g_schedule
		.command("delete")
		.description("Delete")
		.option("--scheduleId <value>", "Schedule Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "schedule.delete", "post", options, { required: ["scheduleId"] }),
		);
	g_schedule
		.command("list")
		.description("List")
		.option("--id <value>", "Id [required]")
		.option("--scheduleType <value>", "Schedule Type [required] (one of: application, compose, server, notploy-server)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "schedule.list", "get", options, { required: ["id","scheduleType"], enums: {"scheduleType":["application","compose","server","notploy-server"]} }),
		);
	g_schedule
		.command("one")
		.description("One")
		.option("--scheduleId <value>", "Schedule Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "schedule.one", "get", options, { required: ["scheduleId"] }),
		);
	g_schedule
		.command("run-manually")
		.description("Run Manually")
		.option("--scheduleId <value>", "Schedule Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "schedule.runManually", "post", options, { required: ["scheduleId"] }),
		);
	g_schedule
		.command("update")
		.description("Update")
		.option("--scheduleId <value>", "Schedule Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--cronExpression <value>", "Cron Expression [required]")
		.option("--appName <value>", "App Name")
		.option("--serviceName <value>", "Service Name (nullable: pass \"null\")")
		.option("--shellType <value>", "Shell Type (one of: bash, sh)")
		.option("--scheduleType <value>", "Schedule Type (one of: application, compose, server, notploy-server)")
		.option("--command <value>", "Command [required]")
		.option("--script <value>", "Script (nullable: pass \"null\")")
		.option("--applicationId <value>", "Application Id (nullable: pass \"null\")")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--serverId <value>", "Server Id (nullable: pass \"null\")")
		.option("--organizationId <value>", "Organization Id (nullable: pass \"null\")")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--timezone <value>", "Timezone (nullable: pass \"null\")")
		.option("--createdAt <value>", "Created At")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "schedule.update", "post", options, { required: ["scheduleId","name","cronExpression","command"], types: {"applicationId":"string?","composeId":"string?","description":"string?","enabled":"boolean","organizationId":"string?","script":"string?","serverId":"string?","serviceName":"string?","timezone":"string?"}, enums: {"scheduleType":["application","compose","server","notploy-server"],"shellType":["bash","sh"]} }),
		);
	const g_scim = program.command("scim").description("scim commands");
	g_scim
		.command("delete-provider")
		.description("Delete Provider")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "scim.deleteProvider", "post", options, { required: ["providerId"] }),
		);
	g_scim
		.command("generate-token")
		.description("Generate Token")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "scim.generateToken", "post", options, { required: ["providerId"] }),
		);
	g_scim
		.command("list-providers")
		.description("List Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "scim.listProviders", "get", options),
		);
	const g_security = program.command("security").description("security commands");
	g_security
		.command("create")
		.description("Create")
		.option("--applicationId <value>", "Application Id [required]")
		.option("--username <value>", "Username [required]")
		.option("--password <value>", "Password [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "security.create", "post", options, { required: ["applicationId","username","password"] }),
		);
	g_security
		.command("delete")
		.description("Delete")
		.option("--securityId <value>", "Security Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "security.delete", "post", options, { required: ["securityId"] }),
		);
	g_security
		.command("one")
		.description("One")
		.option("--securityId <value>", "Security Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "security.one", "get", options, { required: ["securityId"] }),
		);
	g_security
		.command("update")
		.description("Update")
		.option("--securityId <value>", "Security Id [required]")
		.option("--username <value>", "Username [required]")
		.option("--password <value>", "Password [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "security.update", "post", options, { required: ["securityId","username","password"] }),
		);
	const g_server = program.command("server").description("server commands");
	g_server
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.all", "get", options),
		);
	g_server
		.command("all-for-permissions")
		.description("All For Permissions")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.allForPermissions", "get", options),
		);
	g_server
		.command("build-servers")
		.description("Build Servers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.buildServers", "get", options),
		);
	g_server
		.command("count")
		.description("Count")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.count", "get", options),
		);
	g_server
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description [required] (nullable: pass \"null\")")
		.option("--ipAddress <value>", "Ip Address [required]")
		.option("--port <value>", "Port [required]")
		.option("--username <value>", "Username [required]")
		.option("--sshKeyId <value>", "Ssh Key Id [required] (nullable: pass \"null\")")
		.option("--serverType <value>", "Server Type [required] (one of: deploy, build)")
		.option("--enableDockerCleanup [boolean]", "Enable Docker Cleanup (default: true)")
		.option("--no-enableDockerCleanup", "Set enableDockerCleanup to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.create", "post", options, { required: ["name","description","ipAddress","port","username","sshKeyId","serverType"], types: {"description":"string?","enableDockerCleanup":"boolean","port":"number","sshKeyId":"string?"}, enums: {"serverType":["deploy","build"]} }),
		);
	g_server
		.command("create-with-password")
		.description("Create With Password")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description [required] (nullable: pass \"null\")")
		.option("--ipAddress <value>", "Ip Address [required]")
		.option("--port <value>", "Port [required]")
		.option("--username <value>", "Username [required]")
		.option("--serverType <value>", "Server Type [required] (one of: deploy, build)")
		.option("--enableDockerCleanup [boolean]", "Enable Docker Cleanup (default: true)")
		.option("--no-enableDockerCleanup", "Set enableDockerCleanup to false")
		.option("--sshPassword <value>", "Ssh Password [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.createWithPassword", "post", options, { required: ["name","description","ipAddress","port","username","serverType","sshPassword"], types: {"description":"string?","enableDockerCleanup":"boolean","port":"number"}, enums: {"serverType":["deploy","build"]} }),
		);
	g_server
		.command("get-default-command")
		.description("Get Default Command")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.getDefaultCommand", "get", options, { required: ["serverId"] }),
		);
	g_server
		.command("get-monitoring-workspaces")
		.description("Get Monitoring Workspaces")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.getMonitoringWorkspaces", "get", options),
		);
	g_server
		.command("get-server-metrics")
		.description("Get Server Metrics")
		.option("--url <value>", "Url [required]")
		.option("--token <value>", "Token [required]")
		.option("--dataPoints <value>", "Data Points [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.getServerMetrics", "get", options, { required: ["url","token","dataPoints"] }),
		);
	g_server
		.command("get-server-time")
		.description("Get Server Time")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.getServerTime", "get", options),
		);
	g_server
		.command("get-services")
		.description("Get Services")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.getServices", "get", options, { required: ["serverId"] }),
		);
	g_server
		.command("one")
		.description("One")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.one", "get", options, { required: ["serverId"] }),
		);
	g_server
		.command("public-ip")
		.description("Public Ip")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.publicIp", "get", options),
		);
	g_server
		.command("remove")
		.description("Remove")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.remove", "post", options, { required: ["serverId"] }),
		);
	g_server
		.command("security")
		.description("Security")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.security", "get", options, { required: ["serverId"] }),
		);
	g_server
		.command("setup")
		.description("Setup")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.setup", "post", options, { required: ["serverId"] }),
		);
	g_server
		.command("setup-monitoring")
		.description("Setup Monitoring")
		.option("--serverId <value>", "Server Id [required]")
		.option("--metricsConfig <json>", "Metrics Config [required] (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.setupMonitoring", "post", options, { required: ["serverId","metricsConfig"], types: {"metricsConfig":"object"} }),
		);
	g_server
		.command("update")
		.description("Update")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description [required] (nullable: pass \"null\")")
		.option("--serverId <value>", "Server Id [required]")
		.option("--ipAddress <value>", "Ip Address [required]")
		.option("--port <value>", "Port [required]")
		.option("--username <value>", "Username [required]")
		.option("--sshKeyId <value>", "Ssh Key Id [required] (nullable: pass \"null\")")
		.option("--serverType <value>", "Server Type [required] (one of: deploy, build)")
		.option("--enableDockerCleanup [boolean]", "Enable Docker Cleanup (default: true)")
		.option("--no-enableDockerCleanup", "Set enableDockerCleanup to false")
		.option("--command <value>", "Command")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.update", "post", options, { required: ["name","description","serverId","ipAddress","port","username","sshKeyId","serverType"], types: {"description":"string?","enableDockerCleanup":"boolean","port":"number","sshKeyId":"string?"}, enums: {"serverType":["deploy","build"]} }),
		);
	g_server
		.command("update-builds-concurrency")
		.description("Update Builds Concurrency")
		.option("--serverId <value>", "Server Id [required]")
		.option("--buildsConcurrency <value>", "Builds Concurrency [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.updateBuildsConcurrency", "post", options, { required: ["serverId","buildsConcurrency"], types: {"buildsConcurrency":"number"} }),
		);
	g_server
		.command("validate")
		.description("Validate")
		.option("--serverId <value>", "Server Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.validate", "get", options, { required: ["serverId"] }),
		);
	g_server
		.command("with-sshkey")
		.description("With SSHKey")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "server.withSSHKey", "get", options),
		);
	const g_settings = program.command("settings").description("settings commands");
	g_settings
		.command("assign-domain-server")
		.description("Assign Domain Server")
		.option("--host <value>", "Host [required]")
		.option("--certificateType <value>", "Certificate Type (one of: letsencrypt, none, custom)")
		.option("--customCertResolver <value>", "Custom Cert Resolver (nullable: pass \"null\")")
		.option("--letsEncryptEmail <value>", "Lets Encrypt Email (one of: )")
		.option("--https [boolean]", "Https")
		.option("--no-https", "Set https to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.assignDomainServer", "post", options, { required: ["host"], types: {"customCertResolver":"string?","https":"boolean"}, enums: {"certificateType":["letsencrypt","none","custom"],"letsEncryptEmail":[""]} }),
		);
	g_settings
		.command("check-gpustatus")
		.description("Check GPUStatus")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.checkGPUStatus", "get", options),
		);
	g_settings
		.command("check-infrastructure-health")
		.description("Check Infrastructure Health")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.checkInfrastructureHealth", "get", options),
		);
	g_settings
		.command("clean-all")
		.description("Clean All")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanAll", "post", options),
		);
	g_settings
		.command("clean-all-deployment-queue")
		.description("Clean All Deployment Queue")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanAllDeploymentQueue", "post", options),
		);
	g_settings
		.command("clean-docker-builder")
		.description("Clean Docker Builder")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanDockerBuilder", "post", options),
		);
	g_settings
		.command("clean-docker-prune")
		.description("Clean Docker Prune")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanDockerPrune", "post", options),
		);
	g_settings
		.command("clean-monitoring")
		.description("Clean Monitoring")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanMonitoring", "post", options),
		);
	g_settings
		.command("clean-sshprivate-key")
		.description("Clean SSHPrivate Key")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanSSHPrivateKey", "post", options),
		);
	g_settings
		.command("clean-stopped-containers")
		.description("Clean Stopped Containers")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanStoppedContainers", "post", options),
		);
	g_settings
		.command("clean-unused-images")
		.description("Clean Unused Images")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanUnusedImages", "post", options),
		);
	g_settings
		.command("clean-unused-volumes")
		.description("Clean Unused Volumes")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.cleanUnusedVolumes", "post", options),
		);
	g_settings
		.command("get-control-plane-runtime")
		.description("Get Control Plane Runtime")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getControlPlaneRuntime", "get", options),
		);
	g_settings
		.command("get-docker-disk-usage")
		.description("Get Docker Disk Usage")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getDockerDiskUsage", "get", options),
		);
	g_settings
		.command("get-ip")
		.description("Get Ip")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getIp", "get", options),
		);
	g_settings
		.command("get-log-cleanup-status")
		.description("Get Log Cleanup Status")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getLogCleanupStatus", "get", options),
		);
	g_settings
		.command("get-notploy-cloud-ips")
		.description("Get Notploy Cloud Ips")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getNotployCloudIps", "get", options),
		);
	g_settings
		.command("get-notploy-version")
		.description("Get Notploy Version")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getNotployVersion", "get", options),
		);
	g_settings
		.command("get-open-api-document")
		.description("Get Open Api Document")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getOpenApiDocument", "get", options),
		);
	g_settings
		.command("get-product")
		.description("Get Product")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getProduct", "get", options),
		);
	g_settings
		.command("get-release-tag")
		.description("Get Release Tag")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getReleaseTag", "get", options),
		);
	g_settings
		.command("get-traefik-overview")
		.description("Get Traefik Overview")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getTraefikOverview", "get", options),
		);
	g_settings
		.command("get-traefik-ports")
		.description("Get Traefik Ports")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getTraefikPorts", "get", options),
		);
	g_settings
		.command("get-update-data")
		.description("Get Update Data")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getUpdateData", "post", options),
		);
	g_settings
		.command("get-update-status")
		.description("Get Update Status")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getUpdateStatus", "get", options),
		);
	g_settings
		.command("get-web-server-ip-candidates")
		.description("Get Web Server Ip Candidates")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getWebServerIpCandidates", "get", options),
		);
	g_settings
		.command("get-web-server-settings")
		.description("Get Web Server Settings")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.getWebServerSettings", "get", options),
		);
	g_settings
		.command("have-activate-requests")
		.description("Have Activate Requests")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.haveActivateRequests", "get", options),
		);
	g_settings
		.command("have-traefik-dashboard-port-enabled")
		.description("Have Traefik Dashboard Port Enabled")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.haveTraefikDashboardPortEnabled", "get", options),
		);
	g_settings
		.command("health")
		.description("Health")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.health", "get", options),
		);
	g_settings
		.command("is-cloud")
		.description("Is Cloud")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.isCloud", "get", options),
		);
	g_settings
		.command("is-user-subscribed")
		.description("Is User Subscribed")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.isUserSubscribed", "get", options),
		);
	g_settings
		.command("read-directories")
		.description("Read Directories")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.readDirectories", "get", options),
		);
	g_settings
		.command("read-middleware-traefik-config")
		.description("Read Middleware Traefik Config")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.readMiddlewareTraefikConfig", "get", options),
		);
	g_settings
		.command("read-traefik-config")
		.description("Read Traefik Config")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.readTraefikConfig", "get", options),
		);
	g_settings
		.command("read-traefik-env")
		.description("Read Traefik Env")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.readTraefikEnv", "get", options),
		);
	g_settings
		.command("read-traefik-file")
		.description("Read Traefik File")
		.option("--path <value>", "Path [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.readTraefikFile", "get", options, { required: ["path"] }),
		);
	g_settings
		.command("read-web-server-traefik-config")
		.description("Read Web Server Traefik Config")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.readWebServerTraefikConfig", "get", options),
		);
	g_settings
		.command("reload-server")
		.description("Reload Server")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.reloadServer", "post", options),
		);
	g_settings
		.command("reload-traefik")
		.description("Reload Traefik")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.reloadTraefik", "post", options),
		);
	g_settings
		.command("save-sshprivate-key")
		.description("Save SSHPrivate Key")
		.option("--sshPrivateKey <value>", "Ssh Private Key [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.saveSSHPrivateKey", "post", options, { required: ["sshPrivateKey"] }),
		);
	g_settings
		.command("setup-gpu")
		.description("Setup GPU")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.setupGPU", "post", options),
		);
	g_settings
		.command("toggle-dashboard")
		.description("Toggle Dashboard")
		.option("--enableDashboard [boolean]", "Enable Dashboard")
		.option("--no-enableDashboard", "Set enableDashboard to false")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.toggleDashboard", "post", options, { types: {"enableDashboard":"boolean"} }),
		);
	g_settings
		.command("toggle-requests")
		.description("Toggle Requests")
		.option("--enable [boolean]", "Enable [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.toggleRequests", "post", options, { required: ["enable"], types: {"enable":"boolean"} }),
		);
	g_settings
		.command("update-builds-concurrency")
		.description("Update Builds Concurrency")
		.option("--buildsConcurrency <value>", "Builds Concurrency [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateBuildsConcurrency", "post", options, { required: ["buildsConcurrency"], types: {"buildsConcurrency":"number"} }),
		);
	g_settings
		.command("update-docker-cleanup")
		.description("Update Docker Cleanup")
		.option("--enableDockerCleanup [boolean]", "Enable Docker Cleanup [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateDockerCleanup", "post", options, { required: ["enableDockerCleanup"], types: {"enableDockerCleanup":"boolean"} }),
		);
	g_settings
		.command("update-enforce-sso")
		.description("Update Enforce SSO")
		.option("--enforceSSO [boolean]", "Enforce SSO [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateEnforceSSO", "post", options, { required: ["enforceSSO"], types: {"enforceSSO":"boolean"} }),
		);
	g_settings
		.command("update-log-cleanup")
		.description("Update Log Cleanup")
		.option("--cronExpression <value>", "Cron Expression [required] (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateLogCleanup", "post", options, { required: ["cronExpression"], types: {"cronExpression":"string?"} }),
		);
	g_settings
		.command("update-middleware-traefik-config")
		.description("Update Middleware Traefik Config")
		.option("--traefikConfig <value>", "Traefik Config [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateMiddlewareTraefikConfig", "post", options, { required: ["traefikConfig"] }),
		);
	g_settings
		.command("update-remote-servers-only")
		.description("Update Remote Servers Only")
		.option("--remoteServersOnly [boolean]", "Remote Servers Only [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateRemoteServersOnly", "post", options, { required: ["remoteServersOnly"], types: {"remoteServersOnly":"boolean"} }),
		);
	g_settings
		.command("update-server")
		.description("Update Server")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateServer", "post", options),
		);
	g_settings
		.command("update-server-ip")
		.description("Update Server Ip")
		.option("--serverIp <value>", "Server Ip [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateServerIp", "post", options, { required: ["serverIp"] }),
		);
	g_settings
		.command("update-traefik-config")
		.description("Update Traefik Config")
		.option("--traefikConfig <value>", "Traefik Config [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateTraefikConfig", "post", options, { required: ["traefikConfig"] }),
		);
	g_settings
		.command("update-traefik-file")
		.description("Update Traefik File")
		.option("--path <value>", "Path [required]")
		.option("--traefikConfig <value>", "Traefik Config [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateTraefikFile", "post", options, { required: ["path","traefikConfig"] }),
		);
	g_settings
		.command("update-traefik-ports")
		.description("Update Traefik Ports")
		.option("--serverId <value>", "Server Id")
		.option("--additionalPorts <json>", "Additional Ports [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateTraefikPorts", "post", options, { required: ["additionalPorts"], types: {"additionalPorts":"array"} }),
		);
	g_settings
		.command("update-web-server-traefik-config")
		.description("Update Web Server Traefik Config")
		.option("--traefikConfig <value>", "Traefik Config [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.updateWebServerTraefikConfig", "post", options, { required: ["traefikConfig"] }),
		);
	g_settings
		.command("write-traefik-env")
		.description("Write Traefik Env")
		.option("--env <value>", "Env [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "settings.writeTraefikEnv", "post", options, { required: ["env"] }),
		);
	const g_sshKey = program.command("ssh-key").description("sshKey commands");
	g_sshKey
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sshKey.all", "get", options),
		);
	g_sshKey
		.command("all-for-apps")
		.description("All For Apps")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sshKey.allForApps", "get", options),
		);
	g_sshKey
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--privateKey <value>", "Private Key [required]")
		.option("--publicKey <value>", "Public Key [required]")
		.option("--organizationId <value>", "Organization Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sshKey.create", "post", options, { required: ["name","privateKey","publicKey","organizationId"], types: {"description":"string?"} }),
		);
	g_sshKey
		.command("generate")
		.description("Generate")
		.option("--type <value>", "Type (one of: rsa, ed25519)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sshKey.generate", "post", options, { enums: {"type":["rsa","ed25519"]} }),
		);
	g_sshKey
		.command("one")
		.description("One")
		.option("--sshKeyId <value>", "Ssh Key Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sshKey.one", "get", options, { required: ["sshKeyId"] }),
		);
	g_sshKey
		.command("remove")
		.description("Remove")
		.option("--sshKeyId <value>", "Ssh Key Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sshKey.remove", "post", options, { required: ["sshKeyId"] }),
		);
	g_sshKey
		.command("update")
		.description("Update")
		.option("--name <value>", "Name")
		.option("--description <value>", "Description (nullable: pass \"null\")")
		.option("--lastUsedAt <value>", "Last Used At (nullable: pass \"null\")")
		.option("--sshKeyId <value>", "Ssh Key Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sshKey.update", "post", options, { required: ["sshKeyId"], types: {"description":"string?","lastUsedAt":"string?"} }),
		);
	const g_sso = program.command("sso").description("sso commands");
	g_sso
		.command("add-trusted-origin")
		.description("Add Trusted Origin")
		.option("--origin <value>", "Origin [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.addTrustedOrigin", "post", options, { required: ["origin"] }),
		);
	g_sso
		.command("delete-provider")
		.description("Delete Provider")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.deleteProvider", "post", options, { required: ["providerId"] }),
		);
	g_sso
		.command("descriptors")
		.description("Descriptors")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.descriptors", "get", options),
		);
	g_sso
		.command("enforce-sso")
		.description("Enforce SSO")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.enforceSSO", "get", options),
		);
	g_sso
		.command("get-trusted-origins")
		.description("Get Trusted Origins")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.getTrustedOrigins", "get", options),
		);
	g_sso
		.command("health")
		.description("Health")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.health", "get", options, { required: ["providerId"] }),
		);
	g_sso
		.command("list-providers")
		.description("List Providers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.listProviders", "get", options),
		);
	g_sso
		.command("one")
		.description("One")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.one", "get", options, { required: ["providerId"] }),
		);
	g_sso
		.command("provider-kind")
		.description("Provider Kind")
		.option("--email <value>", "Email [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.providerKind", "get", options, { required: ["email"] }),
		);
	g_sso
		.command("register")
		.description("Register")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--issuer <value>", "Issuer [required]")
		.option("--domains <json>", "Domains [required] (JSON array)")
		.option("--oidcConfig <json>", "Oidc Config (JSON object)")
		.option("--samlConfig <json>", "Saml Config (JSON object)")
		.option("--ldapConfig <json>", "Ldap Config (JSON object)")
		.option("--oauthConfig <json>", "Oauth Config (JSON object)")
		.option("--organizationId <value>", "Organization Id")
		.option("--overrideUserInfo [boolean]", "Override User Info (default: false)")
		.option("--no-overrideUserInfo", "Set overrideUserInfo to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.register", "post", options, { required: ["providerId","issuer","domains"], types: {"domains":"array","ldapConfig":"object","oauthConfig":"object","oidcConfig":"object","overrideUserInfo":"boolean","samlConfig":"object"} }),
		);
	g_sso
		.command("remove-trusted-origin")
		.description("Remove Trusted Origin")
		.option("--origin <value>", "Origin [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.removeTrustedOrigin", "post", options, { required: ["origin"] }),
		);
	g_sso
		.command("show-sign-in-with-sso")
		.description("Show Sign In With SSO")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.showSignInWithSSO", "get", options),
		);
	g_sso
		.command("social-provider")
		.description("Social Provider")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.socialProvider", "get", options),
		);
	g_sso
		.command("test-connection")
		.description("Test Connection")
		.option("--providerId <value>", "Provider Id")
		.option("--issuer <value>", "Issuer [required]")
		.option("--oidcConfig <json>", "Oidc Config (JSON object)")
		.option("--samlConfig <json>", "Saml Config (JSON object)")
		.option("--ldapConfig <json>", "Ldap Config (JSON object)")
		.option("--oauthConfig <json>", "Oauth Config (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.testConnection", "post", options, { required: ["issuer"], types: {"ldapConfig":"object","oauthConfig":"object","oidcConfig":"object","samlConfig":"object"} }),
		);
	g_sso
		.command("update")
		.description("Update")
		.option("--providerId <value>", "Provider Id [required]")
		.option("--issuer <value>", "Issuer [required]")
		.option("--domains <json>", "Domains [required] (JSON array)")
		.option("--oidcConfig <json>", "Oidc Config (JSON object)")
		.option("--samlConfig <json>", "Saml Config (JSON object)")
		.option("--ldapConfig <json>", "Ldap Config (JSON object)")
		.option("--oauthConfig <json>", "Oauth Config (JSON object)")
		.option("--organizationId <value>", "Organization Id")
		.option("--overrideUserInfo [boolean]", "Override User Info (default: false)")
		.option("--no-overrideUserInfo", "Set overrideUserInfo to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.update", "post", options, { required: ["providerId","issuer","domains"], types: {"domains":"array","ldapConfig":"object","oauthConfig":"object","oidcConfig":"object","overrideUserInfo":"boolean","samlConfig":"object"} }),
		);
	g_sso
		.command("update-trusted-origin")
		.description("Update Trusted Origin")
		.option("--oldOrigin <value>", "Old Origin [required]")
		.option("--newOrigin <value>", "New Origin [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "sso.updateTrustedOrigin", "post", options, { required: ["oldOrigin","newOrigin"] }),
		);
	const g_status = program.command("status").description("status commands");
	g_status
		.command("add-incident-update")
		.description("Add Incident Update")
		.option("--incidentId <value>", "Incident Id [required]")
		.option("--message <value>", "Message [required]")
		.option("--state <value>", "State (one of: investigating, identified, monitoring, resolved)")
		.option("--visibility <value>", "Visibility (one of: public, private) (default: \"public\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.addIncidentUpdate", "post", options, { required: ["incidentId","message"], enums: {"state":["investigating","identified","monitoring","resolved"],"visibility":["public","private"]} }),
		);
	g_status
		.command("create-incident")
		.description("Create Incident")
		.option("--pageRef <value>", "Page Ref [required]")
		.option("--title <value>", "Title [required]")
		.option("--description <value>", "Description")
		.option("--severity <value>", "Severity (one of: minor, major, critical) (default: \"minor\")")
		.option("--state <value>", "State (one of: investigating, identified, monitoring, resolved) (default: \"investigating\")")
		.option("--visibility <value>", "Visibility (one of: public, private) (default: \"private\")")
		.option("--published [boolean]", "Published (default: false)")
		.option("--no-published", "Set published to false")
		.option("--componentIds <json>", "Component Ids (default: []) (JSON array)")
		.option("--correlationKey <value>", "Correlation Key")
		.option("--updateMessage <value>", "Update Message")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.createIncident", "post", options, { required: ["pageRef","title"], types: {"componentIds":"array","published":"boolean"}, enums: {"severity":["minor","major","critical"],"state":["investigating","identified","monitoring","resolved"],"visibility":["public","private"]} }),
		);
	g_status
		.command("create-maintenance")
		.description("Create Maintenance")
		.option("--pageRef <value>", "Page Ref [required]")
		.option("--title <value>", "Title [required]")
		.option("--description <value>", "Description")
		.option("--startAt <value>", "Start At [required]")
		.option("--endAt <value>", "End At [required]")
		.option("--timeZone <value>", "Time Zone (default: \"UTC\")")
		.option("--componentIds <json>", "Component Ids (default: []) (JSON array)")
		.option("--visibility <value>", "Visibility (one of: public, private) (default: \"private\")")
		.option("--published [boolean]", "Published (default: false)")
		.option("--no-published", "Set published to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.createMaintenance", "post", options, { required: ["pageRef","title","startAt","endAt"], types: {"componentIds":"array","published":"boolean"}, enums: {"visibility":["public","private"]} }),
		);
	g_status
		.command("delete-incident")
		.description("Delete Incident")
		.option("--incidentId <value>", "Incident Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.deleteIncident", "post", options, { required: ["incidentId"] }),
		);
	g_status
		.command("delete-maintenance")
		.description("Delete Maintenance")
		.option("--maintenanceId <value>", "Maintenance Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.deleteMaintenance", "post", options, { required: ["maintenanceId"] }),
		);
	g_status
		.command("overview")
		.description("Overview")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.overview", "get", options),
		);
	g_status
		.command("publish-incident")
		.description("Publish Incident")
		.option("--incidentId <value>", "Incident Id [required]")
		.option("--published [boolean]", "Published [required]")
		.option("--visibility <value>", "Visibility (one of: public, private)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.publishIncident", "post", options, { required: ["incidentId","published"], types: {"published":"boolean"}, enums: {"visibility":["public","private"]} }),
		);
	g_status
		.command("publish-maintenance")
		.description("Publish Maintenance")
		.option("--maintenanceId <value>", "Maintenance Id [required]")
		.option("--published [boolean]", "Published [required]")
		.option("--visibility <value>", "Visibility (one of: public, private)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.publishMaintenance", "post", options, { required: ["maintenanceId","published"], types: {"published":"boolean"}, enums: {"visibility":["public","private"]} }),
		);
	g_status
		.command("set-incident-state")
		.description("Set Incident State")
		.option("--incidentId <value>", "Incident Id [required]")
		.option("--state <value>", "State [required] (one of: investigating, identified, monitoring, resolved)")
		.option("--message <value>", "Message")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.setIncidentState", "post", options, { required: ["incidentId","state"], enums: {"state":["investigating","identified","monitoring","resolved"]} }),
		);
	g_status
		.command("set-maintenance-state")
		.description("Set Maintenance State")
		.option("--maintenanceId <value>", "Maintenance Id [required]")
		.option("--state <value>", "State [required] (one of: scheduled, in_progress, completed, cancelled)")
		.option("--message <value>", "Message")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.setMaintenanceState", "post", options, { required: ["maintenanceId","state"], enums: {"state":["scheduled","in_progress","completed","cancelled"]} }),
		);
	g_status
		.command("timeline")
		.description("Timeline")
		.option("--incidentId <value>", "Incident Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.timeline", "get", options, { required: ["incidentId"] }),
		);
	g_status
		.command("update-incident")
		.description("Update Incident")
		.option("--incidentId <value>", "Incident Id [required]")
		.option("--title <value>", "Title")
		.option("--description <value>", "Description")
		.option("--severity <value>", "Severity (one of: minor, major, critical)")
		.option("--visibility <value>", "Visibility (one of: public, private)")
		.option("--componentIds <json>", "Component Ids (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "status.updateIncident", "post", options, { required: ["incidentId"], types: {"componentIds":"array"}, enums: {"severity":["minor","major","critical"],"visibility":["public","private"]} }),
		);
	const g_stripe = program.command("stripe").description("stripe commands");
	g_stripe
		.command("can-create-more-servers")
		.description("Can Create More Servers")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.canCreateMoreServers", "get", options),
		);
	g_stripe
		.command("create-checkout-session")
		.description("Create Checkout Session")
		.option("--tier <value>", "Tier [required] (one of: legacy, hobby, startup)")
		.option("--productId <value>", "Product Id [required]")
		.option("--serverQuantity <value>", "Server Quantity [required]")
		.option("--isAnnual [boolean]", "Is Annual [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.createCheckoutSession", "post", options, { required: ["tier","productId","serverQuantity","isAnnual"], types: {"isAnnual":"boolean","serverQuantity":"number"}, enums: {"tier":["legacy","hobby","startup"]} }),
		);
	g_stripe
		.command("create-customer-portal-session")
		.description("Create Customer Portal Session")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.createCustomerPortalSession", "post", options),
		);
	g_stripe
		.command("get-billing-contact")
		.description("Get Billing Contact")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getBillingContact", "get", options),
		);
	g_stripe
		.command("get-billing-overview")
		.description("Get Billing Overview")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getBillingOverview", "get", options),
		);
	g_stripe
		.command("get-billing-status")
		.description("Get Billing Status")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getBillingStatus", "get", options),
		);
	g_stripe
		.command("get-current-plan")
		.description("Get Current Plan")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getCurrentPlan", "get", options),
		);
	g_stripe
		.command("get-invoices")
		.description("Get Invoices")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getInvoices", "get", options),
		);
	g_stripe
		.command("get-payment-methods")
		.description("Get Payment Methods")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getPaymentMethods", "get", options),
		);
	g_stripe
		.command("get-plans")
		.description("Get Plans")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getPlans", "get", options),
		);
	g_stripe
		.command("get-products")
		.description("Get Products")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getProducts", "get", options),
		);
	g_stripe
		.command("get-usage")
		.description("Get Usage")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.getUsage", "get", options),
		);
	g_stripe
		.command("start-free-trial")
		.description("Start Free Trial")
		.option("--tier <value>", "Tier [required] (one of: hobby, startup)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.startFreeTrial", "post", options, { required: ["tier"], enums: {"tier":["hobby","startup"]} }),
		);
	g_stripe
		.command("update-invoice-notifications")
		.description("Update Invoice Notifications")
		.option("--enabled [boolean]", "Enabled [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.updateInvoiceNotifications", "post", options, { required: ["enabled"], types: {"enabled":"boolean"} }),
		);
	g_stripe
		.command("upgrade-subscription")
		.description("Upgrade Subscription")
		.option("--tier <value>", "Tier [required] (one of: hobby, startup)")
		.option("--serverQuantity <value>", "Server Quantity [required]")
		.option("--isAnnual [boolean]", "Is Annual [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "stripe.upgradeSubscription", "post", options, { required: ["tier","serverQuantity","isAnnual"], types: {"isAnnual":"boolean","serverQuantity":"number"}, enums: {"tier":["hobby","startup"]} }),
		);
	const g_swarm = program.command("swarm").description("swarm commands");
	g_swarm
		.command("get-console")
		.description("Get Console")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "swarm.getConsole", "get", options),
		);
	g_swarm
		.command("get-container-stats")
		.description("Get Container Stats")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "swarm.getContainerStats", "get", options),
		);
	g_swarm
		.command("get-node-apps")
		.description("Get Node Apps")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "swarm.getNodeApps", "get", options),
		);
	g_swarm
		.command("get-node-info")
		.description("Get Node Info")
		.option("--nodeId <value>", "Node Id [required]")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "swarm.getNodeInfo", "get", options, { required: ["nodeId"] }),
		);
	g_swarm
		.command("get-nodes")
		.description("Get Nodes")
		.option("--serverId <value>", "Server Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "swarm.getNodes", "get", options),
		);
	const g_tag = program.command("tag").description("tag commands");
	g_tag
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.all", "get", options),
		);
	g_tag
		.command("assign-to-project")
		.description("Assign To Project")
		.option("--projectId <value>", "Project Id [required]")
		.option("--tagId <value>", "Tag Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.assignToProject", "post", options, { required: ["projectId","tagId"] }),
		);
	g_tag
		.command("bulk-assign")
		.description("Bulk Assign")
		.option("--projectId <value>", "Project Id [required]")
		.option("--tagIds <json>", "Tag Ids [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.bulkAssign", "post", options, { required: ["projectId","tagIds"], types: {"tagIds":"array"} }),
		);
	g_tag
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--color <value>", "Color (nullable: pass \"null\")")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.create", "post", options, { required: ["name"], types: {"color":"string?"} }),
		);
	g_tag
		.command("one")
		.description("One")
		.option("--tagId <value>", "Tag Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.one", "get", options, { required: ["tagId"] }),
		);
	g_tag
		.command("remove")
		.description("Remove")
		.option("--tagId <value>", "Tag Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.remove", "post", options, { required: ["tagId"] }),
		);
	g_tag
		.command("remove-from-project")
		.description("Remove From Project")
		.option("--projectId <value>", "Project Id [required]")
		.option("--tagId <value>", "Tag Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.removeFromProject", "post", options, { required: ["projectId","tagId"] }),
		);
	g_tag
		.command("update")
		.description("Update")
		.option("--tagId <value>", "Tag Id [required]")
		.option("--name <value>", "Name")
		.option("--color <value>", "Color (nullable: pass \"null\")")
		.option("--createdAt <value>", "Created At")
		.option("--organizationId <value>", "Organization Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "tag.update", "post", options, { required: ["tagId"], types: {"color":"string?"} }),
		);
	const g_traffic = program.command("traffic").description("traffic commands");
	g_traffic
		.command("audience")
		.description("Audience")
		.option("--preset <value>", "Preset (one of: 1h, 24h, 7d, 30d, custom) (default: \"24h\")")
		.option("--from <value>", "From")
		.option("--to <value>", "To")
		.option("--propertyIds <json>", "Property Ids (JSON array)")
		.option("--platform <value>", "Platform")
		.option("--limit <value>", "Limit (default: 10)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.audience", "get", options, { types: {"limit":"number","propertyIds":"array"}, enums: {"preset":["1h","24h","7d","30d","custom"]} }),
		);
	g_traffic
		.command("collect-now")
		.description("Collect Now")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.collectNow", "post", options),
		);
	g_traffic
		.command("create-property")
		.description("Create Property")
		.option("--platform <value>", "Platform [required]")
		.option("--name <value>", "Name")
		.option("--domain <value>", "Domain [required]")
		.option("--matchesSubdomains [boolean]", "Matches Subdomains (default: true)")
		.option("--no-matchesSubdomains", "Set matchesSubdomains to false")
		.option("--sourceType <value>", "Source Type (one of: traefik, web-instrumentation, external) (default: \"traefik\")")
		.option("--logPath <value>", "Log Path")
		.option("--allowedOrigins <json>", "Allowed Origins (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.createProperty", "post", options, { required: ["platform","domain"], types: {"allowedOrigins":"array","matchesSubdomains":"boolean"}, enums: {"sourceType":["traefik","web-instrumentation","external"]} }),
		);
	g_traffic
		.command("declare-recommended")
		.description("Declare Recommended")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.declareRecommended", "post", options),
		);
	g_traffic
		.command("delete-property")
		.description("Delete Property")
		.option("--propertyId <value>", "Property Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.deleteProperty", "post", options, { required: ["propertyId"] }),
		);
	g_traffic
		.command("http")
		.description("Http")
		.option("--preset <value>", "Preset (one of: 1h, 24h, 7d, 30d, custom) (default: \"24h\")")
		.option("--from <value>", "From")
		.option("--to <value>", "To")
		.option("--propertyIds <json>", "Property Ids (JSON array)")
		.option("--platform <value>", "Platform")
		.option("--limit <value>", "Limit (default: 10)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.http", "get", options, { types: {"limit":"number","propertyIds":"array"}, enums: {"preset":["1h","24h","7d","30d","custom"]} }),
		);
	g_traffic
		.command("overview")
		.description("Overview")
		.option("--preset <value>", "Preset (one of: 1h, 24h, 7d, 30d, custom) (default: \"24h\")")
		.option("--from <value>", "From")
		.option("--to <value>", "To")
		.option("--propertyIds <json>", "Property Ids (JSON array)")
		.option("--platform <value>", "Platform")
		.option("--compare [boolean]", "Compare (default: false)")
		.option("--no-compare", "Set compare to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.overview", "get", options, { types: {"compare":"boolean","propertyIds":"array"}, enums: {"preset":["1h","24h","7d","30d","custom"]} }),
		);
	g_traffic
		.command("properties")
		.description("Properties")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.properties", "get", options),
		);
	g_traffic
		.command("timeseries")
		.description("Timeseries")
		.option("--preset <value>", "Preset (one of: 1h, 24h, 7d, 30d, custom) (default: \"24h\")")
		.option("--from <value>", "From")
		.option("--to <value>", "To")
		.option("--propertyIds <json>", "Property Ids (JSON array)")
		.option("--platform <value>", "Platform")
		.option("--includeHttp [boolean]", "Include Http (default: true)")
		.option("--no-includeHttp", "Set includeHttp to false")
		.option("--includeAudience [boolean]", "Include Audience (default: true)")
		.option("--no-includeAudience", "Set includeAudience to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.timeseries", "get", options, { types: {"includeAudience":"boolean","includeHttp":"boolean","propertyIds":"array"}, enums: {"preset":["1h","24h","7d","30d","custom"]} }),
		);
	g_traffic
		.command("update-property")
		.description("Update Property")
		.option("--propertyId <value>", "Property Id [required]")
		.option("--name <value>", "Name")
		.option("--platform <value>", "Platform")
		.option("--matchesSubdomains [boolean]", "Matches Subdomains")
		.option("--no-matchesSubdomains", "Set matchesSubdomains to false")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.updateProperty", "post", options, { required: ["propertyId"], types: {"enabled":"boolean","matchesSubdomains":"boolean"} }),
		);
	g_traffic
		.command("upsert-source")
		.description("Upsert Source")
		.option("--propertyId <value>", "Property Id [required]")
		.option("--type <value>", "Type [required] (one of: traefik, web-instrumentation, external)")
		.option("--enabled [boolean]", "Enabled")
		.option("--no-enabled", "Set enabled to false")
		.option("--logPath <value>", "Log Path (nullable: pass \"null\")")
		.option("--allowedOrigins <json>", "Allowed Origins (nullable: pass \"null\") (JSON array)")
		.option("--rotatePublicKey [boolean]", "Rotate Public Key")
		.option("--no-rotatePublicKey", "Set rotatePublicKey to false")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "traffic.upsertSource", "post", options, { required: ["propertyId","type"], types: {"allowedOrigins":"array?","enabled":"boolean","logPath":"string?","rotatePublicKey":"boolean"}, enums: {"type":["traefik","web-instrumentation","external"]} }),
		);
	const g_user = program.command("user").description("user commands");
	g_user
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.all", "get", options),
		);
	g_user
		.command("assign-permissions")
		.description("Assign Permissions")
		.option("--id <value>", "Id [required]")
		.option("--accessedProjects <json>", "Accessed Projects [required] (JSON array)")
		.option("--accessedEnvironments <json>", "Accessed Environments [required] (JSON array)")
		.option("--accessedServices <json>", "Accessed Services [required] (JSON array)")
		.option("--accessedGitProviders <json>", "Accessed Git Providers [required] (JSON array)")
		.option("--accessedServers <json>", "Accessed Servers [required] (JSON array)")
		.option("--canCreateProjects [boolean]", "Can Create Projects [required]")
		.option("--canCreateServices [boolean]", "Can Create Services [required]")
		.option("--canDeleteProjects [boolean]", "Can Delete Projects [required]")
		.option("--canDeleteServices [boolean]", "Can Delete Services [required]")
		.option("--canAccessToDocker [boolean]", "Can Access To Docker [required]")
		.option("--canAccessToTraefikFiles [boolean]", "Can Access To Traefik Files [required]")
		.option("--canAccessToAPI [boolean]", "Can Access To API [required]")
		.option("--canAccessToSSHKeys [boolean]", "Can Access To SSHKeys [required]")
		.option("--canAccessToGitProviders [boolean]", "Can Access To Git Providers [required]")
		.option("--canDeleteEnvironments [boolean]", "Can Delete Environments [required]")
		.option("--canCreateEnvironments [boolean]", "Can Create Environments [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.assignPermissions", "post", options, { required: ["id","accessedProjects","accessedEnvironments","accessedServices","accessedGitProviders","accessedServers","canCreateProjects","canCreateServices","canDeleteProjects","canDeleteServices","canAccessToDocker","canAccessToTraefikFiles","canAccessToAPI","canAccessToSSHKeys","canAccessToGitProviders","canDeleteEnvironments","canCreateEnvironments"], types: {"accessedEnvironments":"array","accessedGitProviders":"array","accessedProjects":"array","accessedServers":"array","accessedServices":"array","canAccessToAPI":"boolean","canAccessToDocker":"boolean","canAccessToGitProviders":"boolean","canAccessToSSHKeys":"boolean","canAccessToTraefikFiles":"boolean","canCreateEnvironments":"boolean","canCreateProjects":"boolean","canCreateServices":"boolean","canDeleteEnvironments":"boolean","canDeleteProjects":"boolean","canDeleteServices":"boolean"} }),
		);
	g_user
		.command("check-user-organizations")
		.description("Check User Organizations")
		.option("--userId <value>", "User Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.checkUserOrganizations", "get", options, { required: ["userId"] }),
		);
	g_user
		.command("create-api-key")
		.description("Create Api Key")
		.option("--name <value>", "Name [required]")
		.option("--prefix <value>", "Prefix")
		.option("--expiresIn <value>", "Expires In")
		.option("--metadata <json>", "Metadata [required] (JSON object)")
		.option("--rateLimitEnabled [boolean]", "Rate Limit Enabled")
		.option("--no-rateLimitEnabled", "Set rateLimitEnabled to false")
		.option("--rateLimitTimeWindow <value>", "Rate Limit Time Window")
		.option("--rateLimitMax <value>", "Rate Limit Max")
		.option("--remaining <value>", "Remaining")
		.option("--refillAmount <value>", "Refill Amount")
		.option("--refillInterval <value>", "Refill Interval")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.createApiKey", "post", options, { required: ["name","metadata"], types: {"expiresIn":"number","metadata":"object","rateLimitEnabled":"boolean","rateLimitMax":"number","rateLimitTimeWindow":"number","refillAmount":"number","refillInterval":"number","remaining":"number"} }),
		);
	g_user
		.command("create-user-with-credentials")
		.description("Create User With Credentials")
		.option("--email <value>", "Email [required]")
		.option("--password <value>", "Password [required]")
		.option("--role <value>", "Role [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.createUserWithCredentials", "post", options, { required: ["email","password","role"] }),
		);
	g_user
		.command("delete-api-key")
		.description("Delete Api Key")
		.option("--apiKeyId <value>", "Api Key Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.deleteApiKey", "post", options, { required: ["apiKeyId"] }),
		);
	g_user
		.command("generate-token")
		.description("Generate Token")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.generateToken", "post", options),
		);
	g_user
		.command("get")
		.description("Get")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.get", "get", options),
		);
	g_user
		.command("get-backups")
		.description("Get Backups")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getBackups", "get", options),
		);
	g_user
		.command("get-bookmarked-templates")
		.description("Get Bookmarked Templates")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getBookmarkedTemplates", "get", options),
		);
	g_user
		.command("get-container-metrics")
		.description("Get Container Metrics")
		.option("--url <value>", "Url [required]")
		.option("--token <value>", "Token [required]")
		.option("--appName <value>", "App Name [required]")
		.option("--dataPoints <value>", "Data Points [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getContainerMetrics", "get", options, { required: ["url","token","appName","dataPoints"] }),
		);
	g_user
		.command("get-invitations")
		.description("Get Invitations")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getInvitations", "get", options),
		);
	g_user
		.command("get-metrics-token")
		.description("Get Metrics Token")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getMetricsToken", "get", options),
		);
	g_user
		.command("get-permissions")
		.description("Get Permissions")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getPermissions", "get", options),
		);
	g_user
		.command("get-server-metrics")
		.description("Get Server Metrics")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getServerMetrics", "get", options),
		);
	g_user
		.command("get-user-by-token")
		.description("Get User By Token")
		.option("--token <value>", "Token [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.getUserByToken", "get", options, { required: ["token"] }),
		);
	g_user
		.command("have-root-access")
		.description("Have Root Access")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.haveRootAccess", "get", options),
		);
	g_user
		.command("list-sessions")
		.description("List Sessions")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.listSessions", "get", options),
		);
	g_user
		.command("one")
		.description("One")
		.option("--userId <value>", "User Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.one", "get", options, { required: ["userId"] }),
		);
	g_user
		.command("remove")
		.description("Remove")
		.option("--userId <value>", "User Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.remove", "post", options, { required: ["userId"] }),
		);
	g_user
		.command("revoke-session")
		.description("Revoke Session")
		.option("--sessionId <value>", "Session Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.revokeSession", "post", options, { required: ["sessionId"] }),
		);
	g_user
		.command("send-invitation")
		.description("Send Invitation")
		.option("--invitationId <value>", "Invitation Id [required]")
		.option("--notificationId <value>", "Notification Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.sendInvitation", "post", options, { required: ["invitationId","notificationId"] }),
		);
	g_user
		.command("session")
		.description("Session")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.session", "get", options),
		);
	g_user
		.command("toggle-template-bookmark")
		.description("Toggle Template Bookmark")
		.option("--templateId <value>", "Template Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.toggleTemplateBookmark", "post", options, { required: ["templateId"] }),
		);
	g_user
		.command("update")
		.description("Update")
		.option("--id <value>", "Id")
		.option("--firstName <value>", "First Name")
		.option("--lastName <value>", "Last Name")
		.option("--isRegistered [boolean]", "Is Registered")
		.option("--no-isRegistered", "Set isRegistered to false")
		.option("--expirationDate <value>", "Expiration Date")
		.option("--createdAt2 <value>", "Created At2")
		.option("--createdAt <value>", "Created At (nullable: pass \"null\")")
		.option("--twoFactorEnabled [boolean]", "Two Factor Enabled (nullable: pass \"null\")")
		.option("--no-twoFactorEnabled", "Set twoFactorEnabled to false")
		.option("--email <value>", "Email")
		.option("--emailVerified [boolean]", "Email Verified")
		.option("--no-emailVerified", "Set emailVerified to false")
		.option("--image <value>", "Image (nullable: pass \"null\")")
		.option("--banned [boolean]", "Banned (nullable: pass \"null\")")
		.option("--no-banned", "Set banned to false")
		.option("--banReason <value>", "Ban Reason (nullable: pass \"null\")")
		.option("--banExpires <value>", "Ban Expires (nullable: pass \"null\")")
		.option("--updatedAt <value>", "Updated At")
		.option("--enablePaidFeatures [boolean]", "Enable Paid Features")
		.option("--no-enablePaidFeatures", "Set enablePaidFeatures to false")
		.option("--allowImpersonation [boolean]", "Allow Impersonation")
		.option("--no-allowImpersonation", "Set allowImpersonation to false")
		.option("--stripeCustomerId <value>", "Stripe Customer Id (nullable: pass \"null\")")
		.option("--stripeSubscriptionId <value>", "Stripe Subscription Id (nullable: pass \"null\")")
		.option("--serversQuantity <value>", "Servers Quantity")
		.option("--sendInvoiceNotifications [boolean]", "Send Invoice Notifications")
		.option("--no-sendInvoiceNotifications", "Set sendInvoiceNotifications to false")
		.option("--password <value>", "Password")
		.option("--currentPassword <value>", "Current Password")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "user.update", "post", options, { types: {"allowImpersonation":"boolean","banExpires":"string?","banned":"boolean?","banReason":"string?","createdAt":"string?","emailVerified":"boolean","enablePaidFeatures":"boolean","image":"string?","isRegistered":"boolean","sendInvoiceNotifications":"boolean","serversQuantity":"number","stripeCustomerId":"string?","stripeSubscriptionId":"string?","twoFactorEnabled":"boolean?"} }),
		);
	const g_vaultProvider = program.command("vault-provider").description("vaultProvider commands");
	g_vaultProvider
		.command("all")
		.description("All")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.all", "get", options),
		);
	g_vaultProvider
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--assignments <json>", "Assignments [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.create", "post", options, { required: ["name","config","assignments"], types: {"assignments":"array","config":"object"} }),
		);
	g_vaultProvider
		.command("create-secret")
		.description("Create Secret")
		.option("--vaultProviderId <value>", "Vault Provider Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--value <value>", "Value [required]")
		.option("--description <value>", "Description")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.createSecret", "post", options, { required: ["vaultProviderId","name","value"] }),
		);
	g_vaultProvider
		.command("descriptors")
		.description("Descriptors")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.descriptors", "get", options),
		);
	g_vaultProvider
		.command("health")
		.description("Health")
		.option("--vaultProviderId <value>", "Vault Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.health", "get", options, { required: ["vaultProviderId"] }),
		);
	g_vaultProvider
		.command("list-secret-names")
		.description("List Secret Names")
		.option("--vaultProviderId <value>", "Vault Provider Id [required]")
		.option("--projectId <value>", "Project Id [required]")
		.option("--environmentId <value>", "Environment Id")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.listSecretNames", "get", options, { required: ["vaultProviderId","projectId"] }),
		);
	g_vaultProvider
		.command("list-secrets")
		.description("List Secrets")
		.option("--vaultProviderId <value>", "Vault Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.listSecrets", "get", options, { required: ["vaultProviderId"] }),
		);
	g_vaultProvider
		.command("one")
		.description("One")
		.option("--vaultProviderId <value>", "Vault Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.one", "get", options, { required: ["vaultProviderId"] }),
		);
	g_vaultProvider
		.command("remove")
		.description("Remove")
		.option("--vaultProviderId <value>", "Vault Provider Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.remove", "post", options, { required: ["vaultProviderId"] }),
		);
	g_vaultProvider
		.command("remove-secret")
		.description("Remove Secret")
		.option("--vaultSecretId <value>", "Vault Secret Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.removeSecret", "post", options, { required: ["vaultSecretId"] }),
		);
	g_vaultProvider
		.command("test-connection")
		.description("Test Connection")
		.option("--vaultProviderId <value>", "Vault Provider Id")
		.option("--config <json>", "Config (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.testConnection", "post", options, { types: {"config":"object"} }),
		);
	g_vaultProvider
		.command("update")
		.description("Update")
		.option("--vaultProviderId <value>", "Vault Provider Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--config <json>", "Config [required] (JSON object)")
		.option("--assignments <json>", "Assignments [required] (JSON array)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.update", "post", options, { required: ["vaultProviderId","name","config","assignments"], types: {"assignments":"array","config":"object"} }),
		);
	g_vaultProvider
		.command("update-secret")
		.description("Update Secret")
		.option("--vaultSecretId <value>", "Vault Secret Id [required]")
		.option("--name <value>", "Name [required]")
		.option("--value <value>", "Value")
		.option("--description <value>", "Description")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "vaultProvider.updateSecret", "post", options, { required: ["vaultSecretId","name"] }),
		);
	const g_volumeBackups = program.command("volume-backups").description("volumeBackups commands");
	g_volumeBackups
		.command("create")
		.description("Create")
		.option("--name <value>", "Name [required]")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--prefix <value>", "Prefix [required]")
		.option("--serviceType <value>", "Service Type (one of: application, postgres, mysql, mariadb, mongo, redis, compose, libsql)")
		.option("--appName <value>", "App Name")
		.option("--serviceName <value>", "Service Name (nullable: pass \"null\")")
		.option("--turnOff [boolean]", "Turn Off")
		.option("--no-turnOff", "Set turnOff to false")
		.option("--cronExpression <value>", "Cron Expression [required]")
		.option("--keepLatestCount <value>", "Keep Latest Count (nullable: pass \"null\")")
		.option("--enabled [boolean]", "Enabled (nullable: pass \"null\")")
		.option("--no-enabled", "Set enabled to false")
		.option("--applicationId <value>", "Application Id (nullable: pass \"null\")")
		.option("--postgresId <value>", "Postgres Id (nullable: pass \"null\")")
		.option("--mariadbId <value>", "Mariadb Id (nullable: pass \"null\")")
		.option("--mongoId <value>", "Mongo Id (nullable: pass \"null\")")
		.option("--mysqlId <value>", "Mysql Id (nullable: pass \"null\")")
		.option("--redisId <value>", "Redis Id (nullable: pass \"null\")")
		.option("--libsqlId <value>", "Libsql Id (nullable: pass \"null\")")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--createdAt <value>", "Created At")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "volumeBackups.create", "post", options, { required: ["name","volumeName","prefix","cronExpression","destinationId"], types: {"applicationId":"string?","composeId":"string?","enabled":"boolean?","keepLatestCount":"number?","libsqlId":"string?","mariadbId":"string?","mongoId":"string?","mysqlId":"string?","postgresId":"string?","redisId":"string?","serviceName":"string?","turnOff":"boolean"}, enums: {"serviceType":["application","postgres","mysql","mariadb","mongo","redis","compose","libsql"]} }),
		);
	g_volumeBackups
		.command("delete")
		.description("Delete")
		.option("--volumeBackupId <value>", "Volume Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "volumeBackups.delete", "post", options, { required: ["volumeBackupId"] }),
		);
	g_volumeBackups
		.command("list")
		.description("List")
		.option("--id <value>", "Id [required]")
		.option("--volumeBackupType <value>", "Volume Backup Type [required] (one of: application, postgres, mysql, mariadb, mongo, redis, compose, libsql)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "volumeBackups.list", "get", options, { required: ["id","volumeBackupType"], enums: {"volumeBackupType":["application","postgres","mysql","mariadb","mongo","redis","compose","libsql"]} }),
		);
	g_volumeBackups
		.command("one")
		.description("One")
		.option("--volumeBackupId <value>", "Volume Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "volumeBackups.one", "get", options, { required: ["volumeBackupId"] }),
		);
	g_volumeBackups
		.command("run-manually")
		.description("Run Manually")
		.option("--volumeBackupId <value>", "Volume Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "volumeBackups.runManually", "post", options, { required: ["volumeBackupId"] }),
		);
	g_volumeBackups
		.command("update")
		.description("Update")
		.option("--name <value>", "Name [required]")
		.option("--volumeName <value>", "Volume Name [required]")
		.option("--prefix <value>", "Prefix [required]")
		.option("--serviceType <value>", "Service Type (one of: application, postgres, mysql, mariadb, mongo, redis, compose, libsql)")
		.option("--appName <value>", "App Name")
		.option("--serviceName <value>", "Service Name (nullable: pass \"null\")")
		.option("--turnOff [boolean]", "Turn Off")
		.option("--no-turnOff", "Set turnOff to false")
		.option("--cronExpression <value>", "Cron Expression [required]")
		.option("--keepLatestCount <value>", "Keep Latest Count (nullable: pass \"null\")")
		.option("--enabled [boolean]", "Enabled (nullable: pass \"null\")")
		.option("--no-enabled", "Set enabled to false")
		.option("--applicationId <value>", "Application Id (nullable: pass \"null\")")
		.option("--postgresId <value>", "Postgres Id (nullable: pass \"null\")")
		.option("--mariadbId <value>", "Mariadb Id (nullable: pass \"null\")")
		.option("--mongoId <value>", "Mongo Id (nullable: pass \"null\")")
		.option("--mysqlId <value>", "Mysql Id (nullable: pass \"null\")")
		.option("--redisId <value>", "Redis Id (nullable: pass \"null\")")
		.option("--libsqlId <value>", "Libsql Id (nullable: pass \"null\")")
		.option("--composeId <value>", "Compose Id (nullable: pass \"null\")")
		.option("--createdAt <value>", "Created At")
		.option("--destinationId <value>", "Destination Id [required]")
		.option("--volumeBackupId <value>", "Volume Backup Id [required]")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "volumeBackups.update", "post", options, { required: ["name","volumeName","prefix","cronExpression","destinationId","volumeBackupId"], types: {"applicationId":"string?","composeId":"string?","enabled":"boolean?","keepLatestCount":"number?","libsqlId":"string?","mariadbId":"string?","mongoId":"string?","mysqlId":"string?","postgresId":"string?","redisId":"string?","serviceName":"string?","turnOff":"boolean"}, enums: {"serviceType":["application","postgres","mysql","mariadb","mongo","redis","compose","libsql"]} }),
		);
	const g_whitelabeling = program.command("whitelabeling").description("whitelabeling commands");
	g_whitelabeling
		.command("get")
		.description("Get")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "whitelabeling.get", "get", options),
		);
	g_whitelabeling
		.command("get-public")
		.description("Get Public")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "whitelabeling.getPublic", "get", options),
		);
	g_whitelabeling
		.command("reset")
		.description("Reset")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "whitelabeling.reset", "post", options),
		);
	g_whitelabeling
		.command("update")
		.description("Update")
		.option("--whitelabelingConfig <json>", "Whitelabeling Config [required] (JSON object)")
		.option("--json", "Output machine-readable JSON")
		.option("--profile <name>", "Configuration profile to use")
		.action((options, command) =>
			runApiCommand(command, "whitelabeling.update", "post", options, { required: ["whitelabelingConfig"], types: {"whitelabelingConfig":"object"} }),
		);
}
