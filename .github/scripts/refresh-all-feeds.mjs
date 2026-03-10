const apiBaseUrl = process.env.RSS_API_BASE_URL ?? 'https://api-production-c2fc.up.railway.app';
const userId = process.env.RSS_USER_ID?.trim() || '';
const refreshLimit = Number.parseInt(process.env.RSS_REFRESH_LIMIT ?? '', 10);
const refreshConcurrency = Math.max(
  1,
  Number.parseInt(process.env.RSS_REFRESH_CONCURRENCY ?? '', 10) || 6
);

function buildHeaders() {
  const headers = {
    accept: 'application/json'
  };

  if (userId) {
    headers.authorization = `Bearer ${userId}`;
  }

  return headers;
}

async function fetchSubscriptions() {
  const response = await fetch(`${apiBaseUrl}/api/subscriptions`, {
    headers: buildHeaders()
  });

  if (!response.ok) {
    throw new Error(`Unable to load subscriptions: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function refreshSubscription(subscription) {
  const response = await fetch(`${apiBaseUrl}/api/subscriptions/${subscription.id}/refresh`, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      'content-type': 'application/json'
    },
    body: '{}'
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      ok: false,
      subscriptionId: subscription.id,
      title: subscription.titleOverride ?? subscription.feed?.title ?? subscription.id,
      status: response.status,
      message: errorBody.trim() || response.statusText
    };
  }

  return {
    ok: true,
    subscriptionId: subscription.id,
    title: subscription.titleOverride ?? subscription.feed?.title ?? subscription.id
  };
}

async function run() {
  const subscriptions = await fetchSubscriptions();
  const eligibleSubscriptions = subscriptions
    .filter((subscription) => subscription.feed?.status !== 'disabled')
    .slice(0, Number.isFinite(refreshLimit) ? refreshLimit : undefined);

  console.log(
    `Refreshing ${eligibleSubscriptions.length} RSS source(s) from ${apiBaseUrl} with concurrency ${refreshConcurrency}.`
  );

  const successes = [];
  const failures = [];

  for (let index = 0; index < eligibleSubscriptions.length; index += refreshConcurrency) {
    const batch = eligibleSubscriptions.slice(index, index + refreshConcurrency);
    const results = await Promise.all(batch.map((subscription) => refreshSubscription(subscription)));

    for (const result of results) {
      if (result.ok) {
        successes.push(result);
        console.log(`OK  ${result.title}`);
      } else {
        failures.push(result);
        console.error(`ERR ${result.title} (${result.status}): ${result.message}`);
      }
    }
  }

  console.log(
    `Refresh complete. success=${successes.length} failure=${failures.length} total=${eligibleSubscriptions.length}`
  );

  if (failures.length === eligibleSubscriptions.length && eligibleSubscriptions.length > 0) {
    throw new Error('All refresh requests failed.');
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
