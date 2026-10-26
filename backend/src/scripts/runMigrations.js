import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pool from '../config/db.js';

const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url).pathname;

async function ensureMigrationsTable(conn) {
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB;`);
}

async function run() {
  const files = (await readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort();
  const conn = await pool.getConnection();
  try {
    await ensureMigrationsTable(conn);
    const [applied] = await conn.query('SELECT filename FROM schema_migrations');
    const done = new Set(applied.map(r => r.filename));
    for (const f of files) {
      if (done.has(f)) { console.log('skip', f); continue; }
      console.log('apply', f);
      const sql = await readFile(join(MIGRATIONS_DIR, f), 'utf8');
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [f]);
    }
    console.log('Migrations complete.');
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
