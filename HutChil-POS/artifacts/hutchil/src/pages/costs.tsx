import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListPurchases,
  useCreatePurchase,
  useDeletePurchase,
  useListDailyCosts,
  useCreateDailyCost,
  useUpdateDailyCost,
  useDeleteDailyCost,
  useListProducts,
  getListPurchasesQueryKey,
  getListDailyCostsQueryKey,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

const COST_FIELDS: Array<{ key: string; label: string }> = [
  { key: "cigarettes", label: "บุหรี่" },
  { key: "medicine", label: "ยา+ใบ" },
  { key: "six9", label: "SIX9" },
  { key: "rent", label: "ค่าที่+ตร" },
  { key: "gas", label: "แก๊ส" },
  { key: "mix", label: "มิก" },
  { key: "cannabis", label: "กัญชา" },
  { key: "utilities", label: "ค่าไฟ-น้ำ" },
  { key: "bottles", label: "ขวด" },
  { key: "wages", label: "ค่าแรง" },
  { key: "ice", label: "น้ำแข็ง" },
  { key: "other", label: "อื่นๆ" },
];

export default function Costs() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: purchases } = useListPurchases();
  const { data: dailyCosts } = useListDailyCosts({});
  const { data: products } = useListProducts();

  const createPurchase = useCreatePurchase();
  const deletePurchase = useDeletePurchase();
  const createDailyCost = useCreateDailyCost();
  const updateDailyCost = useUpdateDailyCost();
  const deleteDailyCost = useDeleteDailyCost();

  const [purchaseModal, setPurchaseModal] = useState(false);
  const [selProductId, setSelProductId] = useState<string>("");
  const [purchaseQty, setPurchaseQty] = useState(0);
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [purchaseNote, setPurchaseNote] = useState("");

  const [dailyCostModal, setDailyCostModal] = useState(false);
  const [editCost, setEditCost] = useState<any>(null);
  const [dcDate, setDcDate] = useState(today);
  const [dcValues, setDcValues] = useState<Record<string, number>>({});
  const [dcNote, setDcNote] = useState("");

  const formatMoney = (v?: number) => (v ?? 0).toLocaleString("th-TH");

  const handleCreatePurchase = () => {
    if (!selProductId || !purchaseQty || !purchaseCost) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    createPurchase.mutate({
      data: { product_id: Number(selProductId), qty: purchaseQty, cost_per_unit: purchaseCost, supplier: supplier || undefined, date: purchaseDate, note: purchaseNote || undefined } as any
    }, {
      onSuccess: () => {
        toast.success("บันทึกการรับสต็อกสำเร็จ");
        setPurchaseModal(false);
        setSelProductId(""); setPurchaseQty(0); setPurchaseCost(0); setSupplier(""); setPurchaseNote("");
        qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() });
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      },
      onError: (e: any) => toast.error(e?.data?.error ?? "บันทึกล้มเหลว"),
    });
  };

  const openDailyCostModal = (cost?: any) => {
    if (cost) {
      setEditCost(cost);
      setDcDate(cost.date);
      const vals: Record<string, number> = {};
      COST_FIELDS.forEach(({ key }) => { vals[key] = cost[key] ?? 0; });
      setDcValues(vals);
      setDcNote(cost.note ?? "");
    } else {
      setEditCost(null);
      setDcDate(today);
      setDcValues({});
      setDcNote("");
    }
    setDailyCostModal(true);
  };

  const handleSaveDailyCost = () => {
    const payload = { date: dcDate, ...dcValues, note: dcNote || undefined } as any;
    if (editCost) {
      updateDailyCost.mutate({ id: editCost.id, data: payload }, {
        onSuccess: () => { toast.success("บันทึกสำเร็จ"); setDailyCostModal(false); qc.invalidateQueries({ queryKey: getListDailyCostsQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "บันทึกล้มเหลว"),
      });
    } else {
      createDailyCost.mutate({ data: payload }, {
        onSuccess: () => { toast.success("บันทึกสำเร็จ"); setDailyCostModal(false); qc.invalidateQueries({ queryKey: getListDailyCostsQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "บันทึกล้มเหลว"),
      });
    }
  };

  const todayCostTotal = (dailyCosts ?? []).filter((c: any) => c.date === today).reduce((s: number, c: any) => s + (c.total ?? 0), 0);

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">ค่าใช้จ่าย</h1>

        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">ต้นทุนรายวัน</TabsTrigger>
            <TabsTrigger value="purchases">รับสต็อก</TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">รวมวันนี้: <span className="text-destructive font-bold">{formatMoney(todayCostTotal)}฿</span></div>
              <Button onClick={() => openDailyCostModal()} size="sm">
                <Plus className="w-4 h-4 mr-1" /> บันทึกต้นทุน
              </Button>
            </div>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    {COST_FIELDS.slice(0, 4).map((f) => <TableHead key={f.key} className="text-right">{f.label}</TableHead>)}
                    <TableHead className="text-right font-bold">รวม</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dailyCosts ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
                  )}
                  {(dailyCosts ?? []).map((c: any) => (
                    <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => openDailyCostModal(c)}>
                      <TableCell className="font-medium">{c.date}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.cigarettes)}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.medicine)}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.six9)}</TableCell>
                      <TableCell className="text-right">{formatMoney(c.rent)}</TableCell>
                      <TableCell className="text-right font-bold text-destructive">{formatMoney(c.total)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("ลบรายการ?")) { deleteDailyCost.mutate({ id: c.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListDailyCostsQueryKey() }) }); } }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="purchases" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setPurchaseModal(true)} size="sm">
                <Plus className="w-4 h-4 mr-1" /> รับสต็อกใหม่
              </Button>
            </div>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันที่</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead className="text-right">ต้นทุน/หน่วย</TableHead>
                    <TableHead className="text-right">รวม</TableHead>
                    <TableHead>ผู้จำหน่าย</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(purchases ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
                  )}
                  {(purchases ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.date}</TableCell>
                      <TableCell>{p.product_name}</TableCell>
                      <TableCell className="text-right">{p.qty}</TableCell>
                      <TableCell className="text-right">{formatMoney(p.cost_per_unit)}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{formatMoney(p.total_cost)}฿</TableCell>
                      <TableCell className="text-muted-foreground">{p.supplier || "-"}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm("ลบรายการ?")) deletePurchase.mutate({ id: p.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListPurchasesQueryKey() }) }); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Purchase Modal */}
      <Dialog open={purchaseModal} onOpenChange={setPurchaseModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>รับสต็อกใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>สินค้า</Label>
              <Select value={selProductId} onValueChange={setSelProductId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
                <SelectContent>{(products ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>จำนวน</Label><Input type="number" className="mt-1" value={purchaseQty || ""} onChange={(e) => setPurchaseQty(Number(e.target.value))} /></div>
              <div><Label>ต้นทุน/หน่วย (฿)</Label><Input type="number" className="mt-1" value={purchaseCost || ""} onChange={(e) => setPurchaseCost(Number(e.target.value))} /></div>
            </div>
            {purchaseQty > 0 && purchaseCost > 0 && (
              <div className="text-sm text-muted-foreground text-center">รวม: <span className="font-bold text-destructive">{formatMoney(purchaseQty * purchaseCost)}฿</span></div>
            )}
            <div><Label>ผู้จำหน่าย</Label><Input className="mt-1" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
            <div><Label>วันที่</Label><Input type="date" className="mt-1" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
            <div><Label>หมายเหตุ</Label><Textarea className="mt-1 resize-none" rows={2} value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setPurchaseModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleCreatePurchase} disabled={createPurchase.isPending}>บันทึก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Daily Cost Modal */}
      <Dialog open={dailyCostModal} onOpenChange={setDailyCostModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editCost ? "แก้ไขต้นทุนรายวัน" : "บันทึกต้นทุนรายวัน"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>วันที่</Label><Input type="date" className="mt-1" value={dcDate} onChange={(e) => setDcDate(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              {COST_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label>{f.label} (฿)</Label>
                  <Input type="number" className="mt-1" value={dcValues[f.key] || ""} onChange={(e) => setDcValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))} placeholder="0" />
                </div>
              ))}
            </div>
            <div className="p-2 bg-destructive/10 rounded text-center text-sm">
              รวม: <span className="font-bold text-destructive">{formatMoney(Object.values(dcValues).reduce((a, v) => a + (v || 0), 0))}฿</span>
            </div>
            <div><Label>หมายเหตุ</Label><Textarea className="mt-1 resize-none" rows={2} value={dcNote} onChange={(e) => setDcNote(e.target.value)} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDailyCostModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleSaveDailyCost} disabled={createDailyCost.isPending || updateDailyCost.isPending}>บันทึก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
