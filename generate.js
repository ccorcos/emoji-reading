#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Configuration
const SVG_WIDTH = 1056; // 11 inches at 96 DPI (landscape)
const SVG_HEIGHT = 816; // 8.5 inches at 96 DPI
const FONT_SIZE = 24; // Large font for toddlers
const PADDING = FONT_SIZE / 4; // Padding around each word
const MAX_ATTEMPTS = 5000; // Maximum attempts to place a word

// Read words from file
function readWords(filename) {
	const content = fs.readFileSync(filename, "utf-8");
	return content.split("\n").filter((line) => line.trim() !== "");
}

// Estimate bounding box for emoji text
// Emojis are typically wider than regular text
function estimateBoundingBox(text, fontSize) {
	// Emojis are roughly square, so width ≈ height ≈ fontSize
	// Each emoji takes about fontSize * 0.9 pixels (slightly tighter)
	const width = text.length * fontSize * 0.9 + PADDING * 2;
	const height = fontSize * 1.2 + PADDING * 2;
	return { width, height };
}

// Check if two rectangles overlap
function rectanglesOverlap(rect1, rect2) {
	return !(
		rect1.x + rect1.width < rect2.x ||
		rect2.x + rect2.width < rect1.x ||
		rect1.y + rect1.height < rect2.y ||
		rect2.y + rect2.height < rect1.y
	);
}

// Find a random position for a word that doesn't overlap with existing placements
function findNonOverlappingPosition(
	boundingBox,
	placedRectangles,
	width,
	height
) {
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const x = Math.random() * (width - boundingBox.width);
		const y = Math.random() * (height - boundingBox.height);

		const newRect = {
			x,
			y,
			width: boundingBox.width,
			height: boundingBox.height,
		};

		// Check if this position overlaps with any existing rectangles
		const overlaps = placedRectangles.some((rect) =>
			rectanglesOverlap(newRect, rect)
		);

		if (!overlaps) {
			return newRect;
		}
	}

	return null; // Could not find a non-overlapping position
}

// Generate SVG content
function generateSVG(words) {
	const placedRectangles = [];
	const textElements = [];
	const unplacedWords = [];

	// Shuffle words for random order
	const shuffledWords = [...words].sort(() => Math.random() - 0.5);

	for (const word of shuffledWords) {
		const boundingBox = estimateBoundingBox(word, FONT_SIZE);
		const position = findNonOverlappingPosition(
			boundingBox,
			placedRectangles,
			SVG_WIDTH,
			SVG_HEIGHT
		);

		if (position) {
			placedRectangles.push(position);

			// Calculate text position (center of bounding box, with baseline adjustment)
			const textX = position.x + position.width / 2;
			const textY = position.y + position.height / 2 + FONT_SIZE / 3; // Adjust for baseline

			// Random rotation for more playful layout (-15 to 15 degrees)
			const rotation = (Math.random() - 0.5) * 30;

			textElements.push({
				text: word,
				x: textX,
				y: textY,
				rotation,
			});
		} else {
			unplacedWords.push(word);
		}
	}

	// If we couldn't place all words, throw an error
	if (unplacedWords.length > 0) {
		throw new Error(
			`Failed to place ${unplacedWords.length} word(s): ${unplacedWords.join(
				", "
			)}. ` + `Try reducing font size or increasing canvas size.`
		);
	}

	// Build SVG
	let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}"
     xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="100%" height="100%" fill="#FFFFFF"/>

  <!-- Words -->
  <g font-family="Arial, sans-serif" font-size="${FONT_SIZE}" text-anchor="middle">
`;

	for (const element of textElements) {
		svg += `    <text x="${element.x.toFixed(2)}" y="${element.y.toFixed(2)}" `;
		svg += `transform="rotate(${element.rotation.toFixed(
			2
		)} ${element.x.toFixed(2)} ${element.y.toFixed(2)})"`;
		svg += `>${escapeXml(element.text)}</text>\n`;
	}

	svg += `  </g>
</svg>`;

	return svg;
}

// Escape XML special characters
function escapeXml(text) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

// Main function
function main() {
	const inputFile = process.argv[2] || "words.txt";
	const outputFile = process.argv[3] || "reading.svg";

	console.log(`Reading words from: ${inputFile}`);
	const words = readWords(inputFile);
	console.log(`Found ${words.length} words`);

	console.log("Generating SVG...");

	// Try multiple times with different random seeds to ensure all words fit
	let svg;
	let attempts = 0;
	const maxRetries = 10;

	while (attempts < maxRetries) {
		try {
			svg = generateSVG(words);
			console.log(`✓ Successfully placed all ${words.length} words!`);
			break;
		} catch (error) {
			attempts++;
			if (attempts >= maxRetries) {
				console.error(`Failed after ${maxRetries} attempts: ${error.message}`);
				process.exit(1);
			}
			console.log(`Attempt ${attempts} failed, retrying...`);
		}
	}

	fs.writeFileSync(outputFile, svg, "utf-8");
	console.log(`SVG saved to: ${outputFile}`);
	console.log(
		`Dimensions: ${SVG_WIDTH}x${SVG_HEIGHT} pixels (11" x 8.5" at 96 DPI)`
	);
	console.log("Ready to print in landscape orientation!");
}

main();
