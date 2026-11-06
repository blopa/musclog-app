import fs from 'fs';

import {
  aggregate,
  BASELINE_PATH,
  baselineFrom,
  newErrors,
  readBaseline,
  readShards,
  REPORT_DIR,
  writeReport,
} from './report';
import { writeHtmlReport } from './reportHtml';

/**
 * Merges the shards every project wrote into `layout-audit-report/report.{md,json}`.
 *
 * - `MUSCLOG_LAYOUT_UPDATE_BASELINE=1` accepts every current error and warning into
 *   `tests/layoutAudit/baseline.json` (commit it, with a reason per entry, to ratchet).
 * - `MUSCLOG_LAYOUT_STRICT=1` fails the run on an error the baseline has not accepted.
 */
export default async function globalTeardown(): Promise<void> {
  const entries = readShards();
  if (entries.length === 0) {
    console.log('[layout] no audit entries were written; nothing to report');
    return;
  }

  const previous = readBaseline();
  let report = aggregate(entries, previous);
  if (process.env.MUSCLOG_LAYOUT_UPDATE_BASELINE === '1') {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baselineFrom(report, previous), null, 2) + '\n');
    report = aggregate(entries, readBaseline());
    console.log(`[layout] baseline updated: ${BASELINE_PATH}`);
  }

  writeReport(report);
  const html = writeHtmlReport(entries, readBaseline());
  const open = report.groups.filter((group) => !group.accepted);
  const count = (severity: string) => open.filter((group) => group.severity === severity).length;
  console.log(
    `[layout] ${count('error')} errors, ${count('warn')} warnings, ${count('info')} notes → ${REPORT_DIR}/report.md\n[layout] browse every screen: ${html}`
  );

  const failing = newErrors(report);
  if (process.env.MUSCLOG_LAYOUT_STRICT === '1' && failing.length > 0) {
    throw new Error(
      `${failing.length} layout error(s) are not in the baseline:\n` +
        failing
          .slice(0, 20)
          .map((group) => `  - ${group.surface} ${group.name}: ${group.messages[0] ?? group.kind}`)
          .join('\n')
    );
  }
}
