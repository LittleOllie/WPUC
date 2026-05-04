/**
 * Shared fetch + JSON helpers for Collection Overlap (timeouts, no overlap math).
 */
(function () {
  function coSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Single GET/POST with timeout; aborts via AbortController when timeout fires.
   * Parent `signal` abort also aborts the attempt.
   * @returns {Promise<{ res: Response, data: object }>}
   */
  async function coFetchJsonOnce(url, options) {
    const method = options?.method || "GET";
    const timeoutMs = typeof options?.timeoutMs === "number" ? options.timeoutMs : 8000;
    const parentSignal = options?.signal;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const onParentAbort = () => ac.abort();
    if (parentSignal) {
      if (parentSignal.aborted) {
        clearTimeout(timer);
        throw new DOMException("Aborted", "AbortError");
      }
      parentSignal.addEventListener("abort", onParentAbort);
    }
    try {
      const res = await fetch(url, { method, signal: ac.signal, mode: "cors" });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      return { res, data };
    } finally {
      clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort);
    }
  }

  /**
   * @param {string} url
   * @param {{
   *   signal?: AbortSignal|null,
   *   timeoutMs?: number,
   *   method?: string,
   *   maxAdditionalRetries?: number,
   *   retryDelaysMs?: number[],
   *   onRetrying?: (attemptIndex: number) => void,
   *   shouldRetry: (ctx: { res: Response|null, data: object, err: unknown|null, attempt: number }) => boolean,
   * }} opts
   * @returns {Promise<{ res: Response, data: object, attempts: number }>}
   */
  async function coResilientFetchJson(url, opts) {
    const signal = opts?.signal;
    const timeoutMs = opts?.timeoutMs ?? 8000;
    const method = opts?.method || "GET";
    const maxAdditionalRetries = typeof opts?.maxAdditionalRetries === "number" ? opts.maxAdditionalRetries : 2;
    const retryDelaysMs = Array.isArray(opts?.retryDelaysMs) ? opts.retryDelaysMs : [300, 800];
    const onRetrying = opts?.onRetrying;
    const shouldRetry = opts?.shouldRetry;

    const maxAttempts = 1 + maxAdditionalRetries;
    let lastRes = /** @type {Response|null} */ (null);
    let lastData = /** @type {object} */ ({});
    let lastErr = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      if (attempt > 0 && typeof onRetrying === "function") onRetrying(attempt);

      try {
        const { res, data } = await coFetchJsonOnce(url, { signal, timeoutMs, method });
        lastRes = res;
        lastData = data;
        lastErr = null;
        const isLastAttempt = attempt === maxAttempts - 1;
        const retry = shouldRetry({ res, data, err: null, attempt, isLastAttempt });
        if (!retry) {
          return { res, data, attempts: attempt + 1 };
        }
      } catch (err) {
        lastErr = err;
        const isLastAttempt = attempt === maxAttempts - 1;
        const retry = shouldRetry({ res: lastRes, data: lastData, err, attempt, isLastAttempt });
        if (!retry) {
          throw err;
        }
      }

      if (attempt < maxAttempts - 1) {
        await coSleep(retryDelaysMs[attempt] ?? 800);
      }
    }

    if (lastRes) return { res: lastRes, data: lastData, attempts: maxAttempts };
    throw lastErr || new Error("Request failed after retries");
  }

  window.coFetchJson = { coSleep, coFetchJsonOnce, coResilientFetchJson };
})();
