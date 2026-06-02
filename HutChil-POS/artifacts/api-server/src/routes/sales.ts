import { Router } from "express";
import { db } from "../db";
import { requireAuth, requireOwner, auditLog } from "../middleware/auth";

const router = Router();

const LOCK_MINUTES = 5;

function isLocked(saleTime: string, isOwner: boolean): boolean {
  if (isOwner) return false;
  const t = new Date(saleTime).getTime();
  const now = Date.now();
  return (now - t) > LOCK_MINUTES * 60 * 1000;
}

function enrichSale(sale: any) {
  if (!sale) return sale;
  const product = db.prepare("SELECT name FROM products WHERE id=?").get(sale.product_id) as any;
  const user = db.prepare("SELECT name FROM users WHERE id=?").get(sale.user_id) as any;
  const shift = sale.shift_id
    ? db.prepare("SELECT shift_type FROM shifts WHERE id=?").get(sale.shift_id) as any
    : null;
  const promo = sale.promo_id
    ? db.prepare("SELECT name FROM promotions WHERE id=?").get(sale.promo_id) as any
    : null;
  return {
    ...sale,
    is_gift: Boolean(sale.is_gift),
    locked: Boolean(sale.locked),
    product_name: product?.name ?? null,
    user_name: user?.name ?? null,
    shift_type: shift?.shift_type ?? null,
    promo_name: promo?.name ?? null,
  };
}

router.get("/sales", requireAuth, (req, res) => {
  const { date, employee_id, shift_id } = req.query as any;
  const reqUser = (req as any).user;
  let query = "SELECT * FROM sales WHERE 1=1";
  const params: any[] = [];

  if (date) {
    query += " AND date(time)=?";
    params.push(date);
  }
  if (employee_id) {
    query += " AND user_id=?";
    params.push(Number(employee_id));
  } else if (reqUser.role === "employee") {
    query += " AND user_id=?";
    params.push(reqUser.id);
  }
  if (shift_id) {
    query += " AND shift_id=?";
    params.push(Number(shift_id));
  }
  query += " ORDER BY time DESC";

  const sales = db.prepare(query).all(...params).map(enrichSale);
  res.json(sales);
});

router.post("/sales", requireAuth, (req, res) => {
  const { product_id, shift_id, qty, price, total, payment_type, is_gift, slip_photo, note, promo_id, time } = req.body ?? {};
  if (!product_id || qty === undefined || price === undefined || !total === undefined || !payment_type) {
    res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ" });
    return;
  }

  const product = db.prepare("SELECT * FROM products WHERE id=?").get(product_id) as any;
  if (!product) { res.status(404).json({ error: "ไม่พบสินค้า" }); return; }

  if (product.qty < qty) {
    res.status(400).json({ error: `สต็อกไม่พอ (เหลือ ${product.qty})` });
    return;
  }

  const saleTime = time ?? new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO sales (user_id,product_id,shift_id,qty,price,total,payment_type,is_gift,slip_photo,note,promo_id,time,locked)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)
  `).run(
    (req as any).user.id, product_id, shift_id ?? null, qty, price, total,
    payment_type, is_gift ? 1 : 0, slip_photo ?? null, note ?? null, promo_id ?? null, saleTime
  ) as any;

  const now = new Date().toISOString();
  db.prepare("UPDATE products SET qty=qty-?,updated_at=? WHERE id=?").run(qty, now, product_id);
  db.prepare("INSERT INTO stock_logs (product_id,qty_change,reason,type,user_id,time) VALUES (?,?,?,?,?,?)").run(
    product_id, -qty, is_gift ? "ของแถม" : `ขาย #${result.lastInsertRowid}`, "sale", (req as any).user.id, now
  );

  const sale = enrichSale(db.prepare("SELECT * FROM sales WHERE id=?").get(result.lastInsertRowid));
  auditLog((req as any).user.id, "create", "sale", result.lastInsertRowid, `บันทึกขาย ${product.name} x${qty}`);
  res.status(201).json(sale);
});

router.get("/sales/:id", requireAuth, (req, res) => {
  const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(Number(req.params["id"]));
  if (!sale) { res.status(404).json({ error: "ไม่พบ" }); return; }
  res.json(enrichSale(sale));
});

router.put("/sales/:id", requireAuth, (req, res) => {
  const id = Number(req.params["id"]);
  const reqUser = (req as any).user;
  const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(id) as any;
  if (!sale) { res.status(404).json({ error: "ไม่พบ" }); return; }

  if (reqUser.role !== "owner" && (sale.user_id !== reqUser.id || isLocked(sale.time, false))) {
    res.status(403).json({ error: "ไม่สามารถแก้ไขได้ (เกิน 5 นาที)" });
    return;
  }

  const { product_id, qty, price, total, payment_type, is_gift, slip_photo, note, promo_id, time, edit_reason } = req.body ?? {};

  const oldProduct = db.prepare("SELECT * FROM products WHERE id=?").get(sale.product_id) as any;
  if (oldProduct) {
    const now = new Date().toISOString();
    db.prepare("UPDATE products SET qty=qty+?,updated_at=? WHERE id=?").run(sale.qty, now, sale.product_id);
  }

  const newProductId = product_id ?? sale.product_id;
  const newQty = qty ?? sale.qty;
  const newProduct = db.prepare("SELECT * FROM products WHERE id=?").get(newProductId) as any;
  if (!newProduct) { res.status(404).json({ error: "ไม่พบสินค้า" }); return; }

  if (newProduct.qty < newQty) {
    const now = new Date().toISOString();
    db.prepare("UPDATE products SET qty=qty-?,updated_at=? WHERE id=?").run(sale.qty, now, sale.product_id);
    res.status(400).json({ error: `สต็อกไม่พอ (เหลือ ${newProduct.qty + sale.qty})` });
    return;
  }

  const saleTime = time ?? sale.time;
  const oldStr = JSON.stringify({ product_id: sale.product_id, qty: sale.qty, total: sale.total });
  db.prepare(`
    UPDATE sales SET product_id=?,qty=?,price=?,total=?,payment_type=?,is_gift=?,slip_photo=?,note=?,promo_id=?,time=? WHERE id=?
  `).run(
    newProductId, newQty, price ?? sale.price, total ?? sale.total,
    payment_type ?? sale.payment_type, is_gift !== undefined ? (is_gift ? 1 : 0) : sale.is_gift,
    slip_photo !== undefined ? slip_photo : sale.slip_photo,
    note !== undefined ? note : sale.note,
    promo_id !== undefined ? promo_id : sale.promo_id,
    saleTime, id
  );

  const now = new Date().toISOString();
  db.prepare("UPDATE products SET qty=qty-?,updated_at=? WHERE id=?").run(newQty, now, newProductId);
  const newStr = JSON.stringify({ product_id: newProductId, qty: newQty, total: total ?? sale.total });
  auditLog(reqUser.id, "update", "sale", id, `แก้ไขยอดขาย #${id}${edit_reason ? " เหตุผล: " + edit_reason : ""}`, oldStr, newStr);

  const updated = enrichSale(db.prepare("SELECT * FROM sales WHERE id=?").get(id));
  res.json(updated);
});

router.delete("/sales/:id", requireAuth, (req, res) => {
  const id = Number(req.params["id"]);
  const reqUser = (req as any).user;
  const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(id) as any;
  if (!sale) { res.status(404).json({ error: "ไม่พบ" }); return; }

  if (reqUser.role !== "owner" && (sale.user_id !== reqUser.id || isLocked(sale.time, false))) {
    res.status(403).json({ error: "ไม่สามารถลบได้ (เกิน 5 นาที)" });
    return;
  }

  const now = new Date().toISOString();
  db.prepare("UPDATE products SET qty=qty+?,updated_at=? WHERE id=?").run(sale.qty, now, sale.product_id);
  db.prepare("DELETE FROM sales WHERE id=?").run(id);
  auditLog(reqUser.id, "delete", "sale", id, `ลบยอดขาย #${id}`);
  res.status(204).send();
});

export default router;
