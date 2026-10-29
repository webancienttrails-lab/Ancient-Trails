const path = require('node:path');
const fs = require('node:fs/promises');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../public');
const assets = [
  ['illustration/Hampi illustration.png', 'illustration/Hampi illustration.webp', 660, 780, 78],
  ['illustration/Khajuraho illustration.png', 'illustration/Khajuraho illustration.webp', 660, 780, 78],
  ['home assets/Map.webp', 'home assets/Map-optimized.webp', 1070, 1070, 75],
  ['Header Logo.png', 'Header Logo.webp', 218, 86, 90],
];
(async () => {
  for (const [input, output, width, height, quality] of assets) {
    const from = path.join(root, input), to = path.join(root, output);
    const result = await sharp(from).rotate().resize({ width, height, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6 }).toFile(to);
    const original = await fs.stat(from);
    console.log(`${output}: ${original.size} -> ${result.size} bytes (${result.width}x${result.height})`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
