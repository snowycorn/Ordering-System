const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
pool.connect((err, client, release) => {
  if (err) console.error("DB failed:", err.message);
  else { console.log("DB connected: recommendation"); release(); }
});
module.exports = pool;
