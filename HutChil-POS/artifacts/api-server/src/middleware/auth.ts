import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db";

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "hutchil-secret-2024";

export interface JwtPayload {
  id: number;
  username: string;
  role: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "ไม่ได้ล็อกอิน" });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token หมดอายุหรือไม่ถูกต้อง" });
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if ((req as any).user?.role !== "owner") {
      res.status(403).json({ error: "สำหรับเจ้าของร้านเท่านั้น" });
      return;
    }
    next();
  });
}

export function auditLog(
  userId: number,
  action: string,
  entity: string,
  entityId: number | null,
  description: string,
  oldValue?: string,
  newValue?: string
) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity, entity_id, description, old_value, new_value, time)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(userId, action, entity, entityId, description, oldValue ?? null, newValue ?? null, now);
}
