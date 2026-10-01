const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Build connection configuration for PostgreSQL / Supabase
const createPoolConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    };
  }

  return {
    host: process.env.DB_HOST || 'db.vixyhbealdzxarmobvdk.supabase.co',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'postgres',
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  };
};

let pool;

async function initializeDatabase() {
  console.log('🔍 Initializing PostgreSQL database connection...');

  try {
    const poolConfig = createPoolConfig();
    const hostInfo = poolConfig.connectionString
      ? 'DATABASE_URL'
      : `${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`;

    console.log(`☁️ Connecting to PostgreSQL: ${hostInfo}...`);
    pool = new Pool(poolConfig);

    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT current_database() as db, version() as version');
    client.release();

    console.log(`✅ Connected to PostgreSQL database [${result.rows[0]?.db}] successfully!`);
  } catch (err) {
    console.error('❌ PostgreSQL database connection error:', err.message);
  }
}

// Start initialization
initializeDatabase();

// Helper to ensure pool is initialized
const ensurePool = async () => {
  if (pool) return pool;
  let attempts = 0;
  while (!pool && attempts < 10) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    attempts++;
  }
  if (!pool) throw new Error('PostgreSQL database pool not initialized');
  return pool;
};

/**
 * Translate MySQL-flavored SQL to PostgreSQL-compatible SQL
 * and convert '?' parameter placeholders to '$1, $2, ...'
 */
function translateQuery(sql, params = []) {
  let text = sql;
  let flattenedParams = [];

  // 1. MySQL dialect replacements
  // IFNULL -> COALESCE
  text = text.replace(/\bIFNULL\b/gi, 'COALESCE');

  // CAST(accession_number AS UNSIGNED) or similar
  text = text.replace(
    /CAST\s*\(\s*([a-zA-Z0-9_.]+)\s+AS\s+UNSIGNED\s*\)/gi,
    `(CASE WHEN $1 ~ '^\\d+$' THEN $1::BIGINT ELSE NULL END)`
  );

  // DATE_FORMAT(expr, '%b %Y') -> TO_CHAR(expr, 'Mon YYYY')
  text = text.replace(/DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%b %Y'\s*\)/gi, "TO_CHAR($1, 'Mon YYYY')");
  text = text.replace(/DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%Y-%m-%d'\s*\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')");

  // DATEDIFF(a, b) -> (DATE(a) - DATE(b))
  text = text.replace(/DATEDIFF\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, '(DATE($1) - DATE($2))');

  // DATE_SUB(expr, INTERVAL ? DAY)
  // DATE_SUB(expr, INTERVAL n DAY/MONTH) -> (expr - INTERVAL 'n DAY/MONTH')
  text = text.replace(/DATE_SUB\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+([0-9]+)\s+DAY\s*\)/gi, "($1 - INTERVAL '$2 DAY')");
  text = text.replace(/DATE_SUB\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+([0-9]+)\s+MONTH\s*\)/gi, "($1 - INTERVAL '$2 MONTH')");
  text = text.replace(/DATE_ADD\s*\(\s*([^,]+)\s*,\s*INTERVAL\s+([0-9]+)\s+DAY\s*\)/gi, "($1 + INTERVAL '$2 DAY')");

  // SHOW TABLES
  if (/^\s*SHOW\s+TABLES\s*$/i.test(text.trim())) {
    text = "SELECT table_name as Tables_in_db FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
  }

  // SHOW COLUMNS FROM table
  const showColsMatch = text.match(/^\s*SHOW\s+COLUMNS\s+FROM\s+([a-zA-Z0-9_]+)\s*$/i);
  if (showColsMatch) {
    const tableName = showColsMatch[1];
    text = `SELECT column_name as "Field", data_type as "Type", is_nullable as "Null" FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}'`;
  }

  // OPTIMIZE TABLE table -> VACUUM ANALYZE table
  text = text.replace(/^\s*OPTIMIZE\s+TABLE\s+([a-zA-Z0-9_]+)\s*$/i, 'VACUUM ANALYZE $1');

  // Information schema database() check
  text = text.replace(/table_schema\s*=\s*DATABASE\(\)/gi, "table_schema = 'public'");

  // Auto-append RETURNING id for INSERT queries if not already present
  const isInsert = /^\s*INSERT\s+INTO\s+/i.test(text);
  if (isInsert && !/\bRETURNING\b/i.test(text)) {
    text = text.trim().replace(/;?\s*$/, '') + ' RETURNING id';
  }

  // 2. Placeholder replacement (? -> $1, $2, ...)
  let paramIndex = 1;
  let newSql = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let paramPointer = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';

    if (char === "'" && prevChar !== '\\') {
      inSingleQuote = !inSingleQuote;
      newSql += char;
    } else if (char === '"' && prevChar !== '\\') {
      inDoubleQuote = !inDoubleQuote;
      newSql += char;
    } else if (char === '?' && !inSingleQuote && !inDoubleQuote) {
      const currentParam = params[paramPointer];
      paramPointer++;

      // If parameter is an Array and query uses IN (?), expand to ($1, $2, ...)
      if (Array.isArray(currentParam)) {
        if (currentParam.length === 0) {
          newSql += 'NULL';
        } else {
          const placeholders = [];
          for (const item of currentParam) {
            placeholders.push(`$${paramIndex++}`);
            flattenedParams.push(item);
          }
          newSql += placeholders.join(', ');
        }
      } else {
        newSql += `$${paramIndex++}`;
        flattenedParams.push(currentParam);
      }
    } else {
      newSql += char;
    }
  }

  // If there are remaining unexpanded parameters
  while (paramPointer < params.length) {
    flattenedParams.push(params[paramPointer++]);
  }

  return { text: newSql, params: flattenedParams };
}

/**
 * Format query result to be compatible with both MySQL and PostgreSQL return formats
 */
function formatResult(pgResult) {
  const rows = pgResult.rows || [];

  // Attach metadata properties
  const insertId = rows[0]?.id ? parseInt(rows[0].id, 10) : null;
  const affectedRows = pgResult.rowCount || 0;

  rows.insertId = insertId;
  rows.affectedRows = affectedRows;
  rows.rowCount = affectedRows;

  return rows;
}

/**
 * Helper function to execute queries
 */
const query = async (sql, params = []) => {
  try {
    const activePool = await ensurePool();
    const translated = translateQuery(sql, params);
    const result = await activePool.query(translated.text, translated.params);
    return formatResult(result);
  } catch (error) {
    console.error('Database query error:', error.message, '\nSQL:', sql);
    throw error;
  }
};

/**
 * Helper function to get a single row
 */
const queryOne = async (sql, params = []) => {
  const results = await query(sql, params);
  return results[0] || null;
};

/**
 * Helper function to begin transaction
 */
const beginTransaction = async () => {
  const activePool = await ensurePool();
  const client = await activePool.connect();
  await client.query('BEGIN');

  return {
    client,
    query: async (sql, params = []) => {
      const translated = translateQuery(sql, params);
      const res = await client.query(translated.text, translated.params);
      return [formatResult(res)];
    },
    execute: async (sql, params = []) => {
      const translated = translateQuery(sql, params);
      const res = await client.query(translated.text, translated.params);
      return [formatResult(res)];
    },
    commit: async function () {
      await commit(this);
    },
    rollback: async function () {
      await rollback(this);
    }
  };
};

/**
 * Helper function to commit transaction
 */
const commit = async (txConnection) => {
  if (txConnection && txConnection.client) {
    try {
      await txConnection.client.query('COMMIT');
    } finally {
      txConnection.client.release();
    }
  }
};

/**
 * Helper function to rollback transaction
 */
const rollback = async (txConnection) => {
  if (txConnection && txConnection.client) {
    try {
      await txConnection.client.query('ROLLBACK');
    } finally {
      txConnection.client.release();
    }
  }
};

module.exports = {
  getPool: () => pool,
  query,
  queryOne,
  beginTransaction,
  commit,
  rollback
};
