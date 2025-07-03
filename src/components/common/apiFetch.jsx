const API_CALL_DELAY_MS = 1250;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const riotApiFetchWithRetry = async (url, retries = 5, delayMs = API_CALL_DELAY_MS) => {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url);
    if (response.status === 429) {
      // Too many requests — wait and retry
      const retryAfter = response.headers.get("Retry-After");
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delayMs;
      console.warn(`Rate limited. Waiting ${waitTime}ms before retrying...`);
      await delay(waitTime);
      continue;
    }
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
    return response;
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
};

export default riotApiFetchWithRetry;
