import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireOwner } from "../middleware/auth";

const router = Router();

router.get("/stock/logs", requireAuth, (req, res) => {
  const productId = req.query["product_id"] ? Number(req.query["product_id"]) : null;
  const limit = req.query["limit"] ? Number(req.query["limit"]) : 200;

  let query = `
    SELECT sl.*, p.name AS product_name, u.name AS user_name
    FROM stock_logs sl
    LEFT JOIN products p ON sl.product_id = p.id
    LEFT JOIN users u ON sl.user_id = u.id
  `;
  const params: any[] = [];
  if (productId) {
    query += " WHERE sl.product_id = ?";
    params.push(productId);
  }
  query += " ORDER BY sl.time DESC LIMIT ?";
  params.push(limit);

  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

router.patch("/stock/reorder", requireOwner, (req, res) => {
  const items = req.body as { id: number; display_order: number }[];
  if (!Array.isArray(items)) {
    res.status(400).json({ error: "ต้องส่งเป็น array" });
    return;
  }
  const update = db.prepare("UPDATE products SET display_order=? WHERE id=?");
  for (const item of items) {
    update.run(item.display_order, item.id);
  }
  res.json({ ok: true });
});

export default router;
