import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { TestProject } from "vitest/node";
import { ADMIN_URL } from "./config";

const root = path.resolve(__dirname, "..");
const sql = (file: string) => readFileSync(path.join(root, file), "utf8");

// Database baru per run: shim Supabase → semua migration (urut nama) → seed.
export default async function setup(project: TestProject) {
  const dbName = `th_test_${randomBytes(6).toString("hex")}`;
  const admin = new Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${dbName}`;
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    await db.query("set client_min_messages = error");
    await db.query(sql("tests/shim.sql"));
    for (const f of readdirSync(path.join(root, "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
      await db.query(sql(`migrations/${f}`));
    }
    await db.query(sql("seed.sql"));
  } finally {
    await db.end();
  }
  project.provide("dbUrl", url.toString());

  return async () => {
    const c = new Client({ connectionString: ADMIN_URL });
    await c.connect();
    await c.query(`drop database if exists ${dbName} with (force)`);
    await c.end();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    dbUrl: string;
  }
}
