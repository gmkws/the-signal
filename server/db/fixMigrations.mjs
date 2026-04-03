/**
 * Manually registers migrations 0007 and 0008 as applied in the __drizzle_migrations table.
 * This is needed because the tables were created directly (bypassing the migrator)
 * due to TiDB's restriction on TEXT column defaults.
 */
import mysql2 from 'mysql2/promise';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const conn = await mysql2.createConnection(process.env.DATABASE_URL);

// Get currently applied migration hashes
const [applied] = await conn.execute('SELECT hash FROM __drizzle_migrations');
const appliedHashes = new Set(applied.map(r => r.hash));
console.log('Currently applied migrations:', appliedHashes.size);

// Compute hashes for migration files (drizzle uses sha256 of file content)
const migrations = [
  { file: './drizzle/0007_military_thaddeus_ross.sql' },
  { file: './drizzle/0008_worthless_butterfly.sql' },
];

for (const m of migrations) {
  const content = readFileSync(m.file, 'utf8');
  const hash = createHash('sha256').update(content).digest('hex');
  
  if (appliedHashes.has(hash)) {
    console.log(`${m.file}: already registered (hash: ${hash.slice(0, 16)}...)`);
  } else {
    await conn.execute(
      'INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)',
      [hash, Date.now()]
    );
    console.log(`${m.file}: registered (hash: ${hash.slice(0, 16)}...)`);
  }
}

await conn.end();
console.log('Migration registration complete');
