import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireOwner, auditLog } from "../middleware/auth";

const router = Router();

function enrichPromo(p: any) {
  if (!p) return p;
  const product = db.prepare("SELECT name FROM products WHERE id=?").get(p.product_id) as any;
  return { ...p, active: Boolean(p.active), product_name: product?.name ?? null };
}

router.get("/promotions", requireAuth, (_req, res) => {
  const promos = db.prepare("SELECT * FROM promotions ORDER BY id").all().map(enrichPromo);
  res.json(promos);
});

router.post("/promotions", requireOwner, (req, res) => {
  const { name, product_id, bundle_qty, bundle_price, active } = req.body ?? {};
  if (!name || !product_id || !bundle_qty || !bundle_price) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }
  const result = db.prepare(
    "INSERT INTO promotions (name,product_id,bundle_qty,bundle_price,active) VALUES (?,?,?,?,?)"
  ).run(name, product_id, bundle_qty, bundle_price, active !== false ? 1 : 0) as any;
  const promo = enrichPromo(db.prepare("SELECT * FROM promotions WHERE id=?").get(result.lastInsertRowid));
  auditLog((req as any).user.id, "create", "promotion", result.lastInsertRowid, `เพิ่มโปรโมชั่น ${name}`);
  res.status(201).json(promo);
});

router.put("/promotions/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const old = db.prepare("SELECT * FROM promotions WHERE id=?").get(id) as any;
  if (!old) { res.status(404).json({ error: "ไม่พบ" }); return; }
  const { name, product_id, bundle_qty, bundle_price, active } = req.body ?? {};
  db.prepare(
    "UPDATE promotions SET name=?,product_id=?,bundle_qty=?,bundle_price=?,active=? WHERE id=?"
  ).run(
    name ?? old.name, product_id ?? old.product_id,
    bundle_qty ?? old.bundle_qty, bundle_price ?? old.bundle_price,
    active !== undefined ? (active ? 1 : 0) : old.active, id
  );
  auditLog((req as any).user.id, "update", "promotion", id, `แก้ไขโปรโมชั่น ${name ?? old.name}`);
  res.json(enrichPromo(db.prepare("SELECT * FROM promotions WHERE id=?").get(id)));
});

router.delete("/promotions/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const promo = db.prepare("SELECT * FROM promotions WHERE id=?").get(id) as any;
  if (!promo) { res.status(404).json({ error: "ไม่พบ" }); return; }
  db.prepare("DELETE FROM promotions WHERE id=?").run(id);
  auditLog((req as any).user.id, "delete", "promotion", id, `ลบโปรโมชั่น ${promo.name}`);
  res.status(204).send();
});

export default router;
