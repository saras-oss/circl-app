/**
 * Retry wrapper for Anthropic API calls that handles transient errors
 * (529 overloaded, 429 rate limited, 503 service unavailable).
 */
export async function callAnthropicWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const status =
        (error as { status?: number })?.status ||
        (error as { response?: { status?: number } })?.response?.status;
      if (
        (status === 529 || status === 429 || status === 503) &&
        attempt < maxRetries - 1
      ) {
        const waitTime = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s, 16s
        console.log(
          `Anthropic ${status}, retrying in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise((r) => setTimeout(r, waitTime));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Anthropic API failed after ${maxRetries} retries`);
}
