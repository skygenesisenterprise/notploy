import { XIcon } from "lucide-react";
import { useStore } from "@/store";
import { Badge } from "./ui/badge";

const SelectedTags = () => {
  const selectedTags = useStore((state) => state.selectedTags);
  const removeSelectedTag = useStore((state) => state.removeSelectedTag);

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
      {selectedTags.map((tag) => (
        <Badge
          key={tag}
          variant="default"
          className="flex items-center gap-1 pr-1"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeSelectedTag(tag)}
            aria-label={`Remove ${tag} filter`}
            className="rounded-full p-1 hover:bg-primary-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon aria-hidden="true" className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
};

export default SelectedTags;
