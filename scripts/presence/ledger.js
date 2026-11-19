/**
 * The change ledger: a markdown table in docs/ONLINE_PRESENCE.md that records what was changed on the
 * strength of search data, and when to look at the result. It is what turns one-off advice into a
 * feedback loop: `presence report` lists every entry whose review date has passed, with the page's
 * current numbers beside it.
 *
 * Columns: Date | Change | Target | Evidence | Review on. `Target` is a site path (`/tools/one-rep-max`)
 * or a query in backticks; `Date` and `Review on` are ISO days. Rows that do not start with an ISO date
 * (the header, the separator, the "none yet" placeholder) are ignored.
 */
const fs = require('node:fs');
const path = require('node:path');

const { REPO_ROOT } = require('./config');

const LEDGER_FILE = path.join(REPO_ROOT, 'docs', 'ONLINE_PRESENCE.md');
const LEDGER_HEADING = /^##\s+Change ledger\s*$/im;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseLedger(markdown) {
  const heading = markdown.match(LEDGER_HEADING);

  if (!heading) {
    return [];
  }

  const rest = markdown.slice(heading.index + heading[0].length);
  const next = rest.search(/^##\s/m);
  const section = next === -1 ? rest : rest.slice(0, next);
  const entries = [];

  for (const line of section.split('\n')) {
    if (!line.trim().startsWith('|')) {
      continue;
    }

    const cells = line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim());

    if (cells.length < 5 || !ISO_DAY.test(cells[0])) {
      continue;
    }

    entries.push({
      date: cells[0],
      change: cells[1],
      target: cells[2].replace(/^`|`$/g, ''),
      evidence: cells[3],
      reviewOn: ISO_DAY.test(cells[4]) ? cells[4] : null,
    });
  }

  return entries;
}

function readLedger(file = LEDGER_FILE) {
  return fs.existsSync(file) ? parseLedger(fs.readFileSync(file, 'utf8')) : [];
}

/** Entries whose review date is today or earlier. ISO days compare correctly as strings. */
function dueEntries(entries, today) {
  return entries.filter((entry) => entry.reviewOn && entry.reviewOn <= today);
}

module.exports = { LEDGER_FILE, dueEntries, parseLedger, readLedger };
