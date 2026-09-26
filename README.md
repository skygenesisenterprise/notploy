<div align="center">
  <a href="https://notploy.com">
    <img src=".github/sponsors/logo.png" alt="Notploy - Open Source Alternative to Vercel, Heroku and Netlify." width="100%"  />
  </a>
  </br>
  </br>
  <p>Join us on Discord for help, feedback, and discussions!</p>
  <a href="https://discord.gg/2tBnJ3jDJc">
    <img src="https://discordapp.com/api/guilds/1234073262418563112/widget.png?style=banner2" alt="Discord Shield"/>
  </a>
</div>
<br />


Notploy is a free, self-hostable Platform as a Service (PaaS) that simplifies the deployment and management of applications and databases.

## ✨ Features

Notploy includes multiple features to make your life easier.

- **Applications**: Deploy any type of application (Node.js, PHP, Python, Go, Ruby, etc.).
- **Databases**: Create and manage databases with support for MySQL, PostgreSQL, MongoDB, MariaDB, libsql, and Redis.
- **Backups**: Automate backups for databases to an external storage destination.
- **Docker Compose**: Native support for Docker Compose to manage complex applications.
- **Multi Node**: Scale applications to multiple nodes using Docker Swarm to manage the cluster.
- **Templates**: Deploy open-source templates (Plausible, Pocketbase, Calcom, etc.) with a single click.
- **Traefik Integration**: Automatically integrates with Traefik for routing and load balancing.
- **Real-time Monitoring**: Monitor CPU, memory, storage, and network usage for every resource.
- **Docker Management**: Easily deploy and manage Docker containers.
- **CLI/API**: Manage your applications and databases using the command line or through the API.
- **Notifications**: Get notified when your deployments succeed or fail (via Slack, Discord, Telegram, Email, etc.).
- **Multi Server**: Deploy and manage your applications remotely to external servers.
- **Self-Hosted**: Self-host Notploy on your VPS.

## 🚀 Getting Started

To get started, run the following command on a VPS:

Want to skip the installation process? [Try the Notploy Cloud](https://app.notploy.com).

```bash
curl -sSL https://notploy.com/install.sh | bash
```

For detailed documentation, visit [docs.notploy.com](https://docs.notploy.com).

### Run with Docker

Everything is driven by the root `Dockerfile`, `docker-compose.yml` and `Makefile`:

```bash
git clone https://github.com/skygenesisenterprise/notploy.git
cd notploy
cp .env.example .env   # then edit POSTGRES_PASSWORD and BETTER_AUTH_SECRET
make docker-up         # or: docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000).

```bash
make docker-logs   # follow the stack logs
make docker-ps     # show stack status
make docker-down   # stop the stack (named volumes are preserved)
```

Switch flavors and modes with the same stack:

```bash
make docker-up FLAVOR=cloud      # Notploy Cloud (no self-hosted build tooling)
make docker-build VERSION=local  # build/tag a local image
make docker-dev                  # containerized dev server, http://localhost:3001
make dev                         # development on the host
```

Run `make help` for the full list of commands.


[Github Sponsors](https://github.com/sponsors/Siumauricio)

### Contributors 🤝

<a href="https://github.com/skygenesisenterprise/notploy/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=skygenesisenterprise/notploy" alt="Contributors" />
</a>

## 📺 Video Tutorial

<a href="https://youtu.be/mznYKPvhcfw">
  <img src="https://notploy.com/banner.png" alt="Watch the video" width="400"/>
</a>

## 🤝 Contributing

Check out the [Contributing Guide](CONTRIBUTING.md) for more information.
