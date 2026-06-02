import { Router } from "express";
import { db } from "../db";
import { requireOwner } from "../middleware/auth";

const router = Router();

router.get("/audit", requireOwner, (req, res) => {
  const { user_id, date_from, date_to, action } = req.query as any;
  let query = `
    SELECT al.*, u.name AS user_name FROM audit_logs al
    LEFT JOIN users u ON al.user_id=u.id WHERE 1=1
  `;
  const params: any[] = [];
  if (user_id) { query += " AND al.user_id=?"; params.push(Number(user_id)); }
  if (date_from) { query += " AND date(al.time)>=?"; params.push(date_from); }
  if (date_to) { query += " AND date(al.time)<=?"; params.push(date_to); }
  if (action) { query += " AND al.action=?"; params.push(action); }
  query += " ORDER BY al.time DESC LIMIT 500";

  res.json(db.prepare(query).all(...params));
});

export default router;
