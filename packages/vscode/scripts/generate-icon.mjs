/**
 * Generates the Marketplace icon (`icon.png`, 256x256 RGBA PNG) from the same
 * geometry as `media/notploy-activity.svg`.
 *
 * The script is dependency-free on purpose: it rasterises the mark with a
 * 4x4 supersampled point-in-polygon coverage test and writes the PNG with
 * Node's built-in `zlib`. Regenerate with `pnpm run generate:icon`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 256;
const SAMPLES = 4;
const GLYPH_UNITS = 24;
const GLYPH_SCALE = 8;
const GLYPH_OFFSET = (SIZE - GLYPH_UNITS * GLYPH_SCALE) / 2;

/** Hexagon ring: the outer crate is drawn, the inner one is punched out. */
const OUTER = [
	[12, 2.5],
	[20.5, 7.4],
	[20.5, 16.6],
	[12, 21.5],
	[3.5, 16.6],
	[3.5, 7.4],
];
const INNER = [
	[12, 5.4],
	[18, 8.9],
	[18, 15.1],
	[12, 18.6],
	[6, 15.1],
	[6, 8.9],
];
const ARROW = [
	[11.15, 7.6],
	[12.85, 7.6],
	[12.85, 11.7],
	[14.85, 11.7],
	[12, 15.5],
	[9.15, 11.7],
	[11.15, 11.7],
];

const BACKGROUND_TOP = [29, 78, 216];
const BACKGROUND_BOTTOM = [11, 17, 32];
const GLYPH_COLOR = [255, 255, 255];
const CORNER_RADIUS = 56;

function toPixel([x, y]) {
	return [GLYPH_OFFSET + x * GLYPH_SCALE, GLYPH_OFFSET + y * GLYPH_SCALE];
}

function pointInPolygon(x, y, polygon) {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const [xi, yi] = polygon[i];
		const [xj, yj] = polygon[j];
		const intersects =
			yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
		if (intersects) inside = !inside;
	}
	return inside;
}

function inRoundedRect(x, y) {
	const r = CORNER_RADIUS;
	const cx = Math.min(Math.max(x, r), SIZE - r);
	const cy = Math.min(Math.max(y, r), SIZE - r);
	if (x >= r && x <= SIZE - r) return y >= 0 && y <= SIZE;
	if (y >= r && y <= SIZE - r) return x >= 0 && x <= SIZE;
	return Math.hypot(x - cx, y - cy) <= r;
}

const outerPx = OUTER.map(toPixel);
const innerPx = INNER.map(toPixel);
const arrowPx = ARROW.map(toPixel);

const pixels = Buffer.alloc(SIZE * SIZE * 4);
const step = 1 / SAMPLES;

for (let py = 0; py < SIZE; py++) {
	for (let px = 0; px < SIZE; px++) {
		let backgroundCoverage = 0;
		let glyphCoverage = 0;

		for (let sy = 0; sy < SAMPLES; sy++) {
			for (let sx = 0; sx < SAMPLES; sx++) {
				const x = px + (sx + 0.5) * step;
				const y = py + (sy + 0.5) * step;

				if (inRoundedRect(x, y)) backgroundCoverage++;

				const inCrate =
					pointInPolygon(x, y, outerPx) && !pointInPolygon(x, y, innerPx);
				if (inCrate || pointInPolygon(x, y, arrowPx)) glyphCoverage++;
			}
		}

		const total = SAMPLES * SAMPLES;
		const bg = backgroundCoverage / total;
		const fg = glyphCoverage / total;
		const ratio = py / SIZE;

		const i = (py * SIZE + px) * 4;
		let r = 0;
		let g = 0;
		let b = 0;
		let a = 0;

		if (bg > 0) {
			for (let c = 0; c < 3; c++) {
				const channel =
					BACKGROUND_TOP[c] * (1 - ratio) + BACKGROUND_BOTTOM[c] * ratio;
				const blended = channel * (1 - fg) + GLYPH_COLOR[c] * fg;
				if (c === 0) r = blended;
				if (c === 1) g = blended;
				if (c === 2) b = blended;
			}
			a = bg * 255;
		}

		pixels[i] = Math.round(r);
		pixels[i + 1] = Math.round(g);
		pixels[i + 2] = Math.round(b);
		pixels[i + 3] = Math.round(a);
	}
}

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c >>> 0;
	}
	return table;
})();

function crc32(buffer) {
	let crc = 0xffffffff;
	for (const byte of buffer) {
		crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body), 0);
	return Buffer.concat([length, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type: RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
	raw[y * (SIZE * 4 + 1)] = 0; // filter type: none
	pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const png = Buffer.concat([
	Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
	chunk("IHDR", ihdr),
	chunk("IDAT", deflateSync(raw, { level: 9 })),
	chunk("IEND", Buffer.alloc(0)),
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(root, { recursive: true });
const target = path.join(root, "icon.png");
writeFileSync(target, png);
console.log(
	`Wrote ${path.relative(process.cwd(), target)} (${png.length} bytes)`,
);
