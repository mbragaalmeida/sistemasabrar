import pg from 'pg';
const { Pool, types } = pg;

// Garante parsing numérico idêntico ao SQLite (evita strings em COUNT e NUMERIC)
types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10)));
types.setTypeParser(1700, val => (val === null ? null : parseFloat(val)));

// String oficial do Supabase (Transaction Pooler - IPv4 compatível com Vercel Serverless)
const DEFAULT_SUPABASE_URL = 'postgresql://postgres.uubxdjhvzrzlgxgcqfoh:Sistem%40s%40br%40r2026@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;

console.log('[Database] Conectando diretamente ao Supabase PostgreSQL via Pool nativo...');

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('[Database Pool Error]', err.message);
});

// Converte parâmetros ? para $1, $2 (respeitando strings literais com '?')
export function translateSql(sql) {
  let paramIndex = 0;
  let inString = false;
  let result = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      if (inString && sql[i + 1] === "'") {
        result += "''";
        i++;
        continue;
      }
      inString = !inString;
      result += char;
    } else if (char === '?' && !inString) {
      result += `$${++paramIndex}`;
    } else {
      result += char;
    }
  }

  // Converte LIKE para ILIKE no PostgreSQL para garantir busca sem distinção de maiúsculas/minúsculas
  result = result.replace(/\bLIKE\b/g, 'ILIKE');

  // Traduz funções de data específicas do SQLite para PostgreSQL
  result = result.replace(/strftime\s*\(\s*'%Y-%m'\s*,\s*([^)]+)\)/gi, "TO_CHAR($1, 'YYYY-MM')");
  result = result.replace(/strftime\s*\(\s*'%Y-%m-%d'\s*,\s*([^)]+)\)/gi, "TO_CHAR($1, 'YYYY-MM-DD')");
  result = result.replace(/date\s*\(\s*'now'\s*,\s*'-(\d+)\s*days?'\s*\)/gi, "CURRENT_DATE - INTERVAL '$1 days'");
  result = result.replace(/date\s*\(\s*'now'\s*\)/gi, "CURRENT_DATE");

  return result;
}

// Adaptador compatível com a interface do DatabaseSync / SQLite (modo assíncrono padrão Node.js)
export const db = {
  prepare(sql) {
    const trimmed = sql.trim();
    if (trimmed.toUpperCase().startsWith('PRAGMA')) {
      return {
        all: async () => [],
        get: async () => undefined,
        run: async () => ({ changes: 0, lastInsertRowid: 0 })
      };
    }

    const isInsert = /^\s*INSERT\s+INTO/i.test(trimmed);
    let finalSql = translateSql(trimmed);
    if (isInsert && !/RETURNING/i.test(finalSql)) {
      finalSql += ' RETURNING id';
    }

    return {
      async all(...params) {
        const flatParams = params.flat();
        const res = await pool.query(finalSql, flatParams);
        return res.rows;
      },
      async get(...params) {
        const flatParams = params.flat();
        const res = await pool.query(finalSql, flatParams);
        return res.rows[0];
      },
      async run(...params) {
        const flatParams = params.flat();
        const res = await pool.query(finalSql, flatParams);
        const lastInsertRowid = res.rows && res.rows[0] ? res.rows[0].id : null;
        return {
          changes: res.rowCount,
          lastInsertRowid
        };
      }
    };
  },
  async query(sql, params = []) {
    return pool.query(translateSql(sql), params.flat());
  },
  async exec(sql) {
    if (sql.trim().toUpperCase().startsWith('PRAGMA')) return;
    return pool.query(sql);
  }
};

console.log('[Database] Adaptador Supabase PostgreSQL Pool nativo pronto para uso.');
