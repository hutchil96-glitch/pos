import { Router } from "express";
import { db } from "../db";
import { requireAuth, auditLog } from "../middleware/auth";

const router = Router();

function enrichShift(s: any) {
  if (!s) return s;
  const user = db.prepare("SELECT name FROM users WHERE id=?").get(s.user_id) as any;
  return { ...s, status: s.status, user_name: user?.name ?? null };
}

router.get("/shifts", requireAuth, (req, res) => {
  const reqUser = (req as any).user;
  const { user_id, date, open } = req.query as any;
  let query = "SELECT * FROM shifts WHERE 1=1";
  const params: any[] = [];

  if (user_id) {
    query += " AND user_id=?";
    params.push(Number(user_id));
  } else if (reqUser.role === "employee") {
    query += " AND user_id=?";
    params.push(reqUser.id);
  }
  if (date) {
    query += " AND date(check_in_time)=?";
    params.push(date);
  }
  if (open === "true") {
    query += " AND status='open'";
  }
  query += " ORDER BY check_in_time DESC";

  const shifts = db.prepare(query).all(...params).map(enrichShift);
  res.json(shifts);
});

router.post("/shifts", requireAuth, (req, res) => {
  const reqUser = (req as any).user;
  const { shift_type, brewing_product_id, brewing_qty } = req.body ?? {};
  if (!shift_type) {
    res.status(400).json({ error: "กรุณาเลือกประเภทกะ" });
    return;
  }

  const existing = db.prepare(
    "SELECT id FROM shifts WHERE user_id=? AND status='open'"
  ).get(reqUser.id);
  if (existing) {
    res.status(400).json({ error: "มีกะที่เปิดอยู่แล้ว" });
    return;
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO shifts (user_id,shift_type,check_in_time,status,brewing_product_id,brewing_qty)
    VALUES (?,?,?,'open',?,?)
  `).run(reqUser.id, shift_type, now, brewing_product_id ?? null, brewing_qty ?? null) as any;

  if (shift_type === "เช้า" && brewing_product_id && brewing_qty) {
    db.prepare("INSERT INTO brewing_logs (shift_id,product_id,qty,time) VALUES (?,?,?,?)").run(
      result.lastInsertRowid, brewing_product_id, brewing_qty, now
    );
    db.prepare("UPDATE products SET qty=qty+?,updated_at=? WHERE id=?").run(brewing_qty, now, brewing_product_id);
    db.prepare("INSERT INTO stock_logs (product_id,qty_change,reason,type,user_id,time) VALUES (?,?,?,?,?,?)").run(
      brewing_product_id, brewing_qty, `ต้มน้ำ-เช้า-${reqUser.username}`, "brew", reqUser.id, now
    );
  }

  const shift = enrichShift(db.prepare("SELECT * FROM shifts WHERE id=?").get(result.lastInsertRowid));
  auditLog(reqUser.id, "create", "shift", result.lastInsertRowid, `เข้ากะ ${shift_type}`);
  res.status(201).json(shift);
});

router.get("/shifts/:id", requireAuth, (req, res) => {
  const shift = db.prepare("SELECT * FROM shifts WHERE id=?").get(Number(req.params["id"]));
  if (!shift) { res.status(404).json({ error: "ไม่พบ" }); return; }
  res.json(enrichShift(shift));
});

router.post("/shifts/:id/close", requireAuth, (req, res) => {
  const id = Number(req.params["id"]);
  const reqUser = (req as any).user;
  const shift = db.prepare("SELECT * FROM shifts WHERE id=?").get(id) as any;
  if (!shift) { res.status(404).json({ error: "ไม่พบ" }); return; }
  if (shift.status === "closed") { res.status(400).json({ error: "กะนี้ปิดแล้ว" }); return; }
  if (reqUser.role === "employee" && shift.user_id !== reqUser.id) {
    res.status(403).json({ error: "ไม่ใช่กะของคุณ" }); return;
  }

  const { cash_count, account_total, photos } = req.body ?? {};
  if (cash_count === undefined || account_total === undefined) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลการนับเงิน" });
    return;
  }
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    res.status(400).json({ error: "กรุณาถ่ายรูปอย่างน้อย 1 รูป" });
    return;
  }

  const sales = db.prepare(
    "SELECT payment_type, total FROM sales WHERE shift_id=? AND is_gift=0"
  ).all(id) as any[];
  const systemCash = sales.filter((s) => s.payment_type === "เงินสด").reduce((a, s) => a + s.total, 0);
  const systemTransfer = sales.filter((s) => s.payment_type === "โอน").reduce((a, s) => a + s.total, 0);
  const systemTotal = systemCash + systemTransfer;
  const netTotal = Number(cash_count) + Number(account_total);
  const difference = netTotal - systemTotal;

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE shifts SET status='closed',close_time=?,cash_count=?,account_total=?,
    system_cash=?,system_transfer=?,system_total=?,net_total=?,difference=?,photos=? WHERE id=?
  `).run(
    now, cash_count, account_total, systemCash, systemTransfer, systemTotal,
    netTotal, difference, JSON.stringify(photos), id
  );

  auditLog(reqUser.id, "update", "shift", id, `ปิดกะ ${shift.shift_type} ผลต่าง ${difference > 0 ? "+" : ""}${difference}฿`);
  const closed = enrichShift(db.prepare("SELECT * FROM shifts WHERE id=?").get(id));
  res.json(closed);
});

router.post("/brewing", requireAuth, (req, res) => {
  const reqUser = (req as any).user;
  const { shift_id, product_id, qty } = req.body ?? {};
  if (!shift_id || !product_id || !qty) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }
  const now = new Date().toISOString();
  const result = db.prepare(
    "INSERT INTO brewing_logs (shift_id,product_id,qty,time) VALUES (?,?,?,?)"
  ).run(shift_id, product_id, qty, now) as any;

  db.prepare("UPDATE products SET qty=qty+?,updated_at=? WHERE id=?").run(qty, now, product_id);
  db.prepare("INSERT INTO stock_logs (product_id,qty_change,reason,type,user_id,time) VALUES (?,?,?,?,?,?)").run(
    product_id, qty, `ต้มน้ำ-เช้า-${reqUser.username}`, "brew", reqUser.id, now
  );

  const log = db.prepare(`
    SELECT bl.*, p.name AS product_name FROM brewing_logs bl
    LEFT JOIN products p ON bl.product_id=p.id WHERE bl.id=?
  `).get(result.lastInsertRowid);
  res.status(201).json(log);
});

export default router;
