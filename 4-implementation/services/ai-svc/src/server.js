// ai-svc: talks to the self-hosted Ollama model. Stateless: the gateway owns
// the database, caching and "already generating" locks, and sends the saved
// reading in each request.

const express = require("express");
const ai = require("./ai");

const app = express();
const port = Number(process.env.PORT) || 3003;

app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" })); // a reading with a kundali is ~24 kB

app.get("/healthz", (req, res) => res.json({ ok: true, service: "ai-svc" }));

// Ollama reachability and model readiness.
app.get("/status", async (req, res) => {
  res.json(await ai.status());
});

// "Ayu's read": streams plain text. If generation fails after streaming has
// started, the connection is destroyed so the gateway knows not to cache it.
app.post("/insight", async (req, res) => {
  const { result } = req.body || {};
  if (!result || !result.age || !result.health || !result.lifespan) {
    return res.status(400).json({ error: "result is required" });
  }
  const controller = new AbortController();
  res.on("close", () => { if (!res.writableEnded) controller.abort(); });
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  try {
    await ai.streamInsight(ai.buildPrompt(result), (chunk) => res.write(chunk), controller.signal);
    res.end();
  } catch (e) {
    console.error("Insight failed:", e.message);
    if (!res.headersSent) return res.status(502).end("The AI insight could not be completed.");
    res.destroy(e); // mid-stream failure: abort so the gateway does not cache partial text
  }
});

// AI's own lifespan guess from raw answers only. 502 if the model's answer is invalid twice.
app.post("/guess", async (req, res, next) => {
  const { input, result } = req.body || {};
  if (!input || !input.health || !result || !result.age) {
    return res.status(400).json({ error: "input and result are required" });
  }
  const controller = new AbortController();
  res.on("close", () => { if (!res.writableEnded) controller.abort(); });
  try {
    const guess = await ai.guessLifespan(ai.buildGuessPrompt(input, result), result.age.decimalYears, controller.signal);
    if (!guess) return res.status(502).json({ error: "The AI couldn't make a sensible guess this time." });
    res.json(guess);
  } catch (e) {
    next(e);
  }
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Something went wrong." : err.message });
});

if (require.main === module) {
  app.listen(port, () => console.log(`ai-svc running on port ${port} (model ${ai.MODEL})`));
}

module.exports = { app };
