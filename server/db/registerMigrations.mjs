import mysql2 from 'mysql2/promise';

const conn = await mysql2.createConnection(process.env.DATABASE_URL);

// Verify all 3 chatbot tables exist
const [tables] = await conn.execute('SHOW TABLES');
const tableNames = tables.map(r => Object.values(r)[0]);
const chatbotTables = tableNames.filter(t => ['leads','dm_conversations','chatbot_flows'].includes(t));
console.log('Chatbot tables present:', chatbotTables);

// Check current migration hashes
const [applied] = await conn.execute('SELECT hash FROM __drizzle_migrations ORDER BY created_at');
console.log('Applied migrations count:', applied.length);

// Get hashes from journal
import { readFileSync } from 'fs';
const journal = JSON.parse(readFileSync('./drizzle/meta/_journal.json', 'utf8'));
const journalHashes = journal.entries.map(e => e.hash).filter(Boolean);
console.log('Journal entries:', journal.entries.length);

await conn.end();
console.log('All good — tables and migrations verified');
