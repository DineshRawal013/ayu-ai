// HTTP clients for the internal services (health-svc, kundali-svc, ai-svc).
// Errors a service reports with 4xx are passed on to the browser unchanged;
// an unreachable service becomes 503.

const URLS = {
  health: process.env.HEALTH_URL || "http://health-svc:3001",
  kundali: process.env.KUNDALI_URL || "http://kundali-svc:3002",
  ai: process.env.AI_URL || "http://ai-svc:3003"
};

const LABEL = { health: "health", kundali: "kundali", ai: "AI" };

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Sends a request to a service. Returns the raw fetch Response.
async function request(service, path, { method = "GET", body, signal, timeoutMs = 15000 } = {}) {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);
  try {
    return await fetch(URLS[service] + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any(signals)
    });
  } catch (e) {
    if (signal && signal.aborted) throw e;
    throw httpError(503, `The ${LABEL[service]} service is unavailable right now. Please try again in a moment.`);
  }
}

// JSON call: returns the parsed body, or throws with the service's status and message.
async function call(service, path, options) {
  const res = await request(service, path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, data.error || `The ${LABEL[service]} service failed.`);
  return data;
}

// true if the service answers its /healthz within 3 s.
async function healthy(service) {
  try {
    const res = await fetch(URLS[service] + "/healthz", { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

module.exports = { URLS, request, call, healthy, httpError };
