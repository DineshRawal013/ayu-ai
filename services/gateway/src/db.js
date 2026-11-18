// Postgres: anonymous result history. Each saved result gets a UUID that
// works as a shareable link (/?r=<id>).

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
});

let ready = false;

async function init(retries = 30) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS results (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
          input       JSONB NOT NULL,
          result      JSONB NOT NULL,
          insight     TEXT,
          insight_at  TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS results_created_at_idx ON results (created_at DESC);
        ALTER TABLE results ADD COLUMN IF NOT EXISTS ai_guess JSONB;
      `);
      ready = true;
      console.log("Database ready");
      return;
    } catch (err) {
      console.log(`Waiting for database (${i}/${retries}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error("Database not reachable; results will not be saved.");
}

async function saveResult(input, result) {
  if (!ready) return null;
  const { rows } = await pool.query(
    "INSERT INTO results (input, result) VALUES ($1, $2) RETURNING id",
    [input, result]
  );
  return rows[0].id;
}

async function getResult(id) {
  if (!ready) return null;
  const { rows } = await pool.query(
    "SELECT id, created_at, input, result, insight, ai_guess FROM results WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

async function saveInsight(id, text) {
  if (!ready) return;
  await pool.query("UPDATE results SET insight = $2, insight_at = now() WHERE id = $1", [id, text]);
}

async function saveGuess(id, guess) {
  if (!ready) return;
  await pool.query("UPDATE results SET ai_guess = $2 WHERE id = $1", [id, guess]);
}

async function ping() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

module.exports = { init, saveResult, getResult, saveInsight, saveGuess, ping, isReady: () => ready };
