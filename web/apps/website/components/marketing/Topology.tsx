import { Container } from "@/components/Container";

export function Topology() {
	return (
		<section
			id="architecture"
			aria-labelledby="architecture-title"
			className="border-b border-border/40 py-20 sm:py-24"
		>
			<Container>
				<div className="max-w-2xl">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Architecture
					</p>
					<h2
						id="architecture-title"
						className="mt-3 font-display text-3xl tracking-tight sm:text-4xl"
					>
						One server to start. More when you need them.
					</h2>
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						The same control plane works on a single machine or across several
						nodes. What changes is how many hosts you connect and how you
						choose to distribute workloads.
					</p>
				</div>

				<div className="mt-12 grid gap-4 lg:grid-cols-2">
					<figure className="rounded-xl border border-border/50 bg-card p-6">
						<figcaption className="flex flex-wrap items-baseline justify-between gap-2">
							<span className="font-display text-xl tracking-tight text-foreground">
								Single node
							</span>
							<span className="text-sm text-muted-foreground">Start here</span>
						</figcaption>

						<div className="mt-6 rounded-lg border border-border/60 p-4">
							<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
								One Docker host
							</p>
							<div className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm text-foreground">
								Notploy control plane
							</div>
							<div className="mt-2 rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">
								Traefik · TLS
							</div>
							<div className="mt-2 grid grid-cols-2 gap-2">
								<div className="rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">
									Application
								</div>
								<div className="rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground">
									Database
								</div>
							</div>
						</div>

						<ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
							<li>Infrastructure, platform and services on one machine.</li>
							<li>Remote servers can be added later over SSH.</li>
						</ul>
					</figure>

					<figure className="rounded-xl border border-border/50 bg-card p-6">
						<figcaption className="flex flex-wrap items-baseline justify-between gap-2">
							<span className="font-display text-xl tracking-tight text-foreground">
								Multi-node
							</span>
							<span className="text-sm text-muted-foreground">When you grow</span>
						</figcaption>

						<div className="mt-6">
							<div className="rounded-md bg-secondary px-3 py-2 text-sm text-foreground">
								Notploy control plane
							</div>
							<div
								className="mx-auto h-4 w-px bg-border"
								aria-hidden="true"
							/>
							<div className="rounded-lg border border-border/60 p-4">
								<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Docker Swarm cluster
								</p>
								<div className="mt-3 grid grid-cols-3 gap-2">
									{["Node 1", "Node 2", "Node 3"].map((node) => (
										<div
											key={node}
											className="rounded-md border border-border/60 px-2 py-3 text-center text-sm text-muted-foreground"
										>
											{node}
											<span className="mt-1 block text-xs">workloads</span>
										</div>
									))}
								</div>
							</div>
						</div>

						<ul className="mt-5 space-y-2 text-sm leading-relaxed text-muted-foreground">
							<li>Remote servers joined to the same control plane.</li>
							<li>Workloads scheduled across nodes by Swarm.</li>
						</ul>
					</figure>
				</div>

				<p className="mt-8 max-w-3xl border-l-2 border-primary pl-4 text-sm leading-relaxed text-muted-foreground">
					Multi-node distributes workloads across servers; it is not an
					automatic high-availability or disaster-recovery setup. Redundancy
					depends on how you design and operate the infrastructure around it.
				</p>
			</Container>
		</section>
	);
}
