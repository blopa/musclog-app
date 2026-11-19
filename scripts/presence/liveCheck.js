/**
 * Asks the LIVE site for every sitemap URL, without following redirects, and reports each one that does
 * not answer 200 (a redirect, a 404, a server error, a network failure). Read-only: plain GET requests.
 */

async function checkOne(url, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
    });
    const location = response.headers?.get?.('location') ?? null;

    return { url, status: response.status, location };
  } catch (error) {
    return { url, status: 0, location: error?.message ?? String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** Returns `[{ url, status, location }]` for every URL whose status is not 200, in input order. */
async function checkUrls(urls, { fetchImpl = fetch, concurrency = 8, timeoutMs = 15000 } = {}) {
  const results = new Array(urls.length);
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      const index = next;

      next += 1;
      results[index] = await checkOne(urls[index], { fetchImpl, timeoutMs });
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, urls.length)) }, worker)
  );

  return results.filter((result) => result && result.status !== 200);
}

function summarizeLiveCheck(results, totalChecked) {
  const byStatus = {};
  let downgradesToHttp = 0;

  for (const result of results) {
    byStatus[String(result.status)] = (byStatus[String(result.status)] ?? 0) + 1;

    if (typeof result.location === 'string' && result.location.startsWith('http://')) {
      downgradesToHttp += 1;
    }
  }

  return {
    checked: totalChecked,
    ok: totalChecked - results.length,
    problems: results,
    byStatus,
    downgradesToHttp,
  };
}

module.exports = { checkUrls, summarizeLiveCheck };
