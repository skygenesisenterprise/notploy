"use client";

import { SearchBar } from "@codegouvaor/react-ads/SearchBar";
import { useRouter } from "@/i18n/navigation";
import { searchPath } from "@/lib/site-structure";

/**
 * Portal search input. The behaviour comes from the ADS `SearchBar`; on submit
 * the query is pushed to the localized `/search` route which renders the
 * results (empty state while the search index is not wired).
 */
export function PortalSearchBar({
  label,
  defaultValue,
  placeholder,
  big = true,
}: {
  label: string;
  defaultValue?: string;
  /** Overrides the ADS default placeholder (translated “Search”). */
  placeholder?: string;
  /** Large hero variant (default) or the compact inline variant. */
  big?: boolean;
}) {
  const router = useRouter();

  const handleSearch = (text: string) => {
    const query = text.trim();
    router.push(query ? `${searchPath}?q=${encodeURIComponent(query)}` : searchPath);
  };

  return (
    <SearchBar
      big={big}
      label={label}
      defaultValue={defaultValue}
      renderInput={(params) => (
        <input {...params} placeholder={placeholder ?? params.placeholder} />
      )}
      onButtonClick={handleSearch}
    />
  );
}
