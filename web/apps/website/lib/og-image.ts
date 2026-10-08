import * as fs from "node:fs/promises";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";

interface GenerateOGImageOptions {
	title: string;
	label?: string;
	author?: {
		name: string;
		image?: string;
	};
	date?: string;
	readingTime?: number;
}

const NOTPLOY_WORDMARK = {
	type: "div",
	props: {
		style: { fontSize: "140px", fontWeight: 700, color: "#ffffff", opacity: 0.12 },
		children: "Notploy",
	},
};

export async function generateOGImage({
	title,
	label = "Notploy - Blog Post",
	author,
	date,
	readingTime,
}: GenerateOGImageOptions): Promise<Buffer> {
	// Cargar la fuente
	const interRegular = await fs.readFile(
		join(process.cwd(), "public/fonts/Inter-Regular.ttf"),
	);
	const interBold = await fs.readFile(
		join(process.cwd(), "public/fonts/Inter-Bold.ttf"),
	);

	// Crear el markup para la imagen OG
	const markup = {
		type: "div",
		props: {
			style: {
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "flex-start",
				justifyContent: "center",
				backgroundColor: "#000000",
				padding: "80px",
				position: "relative",
				overflow: "hidden",
			},
			children: [
				{
					type: "div",
					props: {
						style: {
							position: "absolute",
							left: "80px",
							top: "40px",
							fontSize: "32px",
							fontWeight: 700,
							color: "#fff",
							zIndex: 1,
						},
						children: label,
					},
				},
				{
					type: "div",
					props: {
						style: {
							position: "absolute",
							right: "-50px",
							bottom: "-50px",
							width: "500px",
							height: "500px",
							opacity: 0.1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							transform: "rotate(-10deg)",
							color: "#ffffff",
						},
						children: NOTPLOY_WORDMARK,
					},
				},
				{
					type: "div",
					props: {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "24px",
							position: "relative",
							zIndex: 1,
						},
						children: [
							{
								type: "div",
								props: {
									style: {
										fontSize: "64px",
										fontWeight: 700,
										color: "#fff",
										lineHeight: 1.2,
										maxWidth: "900px",
									},
									children: title,
								},
							},
							{
								type: "div",
								props: {
									style: {
										display: "flex",
										alignItems: "center",
										gap: "16px",
									},
									children: [
										author?.name && {
											type: "div",
											props: {
												style: {
													color: "#9CA3AF",
													fontSize: "24px",
												},
												children: author.name,
											},
										},
										date && {
											type: "div",
											props: {
												style: {
													color: "#9CA3AF",
													fontSize: "24px",
												},
												children: `• ${date}`,
											},
										},
										readingTime && {
											type: "div",
											props: {
												style: {
													color: "#9CA3AF",
													fontSize: "24px",
												},
												children: `• ${readingTime} min read`,
											},
										},
									].filter(Boolean) as any,
								},
							},
						],
					},
				},
			],
		},
	};

	// Generar SVG con Satori
	const svg = await satori(markup as any, {
		width: 1200,
		height: 630,
		fonts: [
			{
				name: "Inter",
				data: interRegular,
				weight: 400,
				style: "normal",
			},
			{
				name: "Inter",
				data: interBold,
				weight: 700,
				style: "normal",
			},
		],
	});

	// Convertir SVG a PNG
	const png = await sharp(Buffer.from(svg)).png().toBuffer();

	return png;
}
