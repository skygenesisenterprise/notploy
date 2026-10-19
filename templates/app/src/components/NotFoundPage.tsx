import { ArrowLeft, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "./ui/button";
import { Container } from "./Container";

interface NotFoundPageProps {
  title?: string;
  description?: string;
}

const NotFoundPage = ({
  title = "Page not found",
  description = "The page you are looking for does not exist.",
}: NotFoundPageProps) => {
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          404
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link to="/">
              <ArrowLeft aria-hidden="true" />
              Browse templates
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://docs.notploy.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <BookOpen aria-hidden="true" />
              Documentation
            </a>
          </Button>
        </div>
      </div>
    </Container>
  );
};

export default NotFoundPage;
