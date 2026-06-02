import { Router } from "express";
import { db } from "../db";
import { requireOwner } from "../middleware/auth";

const router = Router();

router.get("/dashboard/stats", requireOwner, (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const todaySales = db.prepare(
    "SELECT payment_type, SUM(total) AS total, COUNT(*) AS cnt FROM sales WHERE date(time)=? AND is_gift=0 GROUP BY payment_type"
  ).all(today) as any[];

  let today_revenue = 0, today_cash = 0, today_transfer = 0, today_count = 0;
  for (const row of todaySales) {
    today_revenue += row.total;
    today_count += row.cnt;
    if (row.payment_type === "เงินสด") today_cash = row.total;
    else if (row.payment_type === "โอน") today_transfer = row.total;
  }

  const todayCosts = (db.prepare(
    "SELECT COALESCE(SUM(total),0) AS total FROM daily_costs WHERE date=?"
  ).get(today) as any).total || 0;

  const todayCOGS = (db.prepare(`
    SELECT COALESCE(SUM(s.qty * COALESCE(p.cost_per_unit,0)),0) AS total
    FROM sales s JOIN products p ON s.product_id=p.id
    WHERE date(s.time)=? AND s.is_gift=0
  `).get(today) as any).total || 0;

  const net_profit = today_revenue - todayCosts - todayCOGS;

  const lowStockItems = db.prepare(
    "SELECT * FROM products WHERE min_stock IS NOT NULL AND qty < min_stock ORDER BY qty"
  ).all() as any[];

  const openShifts = (db.prepare(
    "SELECT COUNT(*) AS cnt FROM shifts WHERE status='open'"
  ).get() as any).cnt || 0;

  res.json({
    today_revenue,
    today_cash,
    today_transfer,
    today_count,
    net_profit,
    low_stock_count: lowStockItems.length,
    low_stock_items: lowStockItems,
    open_shifts: openShifts,
  });
});

router.get("/dashboard/sales-chart", requireOwner, (req, res) => {
  const days = Number(req.query["days"] ?? 30);
  const rows = db.prepare(`
    SELECT
      date(time) AS date,
      SUM(CASE WHEN is_gift=0 THEN total ELSE 0 END) AS revenue
    FROM sales
    WHERE date(time) >= date('now', '-' || ? || ' days')
    GROUP BY date(time)
    ORDER BY date(time)
  `).all(days) as any[];

  const result = rows.map((r) => {
    const costs = (db.prepare(
      "SELECT COALESCE(SUM(total),0) AS total FROM daily_costs WHERE date=?"
    ).get(r.date) as any).total || 0;
    const cogs = (db.prepare(`
      SELECT COALESCE(SUM(s.qty * COALESCE(p.cost_per_unit,0)),0) AS total
      FROM sales s JOIN products p ON s.product_id=p.id
      WHERE date(s.time)=? AND s.is_gift=0
    `).get(r.date) as any).total || 0;
    const cost = costs + cogs;
    return { date: r.date, revenue: r.revenue, cost, profit: r.revenue - cost };
  });

  res.json(result);
});

router.get("/dashboard/top-products", requireOwner, (_req, res) => {
  const rows = db.prepare(`
    SELECT s.product_id, p.name AS product_name,
      SUM(s.qty) AS total_qty,
      SUM(CASE WHEN s.is_gift=0 THEN s.total ELSE 0 END) AS total_revenue
    FROM sales s JOIN products p ON s.product_id=p.id
    WHERE date(s.time) >= date('now', '-30 days')
    GROUP BY s.product_id ORDER BY total_revenue DESC LIMIT 10
  `).all();
  res.json(rows);
});

export default router;
