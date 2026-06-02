import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireOwner, auditLog } from "../middleware/auth";

const router = Router();

function enrichPayroll(p: any) {
  if (!p) return p;
  const user = db.prepare("SELECT name FROM users WHERE id=?").get(p.user_id) as any;
  return { ...p, user_name: user?.name ?? null };
}

router.get("/payroll/summary", requireAuth, (req, res) => {
  const { date_from, date_to } = req.query as any;
  if (!date_from || !date_to) {
    res.status(400).json({ error: "กรุณาระบุช่วงวันที่" });
    return;
  }

  const users = db.prepare("SELECT * FROM users WHERE role='employee'").all() as any[];

  const summary = users.map((user) => {
    const daysWorked = (db.prepare(`
      SELECT COUNT(DISTINCT date(check_in_time)) AS cnt FROM shifts
      WHERE user_id=? AND date(check_in_time)>=? AND date(check_in_time)<=?
    `).get(user.id, date_from, date_to) as any).cnt || 0;

    const daily_wage = user.daily_wage || 0;
    const total_earned = daysWorked * daily_wage;

    const advances = (db.prepare(`
      SELECT COALESCE(SUM(amount),0) AS total FROM payroll
      WHERE user_id=? AND type='เบิกล่วงหน้า' AND date>=? AND date<=?
    `).get(user.id, date_from, date_to) as any).total || 0;

    return {
      user_id: user.id,
      user_name: user.name,
      days_worked: daysWorked,
      daily_wage,
      total_earned,
      total_advances: advances,
      net_payable: total_earned - advances,
    };
  });

  res.json(summary);
});

router.get("/payroll", requireAuth, (req, res) => {
  const reqUser = (req as any).user;
  const { user_id, date_from, date_to } = req.query as any;
  let query = "SELECT * FROM payroll WHERE 1=1";
  const params: any[] = [];

  if (user_id) {
    query += " AND user_id=?"; params.push(Number(user_id));
  } else if (reqUser.role === "employee") {
    query += " AND user_id=?"; params.push(reqUser.id);
  }
  if (date_from) { query += " AND date>=?"; params.push(date_from); }
  if (date_to) { query += " AND date<=?"; params.push(date_to); }
  query += " ORDER BY date DESC";

  res.json(db.prepare(query).all(...params).map(enrichPayroll));
});

router.post("/payroll", requireAuth, (req, res) => {
  const reqUser = (req as any).user;
  const { user_id, amount, type, note, date } = req.body ?? {};
  if (!user_id || !amount || !type || !date) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }

  if (reqUser.role === "employee" && Number(user_id) !== reqUser.id) {
    res.status(403).json({ error: "สำหรับตัวเองเท่านั้น" }); return;
  }
  if (reqUser.role === "employee" && type !== "เบิกล่วงหน้า") {
    res.status(403).json({ error: "พนักงานทำได้เฉพาะเบิกล่วงหน้า" }); return;
  }

  const status = reqUser.role === "owner" ? "approved" : "pending";
  const result = db.prepare(
    "INSERT INTO payroll (user_id,amount,type,note,date,status) VALUES (?,?,?,?,?,?)"
  ).run(user_id, amount, type, note ?? null, date, status) as any;

  const entry = enrichPayroll(db.prepare("SELECT * FROM payroll WHERE id=?").get(result.lastInsertRowid));
  auditLog(reqUser.id, "create", "payroll", result.lastInsertRowid, `${type} ${amount}฿ ให้ ${entry.user_name}`);
  res.status(201).json(entry);
});

router.put("/payroll/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const old = db.prepare("SELECT * FROM payroll WHERE id=?").get(id) as any;
  if (!old) { res.status(404).json({ error: "ไม่พบ" }); return; }
  const { amount, type, note, date, status } = req.body ?? {};
  db.prepare(
    "UPDATE payroll SET amount=?,type=?,note=?,date=?,status=? WHERE id=?"
  ).run(
    amount ?? old.amount, type ?? old.type, note ?? old.note,
    date ?? old.date, status ?? old.status, id
  );
  auditLog((req as any).user.id, "update", "payroll", id, `แก้ไขรายการเงินเดือน #${id}`);
  res.json(enrichPayroll(db.prepare("SELECT * FROM payroll WHERE id=?").get(id)));
});

export default router;
