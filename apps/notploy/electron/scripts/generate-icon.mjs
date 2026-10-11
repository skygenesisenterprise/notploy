/**
 * Generates the desktop app's identity from the same geometry as the VS Code
 * extension (`packages/vscode/media/notploy-activity.svg`), so the two clients
 * are recognisably the same product.
 *
 * Emits:
 *
 * - `assets/notploy.svg` — the vector mark, kept here as the single source of
 *   truth for the geometry. The renderer masks it with `currentColor` to tint it
 *   per theme, and the PNG below is rasterised from the same polygons.
 * - `assets/icon.png` — a 1024×1024 RGBA PNG. One size is enough: electron-builder
 *   derives the macOS `.icns` and the Windows `.ico` from it, and Linux uses it
 *   directly.
 *
 * Dependency-free on purpose, like the extension's generator: the mark is
 * rasterised with a supersampled point-in-polygon coverage test and the PNG is
 * written with Node's built-in `zlib`. Regenerate with `pnpm run generate:icon`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const SAMPLES = 3;
/** The mark is drawn on the SVG's 24×24 grid and scaled up from there. */
const GLYPH_UNITS = 24;
const GLYPH_SCALE = SIZE / 32;
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
/** Proportionally the same rounding as the 256px Marketplace icon. */
const CORNER_RADIUS = SIZE * (56 / 256);

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

function renderPixels() {
	const outerPx = OUTER.map(toPixel);
	const innerPx = INNER.map(toPixel);
	const arrowPx = ARROW.map(toPixel);

	const pixels = Buffer.alloc(SIZE * SIZE * 4);
	const step = 1 / SAMPLES;
	const total = SAMPLES * SAMPLES;

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

	return pixels;
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

function encodePng(pixels) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(SIZE, 0);
	ihdr.writeUInt32BE(SIZE, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: RGBA
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	const stride = SIZE * 4;
	const raw = Buffer.alloc(SIZE * (stride + 1));
	for (let y = 0; y < SIZE; y++) {
		raw[y * (stride + 1)] = 0; // filter type: none
		pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(raw, { level: 9 })),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

/** The vector mark, identical in geometry to the rasterised icon. */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <title>Notploy</title>
  <path fill="currentColor" fill-rule="evenodd"
    d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4L12 2.5Zm0 2.9L6 8.9v6.2l6 3.5 6-3.5V8.9l-6-3.5Z" />
  <path fill="currentColor" d="M11.15 7.6h1.7v4.1h2L12 15.5 9.15 11.7h2V7.6Z" />
</svg>
`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "assets");
mkdirSync(assets, { recursive: true });

const svgTarget = path.join(assets, "notploy.svg");
writeFileSync(svgTarget, SVG, "utf8");

const png = encodePng(renderPixels());
const pngTarget = path.join(assets, "icon.png");
writeFileSync(pngTarget, png);

for (const target of [svgTarget, pngTarget]) {
	console.log(`Wrote ${path.relative(process.cwd(), target)}`);
}
console.log(`Icon: ${SIZE}x${SIZE} RGBA (${png.length} bytes)`);
