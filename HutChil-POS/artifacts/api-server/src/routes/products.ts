import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireOwner, auditLog } from "../middleware/auth";

const router = Router();

router.get("/products", requireAuth, (_req, res) => {
  const products = db.prepare("SELECT * FROM products ORDER BY display_order ASC, id ASC").all();
  res.json(products);
});

router.post("/products", requireOwner, (req, res) => {
  const { name, price, unit, qty, min_stock, cost_per_unit } = req.body ?? {};
  if (!name || price === undefined) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }
  const now = new Date().toISOString();
  const maxOrder = (db.prepare("SELECT MAX(display_order) as m FROM products").get() as any)?.m ?? 0;
  const result = db.prepare(
    "INSERT INTO products (name,price,unit,qty,min_stock,cost_per_unit,display_order,updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run(name, price, unit ?? "ขวด", qty ?? 0, min_stock ?? 10, cost_per_unit ?? null, maxOrder + 10, now) as any;
  const product = db.prepare("SELECT * FROM products WHERE id=?").get(result.lastInsertRowid);
  auditLog((req as any).user.id, "create", "product", result.lastInsertRowid, `เพิ่มสินค้า ${name}`);
  res.status(201).json(product);
});

router.put("/products/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const old = db.prepare("SELECT * FROM products WHERE id=?").get(id) as any;
  if (!old) { res.status(404).json({ error: "ไม่พบ" }); return; }
  const { name, price, unit, qty, min_stock, cost_per_unit } = req.body ?? {};
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE products SET name=?,price=?,unit=?,qty=?,min_stock=?,cost_per_unit=?,updated_at=? WHERE id=?"
  ).run(
    name ?? old.name, price ?? old.price, unit ?? old.unit,
    qty !== undefined ? qty : old.qty,
    min_stock !== undefined ? min_stock : old.min_stock,
    cost_per_unit !== undefined ? cost_per_unit : old.cost_per_unit,
    now, id
  );
  const updated = db.prepare("SELECT * FROM products WHERE id=?").get(id);
  auditLog((req as any).user.id, "update", "product", id, `แก้ไขสินค้า ${old.name}`);
  res.json(updated);
});

router.delete("/products/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const product = db.prepare("SELECT * FROM products WHERE id=?").get(id) as any;
  if (!product) { res.status(404).json({ error: "ไม่พบ" }); return; }
  db.prepare("DELETE FROM products WHERE id=?").run(id);
  auditLog((req as any).user.id, "delete", "product", id, `ลบสินค้า ${product.name}`);
  res.status(204).send();
});

router.post("/products/:id/adjust", requireAuth, (req, res) => {
  const id = Number(req.params["id"]);
  const { qty_change, reason } = req.body ?? {};
  if (qty_change === undefined || !reason) {
    res.status(400).json({ error: "กรุณาระบุจำนวนและเหตุผล" });
    return;
  }
  const product = db.prepare("SELECT * FROM products WHERE id=?").get(id) as any;
  if (!product) { res.status(404).json({ error: "ไม่พบ" }); return; }
  const now = new Date().toISOString();
  db.prepare("UPDATE products SET qty=qty+?,updated_at=? WHERE id=?").run(qty_change, now, id);
  db.prepare(
    "INSERT INTO stock_logs (product_id,qty_change,reason,type,user_id,time) VALUES (?,?,?,?,?,?)"
  ).run(id, qty_change, reason, qty_change > 0 ? "add" : "deduct", (req as any).user.id, now);
  const updated = db.prepare("SELECT * FROM products WHERE id=?").get(id);
  auditLog((req as any).user.id, qty_change > 0 ? "create" : "update", "stock", id,
    `ปรับสต็อก ${product.name} ${qty_change > 0 ? "+" : ""}${qty_change} (${reason})`);
  res.json(updated);
});

export default router;
