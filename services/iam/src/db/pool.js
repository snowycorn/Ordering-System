const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect((err, client, release) => {
  if (err) console.error("❌ IAM DB connection failed:", err.message);
  else { console.log("✅ IAM DB connected"); release(); }
});

module.exports = pool;
