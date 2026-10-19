import { XIcon } from "lucide-react";
import { useStore } from "@/store";

interface SelectedTagsProps {
  onRemove?: (tag: string) => void;
}

const SelectedTags = ({ onRemove }: SelectedTagsProps) => {
  const selectedTags = useStore((state) => state.selectedTags);
  const removeSelectedTag = useStore((state) => state.removeSelectedTag);

  if (selectedTags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedTags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => {
              removeSelectedTag(tag);
              onRemove?.(tag);
            }}
            aria-label={`Remove ${tag} filter`}
            className="rounded-full p-0.5 transition-colors hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon aria-hidden="true" className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
};

export default SelectedTags;
