import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { requireAuth, signToken } from "../middleware/auth";

const router = Router();

router.post("/auth/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ error: "กรุณากรอก username และ password" });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
  if (!user) {
    res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    return;
  }

  const token = signToken({ id: user.id, username: user.username, role: user.role });
  const { password_hash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

router.get("/auth/me", requireAuth, (req, res) => {
  const userId = (req as any).user.id;
  const user = db.prepare("SELECT id,name,username,role,daily_wage,shift,created_at FROM users WHERE id=?").get(userId) as any;
  if (!user) {
    res.status(404).json({ error: "ไม่พบผู้ใช้" });
    return;
  }
  res.json(user);
});

export default router;
