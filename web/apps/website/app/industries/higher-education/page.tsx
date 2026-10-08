import {
	IndustryPage,
	type IndustryPageData,
} from "@/components/industries/IndustryPage";
import { Box, Eye, GitBranch, KeyRound, Layers, Network } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Deployment Software for Higher Education",
	description:
		"Give students a safe sandbox to launch coursework apps with deployment software for higher education that IT teams can manage centrally.",
	alternates: {
		canonical: "https://notploy.com/industries/higher-education",
	},
};

const data: IndustryPageData = {
	hero: {
		title: "Deployment software for higher education so students launch safely",
		description:
			"Give students a real deployment experience securely. Notploy provides IT and academic technology teams with a controlled platform for student apps, course projects, and internal teaching tools.",
	},
	features: {
		heading: "Let students ship real apps without creating shadow IT",
		description:
			"Students need to deploy, test, and share the apps they've built. In Notploy, higher education institutions get a deployment platform that keeps app publishing inside an environment your teams can control.",
		items: [
			{
				icon: Box,
				title: "Give students a sandbox",
				description:
					"Create environments where students can deploy applications from Git, Docker, or Docker Compose without needing direct server access. Students get valuable practice, while you keep the platform boundary clear.",
			},
			{
				icon: KeyRound,
				title: "Keep access under institutional control",
				description:
					"Use roles and permissions to separate student, instructor, and administrator responsibilities. Enterprise teams can go further with custom roles, single sign-on, and audit logs for a tighter governance model.",
			},
			{
				icon: GitBranch,
				title: "Connect to the tools students already use",
				description:
					"Notploy supports Git-based deployment workflows across providers such as GitHub, GitLab, Bitbucket, and Gitea. Students can move from repository to running app without learning a vendor-specific release process.",
			},
			{
				icon: Layers,
				title: "Support full-stack coursework",
				description:
					"Deploy frontends, APIs, background services, and databases from the same platform. Notploy supports common databases, including PostgreSQL, MySQL, MongoDB, Redis, and MariaDB.",
			},
			{
				icon: Eye,
				title: "Review work before it reaches production",
				description:
					"Preview deployments help students and teaching staff test changes in isolated environments before merging. It's a practical way to support code reviews, group projects, and assessment workflows.",
			},
			{
				icon: Network,
				title: "Scale from one course to many departments",
				description:
					"Start with a single course sandbox, then expand across labs, bootcamps, research groups, or internal innovation programs. Notploy supports multi-server management and remote servers, and the platform grows with demand.",
			},
		],
	},
	comparison: {
		heading: "Student app hosting without unmanaged cloud sprawl",
		description:
			"Giving every student a separate cloud account creates cost, security, and support problems. Notploy gives institutions a cleaner model: one deployment layer, controlled access, and a familiar developer workflow.",
		without: {
			title: "General cloud accounts",
			items: [
				"Students may need broad infrastructure permissions.",
				"Costs can spread across unmanaged accounts.",
				"Instructors have limited visibility into deployed work.",
				"IT teams inherit inconsistent security and cleanup processes.",
				"Each course may develop its own release workflow.",
				"The less control you have, the more of a security risk to your deployment process.",
			],
		},
		withNotploy: {
			title: "Notploy for higher education",
			items: [
				"Students deploy inside institution-managed environments.",
				"Admins can manage projects, users, services, and servers centrally.",
				"Teams can use Git, Docker, Docker Compose, and supported databases.",
				"Enterprise options include SSO, custom roles, audit logs, and whitelabeling.",
				"Courses can reuse the same deployment model across cohorts.",
				"Students and educators can link AI tools through the MCP.",
			],
		},
	},
	workflow: {
		heading: "From coursework repository to live sandbox app",
		description:
			"With Notploy, teaching teams turn deployment into part of the learning journey. Students can go from code to a working URL through a repeatable workflow.",
		steps: [
			{
				title: "Create the course environment",
				description:
					"Set up a project for the module, class, or department. Use separate environments for cohorts, assignments, or assessment stages.",
				flow: "Create project → Add environment → Invite members",
			},
			{
				title: "Connect the repository",
				description:
					"Students or instructors connect a Git provider and select the relevant branch. Notploy can trigger deployments through webhooks when changes are pushed.",
				flow: "Select Git provider → Choose repository → Set branch",
			},
			{
				title: "Choose the deployment method",
				description:
					"Use Nixpacks, Heroku Buildpacks, Dockerfile, or Docker Compose. Keep introductory projects simple while supporting advanced software engineering modules.",
				flow: "Pick build type → Add build command → Configure port",
			},
			{
				title: "Publish to a controlled URL",
				description:
					"Assign a custom or generated domain where students can demo their apps. Notploy includes domain management through the UI, reducing the need for manual reverse proxy configuration.",
				flow: "Add domain → Deploy → Share app URL",
			},
		],
	},
	builtFor: {
		heading: "Built for teaching, governed by IT",
		paragraphs: [
			"Notploy helps institutions offer a modern software delivery experience without pushing infrastructure responsibility onto students.",
			"Students can deploy the kinds of projects they're already building: web apps, APIs, database-backed tools, internal prototypes, and capstone projects.",
			"Administrators can decide whether to use Notploy Cloud's managed control plane or self-host Notploy on university-managed infrastructure.",
		],
		screenshotAlt:
			"Notploy dashboard showing a university course project with separate environments for student sandbox, review, and demo",
	},
	detailRows: [
		{
			area: "Deployment methods",
			support:
				"Git, Docker, Docker Compose, Nixpacks, Heroku Buildpacks, and custom Dockerfiles",
		},
		{
			area: "Git workflows",
			support: "GitHub, GitLab, Bitbucket, Gitea, and webhook-based auto deploys",
		},
		{
			area: "Access control",
			support: "Owner, Admin, and Member roles, with custom Enterprise roles",
		},
		{
			area: "Governance options",
			support: "Enterprise SSO, audit logs, and whitelabeling",
		},
		{
			area: "Databases",
			support: "PostgreSQL, MySQL, MongoDB, Redis, and MariaDB",
		},
		{
			area: "Operations",
			support:
				"Monitoring, logs, backups, rollbacks, preview deployments, and remote server management",
		},
	],
	faqs: {
		heading: "Deployment software for higher education FAQs",
		items: [
			{
				question: "Can Notploy be used as a student sandbox environment?",
				answer:
					"Yes. Notploy can be used to create controlled environments where students deploy coursework apps without needing direct access to underlying servers. Institutions can structure projects and environments around courses, cohorts, or departments.",
			},
			{
				question: "Can instructors review student apps before they are shared?",
				answer:
					"Yes. Instructors can use preview and review-style workflows to test changes before they are merged or promoted to a more public environment – useful for group projects, capstones, and assessed coursework.",
			},
			{
				question: "Does Notploy support common student project stacks?",
				answer:
					"Yes. Notploy supports multiple deployment methods, including Git-based apps, Dockerfiles, and Docker Compose. It also supports common databases used in coursework, including PostgreSQL, MySQL, MongoDB, Redis, and MariaDB.",
			},
			{
				question: "Can universities connect Notploy to existing identity systems?",
				answer:
					"Notploy Enterprise includes single sign-on options through providers such as Auth0, Keycloak, and other OIDC/SAML providers. That makes it easier to fit Notploy into existing institutional access workflows.",
			},
			{
				question:
					"Should a university choose Notploy Cloud or self-hosted Notploy?",
				answer:
					"Use Notploy Cloud when you want the Notploy team to manage the control plane while your apps still run on your own servers. Choose self-hosted when your institution wants to run and maintain the full platform internally.",
			},
		],
	},
};

export default function HigherEducationPage() {
	return <IndustryPage data={data} />;
}
