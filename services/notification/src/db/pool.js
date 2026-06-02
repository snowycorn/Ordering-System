const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
pool.connect((err, client, release) => {
  if (err) console.error("❌ Notification DB failed:", err.message);
  else { console.log("✅ Notification DB connected"); release(); }
});
module.exports = pool;
