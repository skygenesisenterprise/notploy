import type React from "react";

// Minimal markdown renderer (no external dependencies) for the per-template
// instructions.md files. Supports headings, paragraphs, fenced code blocks,
// ordered/unordered lists, and inline code / bold / links.

const INLINE_PATTERN =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))/g;

const renderInline = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;

  for (;;) {
    match = INLINE_PATTERN.exec(text);
    if (match === null) break;

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      // Instructions are contributed with the blueprints, so only render
      // links with a safe scheme instead of trusting arbitrary href values.
      const safeHref =
        link && /^(https?:\/\/|mailto:|\/(?!\/))/i.test(link[2])
          ? link[2]
          : null;
      if (link && safeHref) {
        nodes.push(
          <a
            key={key++}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            {link[1]}
          </a>
        );
      } else {
        nodes.push(link ? link[1] : token);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};

const HEADING_CLASSES: Record<number, string> = {
  1: "font-display text-2xl font-semibold tracking-tight mt-2",
  2: "font-display text-xl font-semibold tracking-tight mt-6 border-b border-border pb-1",
  3: "font-display text-lg font-semibold tracking-tight mt-4",
  4: "text-base font-semibold mt-3",
};

interface MarkdownProps {
  content: string;
}

const Markdown: React.FC<MarkdownProps> = ({ content }) => {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre
          key={key++}
          className="bg-muted/60 border border-border rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre"
        >
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${Math.min(level + 1, 6)}` as keyof React.JSX.IntrinsicElements;
      blocks.push(
        <Tag key={key++} className={HEADING_CLASSES[level]}>
          {renderInline(heading[2])}
        </Tag>
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-6 space-y-1 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal pl-6 space-y-1 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph: consume consecutive plain lines
    const paragraph: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4})\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("```")
    ) {
      paragraph.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed text-muted-foreground">
        {renderInline(paragraph.join(" "))}
      </p>
    );
  }

  return <div className="space-y-3 text-sm">{blocks}</div>;
};

export default Markdown;
