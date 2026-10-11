import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface Tag {
	id: string;
	name: string;
	slug: string;
}

interface SearchAndFilterProps {
	tags: Tag[];
	search: string;
	selectedTag: string;
	onSearchChange: (value: string) => void;
	onTagChange: (value: string) => void;
	searchPlaceholder?: string;
	allTagsText?: string;
}

export const ALL_TAGS_VALUE = "all";

export function SearchAndFilter({
	tags,
	search,
	selectedTag,
	onSearchChange,
	onTagChange,
	searchPlaceholder = "Search posts...",
	allTagsText = "All Tags",
}: SearchAndFilterProps) {
	return (
		<div className="mb-8 flex flex-col gap-4 md:flex-row">
			<div className="relative flex-1">
				<div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center">
					<Search className="size-5 text-muted-foreground" />
				</div>
				<Input
					type="text"
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder={searchPlaceholder}
					className="pl-10"
				/>
			</div>
			<div className="w-full md:w-64">
				<Select
					value={selectedTag || ALL_TAGS_VALUE}
					onValueChange={(value) =>
						onTagChange(value === ALL_TAGS_VALUE ? "" : value)
					}
				>
					<SelectTrigger>
						<SelectValue placeholder={allTagsText} />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_TAGS_VALUE}>{allTagsText}</SelectItem>
						{tags.map((tag) => (
							<SelectItem key={tag.id} value={tag.slug}>
								{tag.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}
