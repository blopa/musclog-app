/**
 * Reads the attributes of one SVG tag (`id="x" d="…"`), shared by both Loggy generators. Only
 * double-quoted values are understood, and anything else is an error naming `where`, so a part
 * file written with single quotes fails loudly instead of losing an attribute.
 */
function readAttributes(text, where) {
  const attributes = {};

  for (const [, name, value] of text.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) {
    attributes[name] = value;
  }

  const leftover = text
    .replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, '')
    .replace(/\/\s*$/, '')
    .trim();

  if (leftover) {
    throw new Error(`${where}: cannot read attributes "${leftover}" (use double quotes)`);
  }

  return attributes;
}

module.exports = { readAttributes };
