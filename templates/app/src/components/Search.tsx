import * as React from "react";
import { Check, ChevronsUpDown, Grid, List, SearchIcon, XIcon } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import SelectedTags from "./SelectedTags";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

interface SearchProps {
  resultCount: number;
  totalCount: number;
  tags: string[];
}

const Search = ({ resultCount, totalCount, tags }: SearchProps) => {
  const searchQuery = useStore((state) => state.searchQuery);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const selectedTags = useStore((state) => state.selectedTags);
  const addSelectedTag = useStore((state) => state.addSelectedTag);
  const removeSelectedTag = useStore((state) => state.removeSelectedTag);
  const clearFilters = useStore((state) => state.clearFilters);
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);

  const [open, setOpen] = React.useState(false);
  const [tagSearch, setTagSearch] = React.useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  // Keep the input in sync when the URL changes (back/forward, direct link).
  const urlQuery = searchParams.get("q") ?? "";
  React.useEffect(() => {
    if (urlQuery !== searchQuery) setSearchQuery(urlQuery);
  }, [urlQuery, searchQuery, setSearchQuery]);

  const filteredTags = React.useMemo(() => {
    const term = tagSearch.trim().toLowerCase();
    if (!term) return tags;
    return tags.filter((tag) => tag.toLowerCase().includes(term));
  }, [tags, tagSearch]);

  const writeQueryToUrl = (value: string) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set("q", value);
        else next.delete("q");
        return next;
      },
      { replace: true }
    );
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    writeQueryToUrl(value);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    writeQueryToUrl("");
  };

  const handleClearFilters = () => {
    clearFilters();
    setTagSearch("");
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("q");
        return next;
      },
      { replace: true }
    );
  };

  const hasFilters = searchQuery.length > 0 || selectedTags.length > 0;
  const countLabel =
    resultCount === totalCount
      ? `${totalCount} template${totalCount === 1 ? "" : "s"}`
      : `${resultCount} of ${totalCount} templates`;

  return (
    <section
      aria-label="Search and filter templates"
      className="mx-auto w-full border-b p-4 lg:p-12"
    >
      <div className="mx-auto flex max-w-xl flex-col gap-2">
        <div className="relative w-full">
          <label htmlFor="template-search" className="sr-only">
            Search templates
          </label>
          <div className="mb-2 flex flex-row items-center gap-2">
            <p className="text-sm font-bold" aria-live="polite">
              {countLabel}
            </p>
          </div>

          <div className="relative">
            <Input
              id="template-search"
              type="search"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pr-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery.length > 0 ? (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <XIcon className="h-4 w-4" />
              </button>
            ) : (
              <SearchIcon
                aria-hidden="true"
                className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground lg:size-5"
              />
            )}
          </div>
        </div>

        <div className="flex flex-row justify-between gap-2">
          <Tabs
            value={view}
            onValueChange={(value) => {
              setView(value as "grid" | "rows");
            }}
          >
            <TabsList>
              <TabsTrigger value="grid" className="cursor-pointer">
                <Grid aria-hidden="true" /> <span className="p-1 text-xs">Grid</span>
              </TabsTrigger>
              <TabsTrigger value="rows" className="cursor-pointer">
                <List aria-hidden="true" /> <span className="p-1 text-xs">List</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  aria-label="Filter by tag"
                  className="justify-between"
                >
                  Tags
                  {selectedTags.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                      {selectedTags.length}
                    </span>
                  )}
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="ml-2 h-4 w-4 shrink-0 opacity-50"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search tags..."
                    value={tagSearch}
                    onValueChange={setTagSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No tags found.</CommandEmpty>
                    <CommandGroup>
                      {filteredTags.map((tag) => (
                        <CommandItem
                          key={tag}
                          value={tag}
                          onSelect={(value) => {
                            if (selectedTags.includes(value)) {
                              removeSelectedTag(value);
                            } else {
                              addSelectedTag(value);
                            }
                          }}
                        >
                          <Check
                            aria-hidden="true"
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedTags.includes(tag)
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          {tag}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {selectedTags.length > 0 && <SelectedTags />}
      </div>
    </section>
  );
};

export default Search;
