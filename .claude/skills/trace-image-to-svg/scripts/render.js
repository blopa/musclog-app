// Usage: node render.js in.svg out.png [background] [density]
// Density 200 draws a viewBox-only 512-wide SVG about 1422px wide.
const sharp = require(require.resolve('sharp', { paths: [process.cwd(), __dirname] }));

const [, , input, output, background = '#111', density = '200'] = process.argv;

sharp(input, { density: Number(density) })
  .flatten({ background })
  .png()
  .toFile(output)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
