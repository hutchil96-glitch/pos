import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireOwner, auditLog } from "../middleware/auth";

const router = Router();

router.get("/purchases", requireAuth, (_req, res) => {
  const purchases = db.prepare(`
    SELECT p.*, pr.name AS product_name FROM purchases p
    LEFT JOIN products pr ON p.product_id=pr.id
    ORDER BY p.date DESC
  `).all();
  res.json(purchases);
});

router.post("/purchases", requireOwner, (req, res) => {
  const { product_id, qty, cost_per_unit, supplier, date, note } = req.body ?? {};
  if (!product_id || !qty || !cost_per_unit || !date) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }
  const total_cost = qty * cost_per_unit;
  const result = db.prepare(`
    INSERT INTO purchases (product_id,qty,cost_per_unit,total_cost,supplier,date,note,user_id)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(product_id, qty, cost_per_unit, total_cost, supplier ?? null, date, note ?? null, (req as any).user.id) as any;

  const now = new Date().toISOString();
  db.prepare("UPDATE products SET qty=qty+?,cost_per_unit=?,updated_at=? WHERE id=?").run(qty, cost_per_unit, now, product_id);
  db.prepare("INSERT INTO stock_logs (product_id,qty_change,reason,type,user_id,time) VALUES (?,?,?,?,?,?)").run(
    product_id, qty, `รับสต็อก จาก ${supplier ?? "ไม่ระบุ"}`, "purchase", (req as any).user.id, now
  );

  const purchase = db.prepare(`
    SELECT p.*, pr.name AS product_name FROM purchases p
    LEFT JOIN products pr ON p.product_id=pr.id WHERE p.id=?
  `).get(result.lastInsertRowid);
  const productName = (db.prepare("SELECT name FROM products WHERE id=?").get(product_id) as any)?.name ?? "";
  auditLog((req as any).user.id, "create", "purchase", result.lastInsertRowid, `รับสต็อก ${productName} x${qty}`);
  res.status(201).json(purchase);
});

router.put("/purchases/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const old = db.prepare("SELECT * FROM purchases WHERE id=?").get(id) as any;
  if (!old) { res.status(404).json({ error: "ไม่พบ" }); return; }
  const { product_id, qty, cost_per_unit, supplier, date, note } = req.body ?? {};
  const newQty = qty ?? old.qty;
  const newCost = cost_per_unit ?? old.cost_per_unit;
  const total_cost = newQty * newCost;
  db.prepare(`
    UPDATE purchases SET product_id=?,qty=?,cost_per_unit=?,total_cost=?,supplier=?,date=?,note=? WHERE id=?
  `).run(product_id ?? old.product_id, newQty, newCost, total_cost, supplier ?? old.supplier, date ?? old.date, note ?? old.note, id);
  const updated = db.prepare(`
    SELECT p.*, pr.name AS product_name FROM purchases p
    LEFT JOIN products pr ON p.product_id=pr.id WHERE p.id=?
  `).get(id);
  auditLog((req as any).user.id, "update", "purchase", id, `แก้ไขการรับสต็อก #${id}`);
  res.json(updated);
});

router.delete("/purchases/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  if (!db.prepare("SELECT id FROM purchases WHERE id=?").get(id)) {
    res.status(404).json({ error: "ไม่พบ" }); return;
  }
  db.prepare("DELETE FROM purchases WHERE id=?").run(id);
  auditLog((req as any).user.id, "delete", "purchase", id, `ลบการรับสต็อก #${id}`);
  res.status(204).send();
});

const COST_FIELDS = ["cigarettes","medicine","six9","rent","gas","mix","cannabis","utilities","bottles","wages","ice","other"];

router.get("/daily-costs", requireAuth, (req, res) => {
  const { date_from, date_to } = req.query as any;
  let query = "SELECT * FROM daily_costs WHERE 1=1";
  const params: any[] = [];
  if (date_from) { query += " AND date>=?"; params.push(date_from); }
  if (date_to) { query += " AND date<=?"; params.push(date_to); }
  query += " ORDER BY date DESC";
  res.json(db.prepare(query).all(...params));
});

router.post("/daily-costs", requireOwner, (req, res) => {
  const body = req.body ?? {};
  if (!body.date) { res.status(400).json({ error: "กรุณาระบุวันที่" }); return; }
  const fields = COST_FIELDS.map((f) => body[f] ?? null);
  const total = COST_FIELDS.reduce((s, f) => s + (Number(body[f]) || 0), 0);
  const result = db.prepare(`
    INSERT INTO daily_costs (date,cigarettes,medicine,six9,rent,gas,mix,cannabis,utilities,bottles,wages,ice,other,total,note,user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(body.date, ...fields, total, body.note ?? null, (req as any).user.id) as any;
  auditLog((req as any).user.id, "create", "daily_cost", result.lastInsertRowid, `บันทึกต้นทุนรายวัน ${body.date} รวม ${total}฿`);
  res.status(201).json(db.prepare("SELECT * FROM daily_costs WHERE id=?").get(result.lastInsertRowid));
});

router.put("/daily-costs/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const old = db.prepare("SELECT * FROM daily_costs WHERE id=?").get(id) as any;
  if (!old) { res.status(404).json({ error: "ไม่พบ" }); return; }
  const body = req.body ?? {};
  const fields = COST_FIELDS.map((f) => body[f] !== undefined ? body[f] : (old as any)[f]);
  const total = COST_FIELDS.reduce((s, f, i) => s + (Number(fields[i]) || 0), 0);
  db.prepare(`
    UPDATE daily_costs SET date=?,cigarettes=?,medicine=?,six9=?,rent=?,gas=?,mix=?,cannabis=?,utilities=?,bottles=?,wages=?,ice=?,other=?,total=?,note=? WHERE id=?
  `).run(body.date ?? old.date, ...fields, total, body.note !== undefined ? body.note : old.note, id);
  auditLog((req as any).user.id, "update", "daily_cost", id, `แก้ไขต้นทุนรายวัน #${id}`);
  res.json(db.prepare("SELECT * FROM daily_costs WHERE id=?").get(id));
});

router.delete("/daily-costs/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  if (!db.prepare("SELECT id FROM daily_costs WHERE id=?").get(id)) {
    res.status(404).json({ error: "ไม่พบ" }); return;
  }
  db.prepare("DELETE FROM daily_costs WHERE id=?").run(id);
  auditLog((req as any).user.id, "delete", "daily_cost", id, `ลบต้นทุนรายวัน #${id}`);
  res.status(204).send();
});

export default router;
