import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { requireAuth, requireOwner, auditLog } from "../middleware/auth";

const router = Router();

router.get("/users", requireAuth, (_req, res) => {
  const users = db.prepare(
    "SELECT id,name,username,role,daily_wage,shift,created_at FROM users ORDER BY id"
  ).all();
  res.json(users);
});

router.post("/users", requireOwner, (req, res) => {
  const { name, username, password, role, daily_wage, shift } = req.body ?? {};
  if (!name || !username || !password || !role) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }
  const existing = db.prepare("SELECT id FROM users WHERE username=?").get(username);
  if (existing) {
    res.status(400).json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    "INSERT INTO users (name,username,password_hash,role,daily_wage,shift) VALUES (?,?,?,?,?,?)"
  ).run(name, username, hash, role, daily_wage ?? null, shift ?? null) as any;
  const user = db.prepare("SELECT id,name,username,role,daily_wage,shift,created_at FROM users WHERE id=?").get(result.lastInsertRowid) as any;
  auditLog((req as any).user.id, "create", "user", user.id, `เพิ่มพนักงาน ${name}`);
  res.status(201).json(user);
});

router.get("/users/:id", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id,name,username,role,daily_wage,shift,created_at FROM users WHERE id=?").get(Number(req.params["id"])) as any;
  if (!user) { res.status(404).json({ error: "ไม่พบ" }); return; }
  res.json(user);
});

router.put("/users/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const old = db.prepare("SELECT * FROM users WHERE id=?").get(id) as any;
  if (!old) { res.status(404).json({ error: "ไม่พบ" }); return; }

  const { name, username, password, role, daily_wage, shift } = req.body ?? {};
  let hash = old.password_hash;
  if (password) {
    hash = bcrypt.hashSync(password, 10);
  }
  db.prepare(
    "UPDATE users SET name=?,username=?,password_hash=?,role=?,daily_wage=?,shift=? WHERE id=?"
  ).run(
    name ?? old.name,
    username ?? old.username,
    hash,
    role ?? old.role,
    daily_wage !== undefined ? daily_wage : old.daily_wage,
    shift !== undefined ? shift : old.shift,
    id
  );
  const updated = db.prepare("SELECT id,name,username,role,daily_wage,shift,created_at FROM users WHERE id=?").get(id) as any;
  auditLog((req as any).user.id, "update", "user", id, `แก้ไขพนักงาน ${updated.name}`);
  res.json(updated);
});

router.delete("/users/:id", requireOwner, (req, res) => {
  const id = Number(req.params["id"]);
  const user = db.prepare("SELECT * FROM users WHERE id=?").get(id) as any;
  if (!user) { res.status(404).json({ error: "ไม่พบ" }); return; }
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  auditLog((req as any).user.id, "delete", "user", id, `ลบพนักงาน ${user.name}`);
  res.status(204).send();
});

export default router;
