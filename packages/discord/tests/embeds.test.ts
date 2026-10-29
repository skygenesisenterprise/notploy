import { describe, expect, it } from "vitest";
import {
	baseEmbed,
	COLORS,
	errorEmbed,
	formatLinks,
	infoEmbed,
	linksEmbed,
	successEmbed,
	warningEmbed,
} from "../src/utils/embeds.js";

describe("embeds", () => {
	it("formatLinks renders markdown links", () => {
		const output = formatLinks([
			{ label: "Docs", url: "https://docs.example.com", description: "read me" },
			{ label: "GitHub", url: "https://github.com", description: "source" },
		]);
		expect(output).toContain("[Docs](https://docs.example.com)");
		expect(output).toContain("[GitHub](https://github.com)");
		expect(output.split("\n")).toHaveLength(2);
	});

	it("applies the brand palette", () => {
		expect(baseEmbed().data.color).toBe(COLORS.brand);
		expect(infoEmbed("t").data.color).toBe(COLORS.brand);
		expect(successEmbed("t").data.color).toBe(COLORS.success);
		expect(warningEmbed("t").data.color).toBe(COLORS.warning);
		expect(errorEmbed("t").data.color).toBe(COLORS.danger);
	});

	it("sets the title and description", () => {
		const embed = infoEmbed("Title", "Description").toJSON();
		expect(embed.title).toBe("Title");
		expect(embed.description).toBe("Description");
		expect(embed.footer?.text).toBe("Notploy Community");
	});

	it("builds a links embed", () => {
		const embed = linksEmbed("Resources", [
			{ label: "Docs", url: "https://docs.example.com", description: "read me" },
		]).toJSON();
		expect(embed.title).toBe("Resources");
		expect(embed.description).toContain("[Docs](https://docs.example.com)");
	});
});
