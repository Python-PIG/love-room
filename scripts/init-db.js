const { db, config, closeDb } = require("../src/db");

db.prepare("SELECT 1").get();
console.log(`SQLite database initialized at ${config.dbPath}`);
closeDb();
