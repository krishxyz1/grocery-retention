// Runs the SQL in /sql against a local DuckDB file and writes each analysis result
// to site/src/data/<name>.json for the report site.
//
//   npm run analyze             -> analyses only (reuses data/instacart.duckdb)
//   npm run analyze -- --rebuild -> reload CSVs and rebuild modelled tables first
//
// Files named 0x_*.sql are setup (load + model). Every other file is an analysis:
// its statements run in order and the result of the last one is exported.
import fs from 'node:fs';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';

const SQL_DIR = 'sql';
const OUT_DIR = path.join('site', 'src', 'data');
const DB_PATH = path.join('data', 'instacart.duckdb');
const rebuild = process.argv.includes('--rebuild') || !fs.existsSync(DB_PATH);

const toPlain = (v) => {
  if (typeof v === 'bigint') return Number(v);
  if (Array.isArray(v)) return v.map(toPlain);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toPlain(x)]));
  }
  if (typeof v === 'number' && !Number.isInteger(v)) return Math.round(v * 10000) / 10000;
  return v;
};

async function runFile(conn, file) {
  const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
  const statements = await conn.extractStatements(sql);
  let last;
  for (let i = 0; i < statements.count; i++) {
    const prepared = await statements.prepare(i);
    last = await prepared.runAndReadAll();
  }
  return last;
}

const db = await DuckDBInstance.create(DB_PATH);
const conn = await db.connect();
fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort();
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

for (const file of files) {
  const isSetup = /^0\d_/.test(file);
  if (isSetup && !rebuild) continue;
  if (!isSetup && only.length && !only.some((o) => file.includes(o))) continue;

  const t0 = Date.now();
  const result = await runFile(conn, file);
  const ms = Date.now() - t0;

  if (isSetup) {
    console.log(`setup     ${file.padEnd(32)} ${ms} ms`);
    continue;
  }
  const rows = result.getRowObjectsJS().map(toPlain);
  const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(rows, null, 1));
  console.log(`analysis  ${file.padEnd(32)} ${String(rows.length).padStart(5)} rows  ${ms} ms`);
}

conn.closeSync();
