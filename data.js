const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();

// ---------- CORS ----------
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000' ;
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));


app.use(express.json());

// ---------- DB pool (supports DATABASE_URL or individual env vars) ----------
let pool;

try {
  // decide sslOptions based on env
  let sslOptions = undefined;

  if (process.env.DB_SSL === "true") {
    // DEV-FRIENDLY: allow self-signed chain
    // For strict production, replace with CA file + rejectUnauthorized: true
    const certPath = path.resolve(__dirname, "certs", "aiven-ca.pem");
    if (fs.existsSync(certPath)) {
      sslOptions = {
        ca: fs.readFileSync(certPath),
        rejectUnauthorized: false, // allow self-signed in chain
      };
      console.log("🔐 Using Aiven CA certificate for SSL (relaxed verification)");
    } else {
      sslOptions = {
        rejectUnauthorized: false, // no CA file, but still use TLS without strict verify
      };
      console.log("🔐 Using SSL with relaxed verification (no CA file found)");
    }
  } else {
    console.log("🔓 DB_SSL is false or not set, connecting without SSL");
  }

  if (process.env.DATABASE_URL) {
    const dbUrl = new URL(process.env.DATABASE_URL);
    pool = mysql.createPool({
      host: dbUrl.hostname,
      port: dbUrl.port ? Number(dbUrl.port) : 3306,
      user: decodeURIComponent(dbUrl.username),
      password: decodeURIComponent(dbUrl.password),
      database: dbUrl.pathname.replace("/", ""),
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 50),
      ssl: sslOptions,
    });
  } else {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "root",
      database: process.env.DB_NAME || "material_request_promotion",
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 50),
      ssl: sslOptions,
    });
  }
} catch (err) {
  console.error("❌ Error creating DB pool:", err);
  process.exit(1);
}

// Test connection
pool
  .getConnection()
  .then((conn) => {
    console.log("✅ MySQL connected successfully!");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Failed to connect to MySQL:", err.message);
    process.exit(1);
  });

// ---------- Health check ----------
app.get("/healthz", (_, res) => res.send("ok"))
app.get("/hello-world", (req, res) => {
  res.json({ message: "Hello, World!" });
});
// to maintain docker versions
// tags: |
//   ${{ secrets.DOCKER_USERNAME }}/ci-cd-backend:latest
//   ${{ secrets.DOCKER_USERNAME }}/ci-cd-backend:${{ github.sha }}
//checking database-----------
app.get("/get-all-employees", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT *
      FROM employees
      ORDER BY created_at DESC
      `
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching employees:", err);
    res.status(500).json({ error: "Database error" });
  }
});
// ---------- START SERVER ----------
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));