import { Router } from "express";
import { db } from "../db";
import { requireOwner } from "../middleware/auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/sheets/settings", requireOwner, (_req, res) => {
  let settings = db.prepare("SELECT * FROM sheets_settings WHERE id=1").get() as any;
  if (!settings) {
    db.prepare("INSERT OR IGNORE INTO sheets_settings (id,auto_sync) VALUES (1,0)").run();
    settings = db.prepare("SELECT * FROM sheets_settings WHERE id=1").get();
  }
  res.json({ ...settings, auto_sync: Boolean(settings?.auto_sync) });
});

router.put("/sheets/settings", requireOwner, (req, res) => {
  const { spreadsheet_id, service_account_json, auto_sync } = req.body ?? {};
  db.prepare("INSERT OR REPLACE INTO sheets_settings (id,spreadsheet_id,service_account_json,auto_sync,last_sync) VALUES (1,?,?,?,?)").run(
    spreadsheet_id ?? null, service_account_json ?? null, auto_sync ? 1 : 0,
    (db.prepare("SELECT last_sync FROM sheets_settings WHERE id=1").get() as any)?.last_sync ?? null
  );
  const settings = db.prepare("SELECT * FROM sheets_settings WHERE id=1").get() as any;
  res.json({ ...settings, auto_sync: Boolean(settings?.auto_sync) });
});

router.post("/sheets/export", requireOwner, async (req, res) => {
  const settings = db.prepare("SELECT * FROM sheets_settings WHERE id=1").get() as any;
  if (!settings?.spreadsheet_id || !settings?.service_account_json) {
    res.status(400).json({ success: false, message: "กรุณาตั้งค่า Google Sheets ก่อน", last_sync: null });
    return;
  }

  try {
    const { google } = await import("googleapis");
    const credentials = JSON.parse(settings.service_account_json);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    const sales = db.prepare(`
      SELECT s.time, u.name AS user_name, sh.shift_type,
        p.name AS product_name, s.qty, s.price, s.total, s.payment_type, s.is_gift,
        pr.name AS promo_name
      FROM sales s
      LEFT JOIN users u ON s.user_id=u.id
      LEFT JOIN shifts sh ON s.shift_id=sh.id
      LEFT JOIN products p ON s.product_id=p.id
      LEFT JOIN promotions pr ON s.promo_id=pr.id
      ORDER BY s.time
    `).all() as any[];

    const products = db.prepare("SELECT * FROM products ORDER BY id").all() as any[];
    const dailyCosts = db.prepare("SELECT * FROM daily_costs ORDER BY date").all() as any[];

    const salesRows = [
      ["วันที่","เวลา","พนักงาน","กะ","สินค้า","จำนวน","ราคา/หน่วย","รวม","ประเภทจ่าย","ของแถม","โปรโมชั่น"],
      ...sales.map((s) => {
        const dt = new Date(s.time).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
        const [d, t] = dt.split(",");
        return [d?.trim(), t?.trim(), s.user_name, s.shift_type ?? "", s.product_name, s.qty, s.price, s.total, s.payment_type, s.is_gift ? "ใช่" : "ไม่", s.promo_name ?? ""];
      })
    ];

    const stockRows = [
      ["สินค้า","หน่วย","คงเหลือ","ราคาขาย","ต้นทุน/หน่วย","มูลค่าสต็อก","อัพเดตล่าสุด"],
      ...products.map((p) => [p.name, p.unit, p.qty, p.price, p.cost_per_unit ?? 0, p.qty * (p.cost_per_unit ?? 0), p.updated_at])
    ];

    const costRows = [
      ["วันที่","บุหรี่","ยา+ใบ","SIX9","ค่าที่+ตร","แก๊ส","มิก","กัญชา","ค่าไฟ-น้ำ","ขวด","ค่าแรง","น้ำแข็ง","อื่นๆ","รวม"],
      ...dailyCosts.map((c) => [c.date, c.cigarettes, c.medicine, c.six9, c.rent, c.gas, c.mix, c.cannabis, c.utilities, c.bottles, c.wages, c.ice, c.other, c.total])
    ];

    const batchUpdate = {
      spreadsheetId: settings.spreadsheet_id,
      resource: {
        valueInputOption: "RAW",
        data: [
          { range: "ยอดขายรายวัน!A1", values: salesRows },
          { range: "สต็อกสินค้า!A1", values: stockRows },
          { range: "ต้นทุนรายวัน!A1", values: costRows },
        ],
      },
    };

    await sheets.spreadsheets.values.batchUpdate(batchUpdate as any);

    const now = new Date().toISOString();
    db.prepare("UPDATE sheets_settings SET last_sync=? WHERE id=1").run(now);
    res.json({ success: true, message: "ส่งออกข้อมูลสำเร็จ", last_sync: now });
  } catch (err: any) {
    logger.error({ err }, "Google Sheets export failed");
    res.status(500).json({ success: false, message: `ส่งออกล้มเหลว: ${err.message}`, last_sync: null });
  }
});

export default router;
