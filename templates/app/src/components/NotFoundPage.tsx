import { Link } from "react-router-dom";
import { Button } from "./ui/button";

interface NotFoundPageProps {
  title?: string;
  description?: string;
}

const NotFoundPage = ({
  title = "Page not found",
  description = "The page you are looking for does not exist.",
}: NotFoundPageProps) => {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
        404
      </p>
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
      <Button asChild className="mt-6">
        <Link to="/">Browse templates</Link>
      </Button>
    </section>
  );
};

export default NotFoundPage;
