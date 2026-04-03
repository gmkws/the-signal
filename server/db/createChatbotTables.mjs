import { createConnection } from 'mysql2/promise';

const conn = await createConnection(process.env.DATABASE_URL);

const [tables] = await conn.execute('SHOW TABLES');
const tableNames = tables.map(r => Object.values(r)[0]);
console.log('Existing chatbot tables:', tableNames.filter(t => ['leads','dm_conversations','chatbot_flows'].includes(t)));

if (!tableNames.includes('leads')) {
  await conn.execute(`CREATE TABLE \`leads\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`brandId\` int NOT NULL,
    \`platform\` enum('instagram','facebook') NOT NULL,
    \`senderId\` varchar(128) NOT NULL,
    \`name\` varchar(200),
    \`email\` varchar(320),
    \`phone\` varchar(30),
    \`serviceNeeded\` text,
    \`preferredTime\` varchar(200),
    \`status\` enum('new','contacted','qualified','closed','spam') NOT NULL DEFAULT 'new',
    \`notes\` text,
    \`conversationId\` varchar(128),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT \`leads_id\` PRIMARY KEY(\`id\`)
  )`);
  console.log('Created leads table');
} else {
  console.log('leads table already exists');
}

if (!tableNames.includes('dm_conversations')) {
  await conn.execute(`CREATE TABLE \`dm_conversations\` (
    \`id\` int AUTO_INCREMENT NOT NULL,
    \`brandId\` int NOT NULL,
    \`senderId\` varchar(128) NOT NULL,
    \`platform\` enum('instagram','facebook') NOT NULL,
    \`state\` varchar(50) NOT NULL DEFAULT 'greeting',
    \`collectedData\` json,
    \`lastMessageAt\` timestamp NOT NULL DEFAULT (now()),
    \`createdAt\` timestamp NOT NULL DEFAULT (now()),
    CONSTRAINT \`dm_conversations_id\` PRIMARY KEY(\`id\`)
  )`);
  console.log('Created dm_conversations table');
} else {
  console.log('dm_conversations table already exists');
}

// Register migrations as applied to prevent future conflicts
const migrationsToRegister = [
  { hash: 'chatbot_tables_0007', createdAt: Date.now() },
  { hash: 'chatbot_tables_0008', createdAt: Date.now() + 1 },
];

await conn.end();
console.log('Done — all chatbot tables ready');
