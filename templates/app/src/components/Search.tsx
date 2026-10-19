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
import { Container } from "./Container";
import SelectedTags from "./SelectedTags";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

interface SearchProps {
  resultCount: number;
  totalCount: number;
  tags: string[];
}

const SPLIT_TAG = ",";

const Search = ({ resultCount, totalCount, tags }: SearchProps) => {
  const searchQuery = useStore((state) => state.searchQuery);
  const setSearchQuery = useStore((state) => state.setSearchQuery);
  const selectedTags = useStore((state) => state.selectedTags);
  const setSelectedTags = useStore((state) => state.setSelectedTags);
  const clearFilters = useStore((state) => state.clearFilters);
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);

  const [open, setOpen] = React.useState(false);
  const [tagSearch, setTagSearch] = React.useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const applyFilters = React.useCallback(
    (query: string, nextTags: string[]) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (query) next.set("q", query);
          else next.delete("q");
          if (nextTags.length > 0) next.set("tags", nextTags.join(SPLIT_TAG));
          else next.delete("tags");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  // Keep search and tags in sync with the URL so filtered catalogues can be
  // linked and survive a reload (the website uses `?search=` / `?tag=`).
  React.useEffect(() => {
    const state = useStore.getState();
    const urlQuery = searchParams.get("q") ?? "";
    const urlTags = (searchParams.get("tags") ?? "")
      .split(SPLIT_TAG)
      .filter(Boolean);

    if (urlQuery !== state.searchQuery) state.setSearchQuery(urlQuery);

    const sameTags =
      urlTags.length === state.selectedTags.length &&
      urlTags.every((tag, index) => tag === state.selectedTags[index]);
    if (!sameTags) state.setSelectedTags(urlTags);
  }, [searchParams]);

  const filteredTags = React.useMemo(() => {
    const term = tagSearch.trim().toLowerCase();
    if (!term) return tags;
    return tags.filter((tag) => tag.toLowerCase().includes(term));
  }, [tags, tagSearch]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    applyFilters(value, selectedTags);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    applyFilters("", selectedTags);
  };

  const handleToggleTag = (tag: string) => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((selected) => selected !== tag)
      : [...selectedTags, tag];
    setSelectedTags(nextTags);
    applyFilters(searchQuery, nextTags);
  };

  const handleRemoveTag = (tag: string) => {
    applyFilters(
      searchQuery,
      selectedTags.filter((selected) => selected !== tag)
    );
  };

  const handleClearFilters = () => {
    clearFilters();
    setTagSearch("");
    applyFilters("", []);
  };

  const hasFilters = searchQuery.length > 0 || selectedTags.length > 0;
  const countLabel =
    resultCount === totalCount
      ? `${totalCount} template${totalCount === 1 ? "" : "s"}`
      : `${resultCount} of ${totalCount} templates`;

  return (
    <section
      id="catalogue"
      aria-label="Search and filter templates"
      className="scroll-mt-24 border-b border-border/50"
    >
      <Container className="py-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <label htmlFor="template-search" className="sr-only">
              Search templates
            </label>
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="template-search"
              type="search"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="h-11 rounded-lg border-border/70 bg-card/60 pr-10 pl-10 text-sm shadow-none [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  aria-label="Filter by tag"
                  className="h-11 justify-between gap-2 rounded-lg border-border/70 bg-card/60 px-3.5 shadow-none"
                >
                  Tags
                  {selectedTags.length > 0 && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                      {selectedTags.length}
                    </span>
                  )}
                  <ChevronsUpDown
                    aria-hidden="true"
                    className="size-4 shrink-0 opacity-50"
                  />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
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
                          onSelect={() => handleToggleTag(tag)}
                        >
                          <Check
                            aria-hidden="true"
                            className={cn(
                              "mr-2 size-4",
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

            <Tabs
              value={view}
              onValueChange={(value) => {
                setView(value as "grid" | "rows");
              }}
            >
              <TabsList className="h-11 rounded-lg border border-border/70 bg-card/60 p-1">
                <TabsTrigger
                  value="grid"
                  aria-label="Grid view"
                  className="px-3"
                >
                  <Grid aria-hidden="true" className="size-4" />
                </TabsTrigger>
                <TabsTrigger
                  value="rows"
                  aria-label="List view"
                  className="px-3"
                >
                  <List aria-hidden="true" className="size-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {hasFilters && (
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="h-11 rounded-lg px-3.5 text-muted-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {countLabel}
          </p>
          <SelectedTags onRemove={handleRemoveTag} />
        </div>
      </Container>
    </section>
  );
};

export default Search;
