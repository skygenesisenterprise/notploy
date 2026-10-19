import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Template } from "@/lib/templates";

interface TemplateStore {
  templates: Template[];
  setTemplates: (templates: Template[]) => void;
  searchQuery: string;
  setSearchQuery: (searchQuery: string) => void;
  selectedTags: string[];
  addSelectedTag: (tag: string) => void;
  removeSelectedTag: (tag: string) => void;
  clearFilters: () => void;
  view: "grid" | "rows";
  setView: (view: "grid" | "rows") => void;
}

export const useStore = create<TemplateStore>()(
  persist(
    (set) => ({
      templates: [],
      setTemplates: (templates) => set({ templates }),
      searchQuery: "",
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      selectedTags: [],
      addSelectedTag: (tag) =>
        set((state) => ({
          selectedTags: state.selectedTags.includes(tag)
            ? state.selectedTags
            : [...state.selectedTags, tag],
        })),
      removeSelectedTag: (tag) =>
        set((state) => ({
          selectedTags: state.selectedTags.filter((t) => t !== tag),
        })),
      clearFilters: () => set({ searchQuery: "", selectedTags: [] }),
      view: "grid",
      setView: (view) => set({ view }),
    }),
    {
      name: "template-store",
      partialize: (state) => ({ view: state.view }), // Only persist the view preference
    }
  )
);
