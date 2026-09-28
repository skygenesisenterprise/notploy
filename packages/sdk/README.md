# Notploy SDK

TypeScript SDK for the [Notploy](https://notploy.com) API — auto-generated from the OpenAPI spec.

## Installation

```bash
npm install @notploy/sdk
# or
pnpm add @notploy/sdk
```

## Usage

```ts
import { client, applicationCreate, applicationOne, projectCreate } from "@notploy/sdk";

// Configure the client with your Notploy instance URL and API token
client.setConfig({
  baseUrl: "https://your-notploy-instance.com/api",
  headers: {
    "x-api-key": "YOUR_API_TOKEN",
  },
});
```

The base URL always ends with `/api`, and authentication uses the `x-api-key` header.
Generate a key from your Notploy dashboard under **Settings → API Keys**.

### Talking to more than one instance

The exported `client` is a process-wide singleton. If you need to reach several
Notploy instances at the same time, build one client per instance with
`createClient()` and pass it to each call — no global state involved:

```ts
type Instance = { url: string; token: string };

import { createClient, projectAll } from "@notploy/sdk";

function clientFor({ url, token }: Instance) {
  return createClient({
    baseUrl: `${url.replace(/\/+$/, "")}/api`,
    headers: { "x-api-key": token },
  });
}

const production = clientFor({ url: "https://notploy.example.com", token: "..." });
const local = clientFor({ url: "http://localhost:3000", token: "..." });

const [prodProjects, localProjects] = await Promise.all([
  projectAll({ client: production }),
  projectAll({ client: local }),
]);
```

### Error handling

Generated operations do not throw by default: they return `{ data, error, request, response }`.
Pass `throwOnError: true` to make them reject instead.

```ts
const { data, error } = await projectAll();
if (error) {
  console.error("Request failed", error);
}
```

### Create a project

```ts
const { data, error } = await projectCreate({
  body: {
    name: "my-project",
    description: "My awesome project",
  },
});
```

### Deploy an application

```ts
const { data, error } = await applicationCreate({
  body: {
    name: "my-app",
    projectId: "project-id",
  },
});
```

### Fetch application details

```ts
const { data, error } = await applicationOne({
  query: { applicationId: "app-id" },
});

console.log(data?.name);
```

## API Coverage

524 endpoints across the full Notploy API:

| Category | Resources |
|---|---|
| Apps | `application`, `compose`, `docker` |
| Databases | `postgres`, `mysql`, `redis`, `mongo`, `mariadb` |
| Infrastructure | `server`, `cluster`, `swarm`, `registry` |
| Networking | `domain`, `port`, `redirects`, `certificates`, `sshRouter` |
| Git | `github`, `gitlab`, `gitbucket`, `gitea`, `gitProvider` |
| Storage | `mounts`, `backup`, `destination`, `volumeBackups` |
| Platform | `project`, `deployment`, `rollback`, `schedule`, `environment` |
| System | `admin`, `settings`, `security`, `user`, `organization`, `ai` |

## Regenerating the SDK

If you update `openapi.json`, regenerate the SDK with:

```bash
pnpm generate
```

## License

Apache 2.0
