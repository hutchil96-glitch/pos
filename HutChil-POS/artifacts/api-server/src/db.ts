import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env["DB_PATH"] ?? path.resolve(__dirname, "../hutchil.db");

export const db = new DatabaseSync(DB_PATH);

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      daily_wage REAL,
      shift TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'ขวด',
      qty INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER DEFAULT 10,
      cost_per_unit REAL,
      display_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      bundle_qty INTEGER NOT NULL,
      bundle_price REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      shift_type TEXT NOT NULL,
      check_in_time TEXT NOT NULL,
      close_time TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      cash_count REAL,
      account_total REAL,
      system_cash REAL,
      system_transfer REAL,
      system_total REAL,
      net_total REAL,
      difference REAL,
      photos TEXT,
      brewing_product_id INTEGER,
      brewing_qty INTEGER
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      shift_id INTEGER REFERENCES shifts(id),
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      total REAL NOT NULL,
      payment_type TEXT NOT NULL DEFAULT 'เงินสด',
      is_gift INTEGER NOT NULL DEFAULT 0,
      slip_photo TEXT,
      note TEXT,
      promo_id INTEGER REFERENCES promotions(id),
      time TEXT NOT NULL,
      locked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS brewing_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_id INTEGER NOT NULL REFERENCES shifts(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL,
      time TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stock_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty_change INTEGER NOT NULL,
      reason TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'adjust',
      user_id INTEGER REFERENCES users(id),
      time TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty INTEGER NOT NULL,
      cost_per_unit REAL NOT NULL,
      total_cost REAL NOT NULL,
      supplier TEXT,
      date TEXT NOT NULL,
      note TEXT,
      user_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_costs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      cigarettes REAL,
      medicine REAL,
      six9 REAL,
      rent REAL,
      gas REAL,
      mix REAL,
      cannabis REAL,
      utilities REAL,
      bottles REAL,
      wages REAL,
      ice REAL,
      other REAL,
      total REAL,
      note TEXT,
      user_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      type TEXT NOT NULL,
      note TEXT,
      date TEXT NOT NULL,
      status TEXT DEFAULT 'approved'
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id INTEGER,
      old_value TEXT,
      new_value TEXT,
      description TEXT,
      time TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sheets_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      spreadsheet_id TEXT,
      service_account_json TEXT,
      auto_sync INTEGER NOT NULL DEFAULT 0,
      last_sync TEXT
    );
  `);

  // Migration: add display_order to existing databases
  try {
    db.exec("ALTER TABLE products ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0");
    db.exec("UPDATE products SET display_order = id * 10");
    logger.info("Migration: added display_order column to products");
  } catch (_) {
    // Column already exists — skip
  }

  const existingOwner = db.prepare("SELECT id FROM users WHERE username = ?").get("owner");
  if (!existingOwner) {
    const ownerHash = bcrypt.hashSync("owner1234", 10);
    const empHash = bcrypt.hashSync("emp1234", 10);
    db.prepare("INSERT INTO users (name, username, password_hash, role, daily_wage, shift) VALUES (?,?,?,?,?,?)").run(
      "เจ้าของร้าน", "owner", ownerHash, "owner", 0, null
    );
    db.prepare("INSERT INTO users (name, username, password_hash, role, daily_wage, shift) VALUES (?,?,?,?,?,?)").run(
      "พนักงาน 1", "emp1", empHash, "employee", 300, "เช้า"
    );

    const products: [string, number, string, number, number, number][] = [
      ["น้ำกระท่อม 60ml", 20, "ขวด", 50, 10, 8],
      ["น้ำกระท่อม 100ml", 30, "ขวด", 40, 10, 12],
      ["น้ำกระท่อม 160ml", 45, "ขวด", 30, 10, 18],
      ["น้ำกระท่อม 220ml", 60, "ขวด", 20, 10, 25],
      ["กัญชา", 200, "กรัม", 15, 5, 80],
      ["ของแถม", 0, "ชิ้น", 100, 20, 0],
    ];
    const insertProduct = db.prepare(
      "INSERT INTO products (name, price, unit, qty, min_stock, cost_per_unit) VALUES (?,?,?,?,?,?)"
    );
    for (const p of products) {
      insertProduct.run(...p);
    }

    db.prepare("INSERT OR IGNORE INTO sheets_settings (id, auto_sync) VALUES (1, 0)").run();
    logger.info("Database seeded with initial data");
  }
}
