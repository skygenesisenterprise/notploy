import { BookOpen, Github, Globe } from "lucide-react";

const links = [
  {
    href: "https://notploy.com",
    label: "Notploy website",
    icon: Globe,
  },
  {
    href: "https://docs.notploy.com",
    label: "Documentation",
    icon: BookOpen,
  },
  {
    href: "https://github.com/skygenesisenterprise/notploy",
    label: "GitHub",
    icon: Github,
  },
];

const Footer = () => {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          Notploy Templates — open source deployment blueprints for Notploy.
        </p>
        <nav aria-label="Notploy resources">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
