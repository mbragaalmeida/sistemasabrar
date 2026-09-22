import { Worker, isMainThread } from 'node:worker_threads';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// String oficial do Supabase (Transaction Pooler - IPv4 compatível com Vercel Serverless)
const DEFAULT_SUPABASE_URL = 'postgresql://postgres.uubxdjhvzrzlgxgcqfoh:Sistem%40s%40br%40r2026@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

const DATABASE_URL = process.env.DATABASE_URL || DEFAULT_SUPABASE_URL;

console.log('[Database] Inicializando camada de dados com Supabase PostgreSQL...');

// Código executado na Worker Thread dedicada para permitir consultas síncronas de alta performance
const workerCode = `
  import { parentPort, workerData } from 'node:worker_threads';
  import pg from 'pg';
  const { Pool, types } = pg;

  // Garante parsing numérico idêntico ao SQLite (evita strings em COUNT e NUMERIC)
  types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10)));
  types.setTypeParser(1700, val => (val === null ? null : parseFloat(val)));

  const pool = new Pool({
    connectionString: workerData.connectionString,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  parentPort.on('message', async ({ sql, params, buffer }) => {
    const int32View = new Int32Array(buffer);
    try {
      const res = await pool.query(sql, params);
      const payload = {
        rows: res.rows || [],
        rowCount: res.rowCount || 0
      };
      const jsonStr = JSON.stringify(payload);
      const encoded = new TextEncoder().encode(jsonStr);

      int32View[1] = encoded.length;
      int32View[2] = 0; // 0 = sucesso
      const u8View = new Uint8Array(buffer, 16);
      u8View.set(encoded);

      Atomics.store(int32View, 0, 1);
      Atomics.notify(int32View, 0, 1);
    } catch (err) {
      const jsonStr = JSON.stringify({ error: err.message });
      const encoded = new TextEncoder().encode(jsonStr);

      int32View[1] = encoded.length;
      int32View[2] = 1; // 1 = erro
      const u8View = new Uint8Array(buffer, 16);
      u8View.set(encoded);

      Atomics.store(int32View, 0, 1);
      Atomics.notify(int32View, 0, 1);
    }
  });
`;

let worker = null;
let sharedBuffer = null;
let int32View = null;

function getWorker() {
  if (!worker) {
    sharedBuffer = new SharedArrayBuffer(16 * 1024 * 1024); // 16 MB buffer
    int32View = new Int32Array(sharedBuffer);
    worker = new Worker(workerCode, {
      eval: true,
      workerData: { connectionString: DATABASE_URL }
    });
    worker.on('error', (err) => {
      console.error('[DB Worker Error]', err);
      worker = null;
    });
    worker.on('exit', (code) => {
      if (code !== 0) console.warn('[DB Worker Exited with code]', code);
      worker = null;
    });
  }
  return { worker, sharedBuffer, int32View };
}

function syncQuery(sql, params = []) {
  const { worker, sharedBuffer, int32View } = getWorker();
  Atomics.store(int32View, 0, 0);
  worker.postMessage({ sql, params, buffer: sharedBuffer });

  const waitResult = Atomics.wait(int32View, 0, 0, 20000); // 20s timeout
  if (waitResult === 'timed-out') {
    throw new Error('Database query timed out: ' + sql.substring(0, 100));
  }

  const length = int32View[1];
  const isError = int32View[2] === 1;
  const bytes = new Uint8Array(sharedBuffer, 16, length);
  const jsonStr = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(jsonStr);

  if (isError) {
    throw new Error(parsed.error);
  }
  return parsed;
}

// Converte parâmetros ? para $1, $2 (respeitando strings literais com '?')
function translateSql(sql) {
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

  return result;
}

// Adaptador compatível com a interface do DatabaseSync / SQLite
export const db = {
  prepare(sql) {
    const trimmed = sql.trim();
    if (trimmed.toUpperCase().startsWith('PRAGMA')) {
      return {
        all: () => [],
        get: () => undefined,
        run: () => ({ changes: 0, lastInsertRowid: 0 })
      };
    }

    const isInsert = /^\s*INSERT\s+INTO/i.test(trimmed);
    let finalSql = translateSql(trimmed);
    if (isInsert && !/RETURNING/i.test(finalSql)) {
      finalSql += ' RETURNING id';
    }

    return {
      all(...params) {
        const flatParams = params.flat();
        const res = syncQuery(finalSql, flatParams);
        return res.rows;
      },
      get(...params) {
        const flatParams = params.flat();
        const res = syncQuery(finalSql, flatParams);
        return res.rows[0];
      },
      run(...params) {
        const flatParams = params.flat();
        const res = syncQuery(finalSql, flatParams);
        const lastInsertRowid = res.rows && res.rows[0] ? res.rows[0].id : null;
        return {
          changes: res.rowCount,
          lastInsertRowid
        };
      }
    };
  },
  exec(sql) {
    if (sql.trim().toUpperCase().startsWith('PRAGMA')) return;
    return syncQuery(sql);
  }
};

console.log('[Database] Adaptador Supabase PostgreSQL pronto para uso.');
