/**
 * Turns one snapshot (everything `presence snapshot` collected) into a digest and a markdown report.
 * The digest is what the research skill reads: short, ranked, with the raw rows left in snapshot.json.
 * Pure: no I/O and no clock (`today` is passed in).
 */
const analysis = require('./analysis');

const TOP = 15;

function percent(value, digits = 1) {
  return value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(digits)}%`;
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function table(headers, rows) {
  if (rows.length === 0) {
    return '_none_\n';
  }

  const escape = (cell) =>
    String(cell ?? '')
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ');

  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
    '',
  ].join('\n');
}

function gscDigest(gsc, ledgerEntries) {
  const {
    queries,
    queriesPrevious,
    pages,
    pagesPrevious,
    queryPages,
    countries,
    devices,
    devicesPrevious = [],
    sitemaps = [],
  } = gsc;
  // Google hides the text of rare queries, so the query rows are only part of the traffic. The
  // device breakdown has no such gap, so it is the source of the real totals.
  const current = analysis.totals(devices);
  const previous = analysis.totals(devicesPrevious);
  const queryCoverage = {
    shownImpressions: analysis.totals(queries).impressions,
    totalImpressions: current.impressions,
  };
  const queryMovers = analysis.findMovers(
    analysis.compareGroups(queries, queriesPrevious, (row) => row.query)
  );
  const pageComparison = analysis.compareGroups(pages, pagesPrevious, (row) =>
    analysis.pagePath(row.page)
  );
  const pageMovers = analysis.findMovers(pageComparison);

  return {
    totals: { current, previous },
    queryCoverage,
    topQueries: [...queries]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, TOP),
    topPages: analysis.topPagesWithQueries(queryPages, { pages: TOP }),
    lowCtr: analysis.findLowCtr(queries).slice(0, TOP),
    strikingDistance: analysis.findStrikingDistance(queries).slice(0, TOP),
    cannibalization: analysis.findCannibalization(queryPages).slice(0, 10),
    questions: analysis.findQuestionQueries(queries).slice(0, 20),
    queryMovers,
    pageMovers,
    countries: analysis.byCountry(countries),
    devices: analysis
      .groupRows(devices, (row) => row.device)
      .sort((a, b) => b.impressions - a.impressions),
    sitemaps: sitemaps.map((entry) => ({
      path: entry.path,
      lastDownloaded: entry.lastDownloaded ?? null,
      errors: Number(entry.errors ?? 0),
      warnings: Number(entry.warnings ?? 0),
      submitted: (entry.contents ?? []).reduce(
        (sum, content) => sum + Number(content.submitted ?? 0),
        0
      ),
    })),
    ledgerDue: ledgerEntries.map((entry) => {
      const key = entry.target;
      const page = pageComparison.find((row) => row.key === key);
      const query = analysis
        .compareGroups(queries, queriesPrevious, (row) => row.query)
        .find((row) => row.key === key);

      return { ...entry, now: page ?? query ?? null };
    }),
  };
}

function ga4Digest(ga4) {
  return {
    weakLanding: analysis.findWeakLandingPages(ga4.landingPages),
    conversions: analysis.conversionByPage(ga4.conversions, ga4.landingPages).slice(0, TOP),
    sources: [...ga4.sources].sort((a, b) => b.sessions - a.sessions).slice(0, TOP),
    countries: [...ga4.countries].sort((a, b) => b.sessions - a.sessions).slice(0, 10),
    devices: ga4.devices,
    sessions: ga4.landingPages.reduce((sum, row) => sum + row.sessions, 0),
  };
}

/** `snapshot` is the object `presence snapshot` writes. `ledgerDue` are due entries from ledger.js. */
function buildDigest(snapshot, { ledgerDue = [] } = {}) {
  const { sources } = snapshot;
  const digest = {
    generatedAt: snapshot.generatedAt,
    window: snapshot.window,
    errors: Object.fromEntries(
      Object.entries(sources)
        .filter(([, source]) => !source.ok)
        .map(([name, source]) => [name, source.error])
    ),
  };

  if (sources.gsc?.ok) {
    digest.gsc = gscDigest(sources.gsc.data, ledgerDue);
    digest.gsc.unseenUrls = sources.audit?.ok
      ? analysis.findUnseenUrls(sources.audit.data.sitemapUrls, sources.gsc.data.pages)
      : [];
  }

  if (sources.ga4?.ok) {
    digest.ga4 = ga4Digest(sources.ga4.data);
  }

  if (sources.play?.ok) {
    digest.play = sources.play.data;
  }

  if (sources.audit?.ok) {
    digest.audit = {
      stats: sources.audit.data.stats,
      warnings: sources.audit.data.findings.filter((finding) => finding.severity === 'warn'),
      notes: sources.audit.data.findings.filter((finding) => finding.severity !== 'warn').length,
    };
  }

  if (sources.live?.ok) {
    digest.live = sources.live.data;
  }

  return digest;
}

function renderMarkdown(digest) {
  const lines = [];
  const { window } = digest;

  lines.push(`# Musclog online presence: ${digest.generatedAt.slice(0, 10)}`, '');
  lines.push(
    `Window: ${window.current.start} to ${window.current.end} (${window.days} days), compared with ${window.previous.start} to ${window.previous.end}.`,
    ''
  );

  if (Object.keys(digest.errors).length > 0) {
    lines.push('## Sources that failed', '');
    for (const [name, error] of Object.entries(digest.errors)) {
      lines.push(`- **${name}**: ${error}`);
    }

    lines.push('');
  }

  if (digest.gsc) {
    const { totals } = digest.gsc;

    lines.push('## Search Console', '');
    lines.push(
      table(
        ['', 'Clicks', 'Impressions', 'CTR', 'Avg position'],
        [
          [
            'This window',
            totals.current.clicks,
            totals.current.impressions,
            percent(totals.current.ctr),
            totals.current.position.toFixed(1),
          ],
          [
            'Previous',
            totals.previous.clicks,
            totals.previous.impressions,
            percent(totals.previous.ctr),
            totals.previous.position.toFixed(1),
          ],
        ]
      )
    );

    lines.push('### Top queries', '');
    lines.push(
      `Google shows the text for ${digest.gsc.queryCoverage.shownImpressions} of ${digest.gsc.queryCoverage.totalImpressions} impressions; the rest are anonymized rare queries.`,
      ''
    );
    lines.push(
      table(
        ['Query', 'Clicks', 'Impr.', 'CTR', 'Pos.'],
        digest.gsc.topQueries.map((row) => [
          row.query,
          row.clicks,
          row.impressions,
          percent(row.ctr),
          row.position.toFixed(1),
        ])
      )
    );

    lines.push('### Top pages', '');
    lines.push(
      table(
        ['Page', 'Clicks', 'Impr.', 'Pos.', 'Main queries'],
        digest.gsc.topPages.map((row) => [
          row.page,
          row.clicks,
          row.impressions,
          row.position.toFixed(1),
          row.queries.join('; '),
        ])
      )
    );

    lines.push('### Page one, but not winning the click (rewrite title / description)', '');
    lines.push(
      table(
        ['Query', 'Impr.', 'CTR', 'Expected', 'Pos.', 'Clicks missed'],
        digest.gsc.lowCtr.map((row) => [
          row.query,
          row.impressions,
          percent(row.ctr),
          percent(row.expectedCtr),
          row.position.toFixed(1),
          Math.round(row.missedClicks),
        ])
      )
    );

    lines.push('### Striking distance (positions 8 to 20)', '');
    lines.push(
      table(
        ['Query', 'Impr.', 'Clicks', 'Pos.'],
        digest.gsc.strikingDistance.map((row) => [
          row.query,
          row.impressions,
          row.clicks,
          row.position.toFixed(1),
        ])
      )
    );

    lines.push('### Questions people ask (post ideas)', '');
    lines.push(
      table(
        ['Query', 'Impr.', 'Clicks', 'Pos.'],
        digest.gsc.questions.map((row) => [
          row.query,
          row.impressions,
          row.clicks,
          row.position.toFixed(1),
        ])
      )
    );

    lines.push('### Several of our pages compete for one query', '');
    lines.push(
      table(
        ['Query', 'Impr.', 'Pages (impressions, position)'],
        digest.gsc.cannibalization.map((row) => [
          row.query,
          row.impressions,
          row.pages
            .map((page) => `${page.page} (${page.impressions}, ${page.position.toFixed(1)})`)
            .join('; '),
        ])
      )
    );

    for (const [title, movers] of [
      ['Pages that moved', digest.gsc.pageMovers],
      ['Queries that moved', digest.gsc.queryMovers],
    ]) {
      lines.push(`### ${title}`, '');
      lines.push(
        table(
          ['', 'Key', 'Clicks', 'Δ clicks', 'Δ impr.', 'Δ position'],
          [
            ...movers.gainers
              .slice(0, 8)
              .map((row) => [
                'up',
                row.key,
                row.clicks,
                signed(row.clicksDelta),
                signed(row.impressionsDelta),
                row.positionDelta === null ? 'n/a' : row.positionDelta.toFixed(1),
              ]),
            ...movers.losers
              .slice(0, 8)
              .map((row) => [
                'down',
                row.key,
                row.clicks,
                signed(row.clicksDelta),
                signed(row.impressionsDelta),
                row.positionDelta === null ? 'n/a' : row.positionDelta.toFixed(1),
              ]),
          ]
        )
      );
    }

    lines.push('### Sitemap URLs with no impressions in the window', '');
    lines.push(
      digest.gsc.unseenUrls.length === 0
        ? '_none_\n'
        : `${digest.gsc.unseenUrls.length} URLs, first 30:\n\n${digest.gsc.unseenUrls
            .slice(0, 30)
            .map((url) => `- ${url}`)
            .join('\n')}\n`
    );

    lines.push('### Countries and devices', '');
    lines.push(
      table(
        ['Country', 'Clicks', 'Impr.', 'Pos.'],
        digest.gsc.countries.map((row) => [
          row.key,
          row.clicks,
          row.impressions,
          row.position.toFixed(1),
        ])
      )
    );
    lines.push(
      table(
        ['Device', 'Clicks', 'Impr.', 'CTR'],
        digest.gsc.devices.map((row) => [row.key, row.clicks, row.impressions, percent(row.ctr)])
      )
    );

    lines.push('### Sitemaps as Google sees them', '');
    lines.push(
      table(
        ['Path', 'Submitted', 'Errors', 'Warnings', 'Last read'],
        digest.gsc.sitemaps.map((row) => [
          row.path,
          row.submitted,
          row.errors,
          row.warnings,
          row.lastDownloaded ?? 'never',
        ])
      )
    );

    if (digest.gsc.ledgerDue.length > 0) {
      lines.push('### Changes due for review', '');
      lines.push(
        table(
          ['Made', 'Change', 'Target', 'Evidence at the time', 'Now (Δ vs previous window)'],
          digest.gsc.ledgerDue.map((entry) => [
            entry.date,
            entry.change,
            entry.target,
            entry.evidence,
            entry.now
              ? `${entry.now.clicks} clicks (${signed(entry.now.clicksDelta)}), ${entry.now.impressions} impr. (${signed(entry.now.impressionsDelta)}), pos ${entry.now.position.toFixed(1)}`
              : 'no data for this target',
          ])
        )
      );
    }
  }

  if (digest.ga4) {
    lines.push('## Google Analytics (consenting visitors only: shape, not totals)', '');
    lines.push(
      table(
        ['Source', 'Medium', 'Campaign', 'Sessions', 'Engaged'],
        digest.ga4.sources.map((row) => [
          row.sessionSource,
          row.sessionMedium,
          row.sessionCampaignName,
          row.sessions,
          row.engagedSessions,
        ])
      )
    );
    lines.push('### Where visitors move toward the app', '');
    lines.push(
      table(
        ['Page', 'Sessions', 'Store clicks', 'Demo starts', 'Store clicks / session'],
        digest.ga4.conversions.map((row) => [
          row.page,
          row.sessions ?? 'n/a',
          row.storeClicks,
          row.demoStarts,
          percent(row.storeClickRate),
        ])
      )
    );
    lines.push('### Landing pages people leave quickly', '');
    lines.push(
      table(
        ['Landing page', 'Sessions', 'Engagement rate'],
        digest.ga4.weakLanding.map((row) => [
          row.landingPage,
          row.sessions,
          percent(row.engagementRate),
        ])
      )
    );
  }

  if (digest.play) {
    lines.push('## Google Play', '');
    const { reviews, health, storePerformance } = digest.play;

    if (reviews) {
      lines.push(
        `Reviews on record: ${reviews.summary.count}, average ${reviews.summary.average === null ? 'n/a' : reviews.summary.average.toFixed(2)}, ${reviews.summary.unreplied} unanswered (Play serves only the last week; older ones are kept in .presence/play-reviews.json).`,
        ''
      );
      lines.push(
        table(
          ['Date', 'Stars', 'Version', 'Replied', 'Text'],
          reviews.recent
            .slice(0, 15)
            .map((row) => [
              row.date ?? '',
              row.stars ?? '',
              row.appVersion ?? '',
              row.replied ? 'yes' : 'no',
              row.text.slice(0, 200),
            ])
        )
      );
    }

    if (health) {
      lines.push(
        '### Release health',
        '',
        `Status: ${health.status ?? health.error ?? 'unknown'}`,
        ''
      );
      lines.push(
        table(
          ['Source', 'OK', 'Error'],
          (health.sources ?? []).map((source) => [
            source.name,
            source.ok ? 'yes' : 'no',
            (source.error ?? '').split('\n')[0].slice(0, 160),
          ])
        )
      );
      lines.push('```json', JSON.stringify(health.tracks ?? {}, null, 2).slice(0, 1500), '```', '');
    }

    if (storePerformance && !storePerformance.skipped) {
      lines.push('### Store listing performance', '');
      lines.push(
        table(
          ['Country', 'Visitors', 'Installs', 'Conversion'],
          storePerformance.byCountry.map((row) => [
            row.key,
            row.visitors,
            row.acquisitions,
            percent(row.conversion),
          ])
        )
      );
      lines.push(
        table(
          ['Traffic source', 'Visitors', 'Installs', 'Conversion'],
          storePerformance.byTrafficSource.map((row) => [
            row.key,
            row.visitors,
            row.acquisitions,
            percent(row.conversion),
          ])
        )
      );
    } else if (storePerformance?.skipped) {
      lines.push(`_${storePerformance.skipped}_`, '');
    }
  }

  if (digest.live) {
    const { live } = digest;

    lines.push('## Live sitemap check', '');
    lines.push(`${live.ok} of ${live.checked} sitemap URLs answer 200.`, '');

    if (live.problems.length > 0) {
      lines.push(
        table(
          ['Status', 'URL', 'Redirects to'],
          live.problems.slice(0, 30).map((row) => [row.status, row.url, row.location ?? ''])
        )
      );
      lines.push(
        `By status: ${Object.entries(live.byStatus)
          .map(([status, count]) => `${status} x${count}`)
          .join(', ')}. ${live.downgradesToHttp} redirect to plain http.`,
        ''
      );
    }
  }

  if (digest.audit) {
    lines.push('## Site audit (offline)', '');
    lines.push(
      `${digest.audit.stats.indexableRoutes} indexable routes, ${digest.audit.stats.sitemapUrls ?? 'no'} sitemap URLs, ${digest.audit.stats.posts} posts in ${Object.keys(digest.audit.stats.postsByCategory).length} categories: ${Object.entries(
        digest.audit.stats.postsByCategory
      )
        .map(([key, count]) => `${key} ${count}`)
        .join(', ')}. ${digest.audit.notes} lower-priority notes are in snapshot.json.`,
      ''
    );
    lines.push(
      table(
        ['Kind', 'Target', 'Finding'],
        digest.audit.warnings.map((finding) => [finding.kind, finding.target, finding.message])
      )
    );
  }

  return `${lines.join('\n')}\n`;
}

module.exports = { buildDigest, renderMarkdown };
