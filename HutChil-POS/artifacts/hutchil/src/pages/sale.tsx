import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useListProducts,
  useListShifts,
  useCreateShift,
  useCloseShift,
  useCreateSale,
  useListSales,
  useUpdateSale,
  useDeleteSale,
  useListPromotions,
  getListSalesQueryKey,
  getListShiftsQueryKey,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Lock, Edit2, Trash2, Plus, Camera, ImageIcon, CheckCircle2 } from "lucide-react";

const SHIFT_TYPES = ["เช้า", "บ่าย", "ดึก"];
const PAYMENT_TYPES = ["เงินสด", "โอน"];
const LOCK_MS = 5 * 60 * 1000;
const MAX_CLOSE_PHOTOS = 10;

function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 800;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.5));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

function pickImage(camera = false): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (camera) input.capture = "environment";
    input.onchange = async () => {
      if (!input.files?.[0]) { resolve(null); return; }
      resolve(await compressImage(input.files[0]));
    };
    input.click();
  });
}

function pickMultipleImages(): Promise<string[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files?.length) { resolve([]); return; }
      const results: string[] = [];
      for (const file of Array.from(input.files)) {
        results.push(await compressImage(file));
      }
      resolve(results);
    };
    input.click();
  });
}

export default function Sale() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isOwner = user?.role === "owner";
  const today = new Date().toISOString().slice(0, 10);

  const { data: products } = useListProducts();
  const { data: allShifts } = useListShifts({ user_id: isOwner ? undefined : user?.id });
  const { data: todaySales } = useListSales({ date: today });
  const { data: promotions } = useListPromotions();

  const openShift = allShifts?.find((s: any) => s.status === "open");

  const createShift = useCreateShift();
  const closeShiftMut = useCloseShift();
  const createSale = useCreateSale();
  const updateSale = useUpdateSale();
  const deleteSale = useDeleteSale();

  const [shiftModal, setShiftModal] = useState(false);
  const [shiftType, setShiftType] = useState("เช้า");
  const [brewingProductId, setBrewingProductId] = useState<number | undefined>();
  const [brewingQty, setBrewingQty] = useState(0);

  const [closeModal, setCloseModal] = useState(false);
  const [cashCount, setCashCount] = useState("");
  const [accountTotal, setAccountTotal] = useState("");
  const [closePhotos, setClosePhotos] = useState<string[]>([]);

  const [saleModal, setSaleModal] = useState(false);
  const [editSale, setEditSale] = useState<any>(null);
  const [selProduct, setSelProduct] = useState<any>(null);
  const [saleQty, setSaleQty] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [paymentType, setPaymentType] = useState("เงินสด");
  const [isGift, setIsGift] = useState(false);
  const [slipPhoto, setSlipPhoto] = useState<string | null>(null);
  const [saleNote, setSaleNote] = useState("");
  const [selPromo, setSelPromo] = useState<any>(null);

  const formatMoney = (v: number) => v.toLocaleString("th-TH", { minimumFractionDigits: 0 });
  const formatTime = (t: string) => new Date(t).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  const handleStartShift = () => {
    createShift.mutate({
      data: {
        shift_type: shiftType,
        brewing_product_id: shiftType === "เช้า" ? brewingProductId : undefined,
        brewing_qty: shiftType === "เช้า" ? (brewingQty || undefined) : undefined,
      } as any
    }, {
      onSuccess: () => {
        toast.success("เปิดกะสำเร็จ");
        setShiftModal(false);
        qc.invalidateQueries({ queryKey: getListShiftsQueryKey() });
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      },
      onError: (e: any) => toast.error(e?.data?.error ?? "เปิดกะล้มเหลว"),
    });
  };

  const handleAddClosePhotoCamera = async () => {
    if (closePhotos.length >= MAX_CLOSE_PHOTOS) { toast.error(`ถ่ายได้สูงสุด ${MAX_CLOSE_PHOTOS} รูป`); return; }
    const photo = await pickImage(true);
    if (photo) setClosePhotos((prev) => [...prev, photo]);
  };

  const handleAddClosePhotoFile = async () => {
    const remaining = MAX_CLOSE_PHOTOS - closePhotos.length;
    if (remaining <= 0) { toast.error(`เพิ่มได้สูงสุด ${MAX_CLOSE_PHOTOS} รูป`); return; }
    const photos = await pickMultipleImages();
    if (photos.length > remaining) {
      toast.error(`เพิ่มได้อีก ${remaining} รูปเท่านั้น`);
    }
    setClosePhotos((prev) => [...prev, ...photos.slice(0, remaining)]);
  };

  const handleCloseShift = () => {
    if (!openShift) return;
    closeShiftMut.mutate({ id: openShift.id, data: { cash_count: Number(cashCount), account_total: Number(accountTotal), photos: closePhotos } as any }, {
      onSuccess: (result: any) => {
        toast.success(`ปิดกะสำเร็จ ผลต่าง ${result.difference >= 0 ? "+" : ""}${result.difference}฿`);
        setCloseModal(false);
        setClosePhotos([]);
        setCashCount("");
        setAccountTotal("");
        qc.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      },
      onError: (e: any) => toast.error(e?.data?.error ?? "ปิดกะล้มเหลว"),
    });
  };

  const openSaleModal = (sale?: any) => {
    if (sale) {
      setEditSale(sale);
      const p = products?.find((p: any) => p.id === sale.product_id);
      setSelProduct(p ?? null);
      setSaleQty(sale.qty);
      setSalePrice(sale.price);
      setPaymentType(sale.payment_type);
      setIsGift(sale.is_gift);
      setSlipPhoto(sale.slip_photo);
      setSaleNote(sale.note ?? "");
      const promo = promotions?.find((p: any) => p.id === sale.promo_id);
      setSelPromo(promo ?? null);
    } else {
      setEditSale(null);
      setSelProduct(null);
      setSaleQty(1);
      setSalePrice(0);
      setPaymentType("เงินสด");
      setIsGift(false);
      setSlipPhoto(null);
      setSaleNote("");
      setSelPromo(null);
    }
    setSaleModal(true);
  };

  const pickProduct = (p: any) => {
    setSelProduct(p);
    setSalePrice(p.price);
    setSelPromo(null);
  };

  const pickPromo = (promo: any) => {
    setSelPromo(promo);
    setSalePrice(promo.bundle_price / promo.bundle_qty);
    setSaleQty(promo.bundle_qty);
  };

  const handleSaleSubmit = () => {
    if (!selProduct) { toast.error("เลือกสินค้าก่อน"); return; }
    const total = isGift ? 0 : saleQty * salePrice;
    const payload = {
      product_id: selProduct.id,
      shift_id: openShift?.id,
      qty: saleQty,
      price: salePrice,
      total,
      payment_type: paymentType,
      is_gift: isGift,
      slip_photo: slipPhoto ?? undefined,
      note: saleNote || undefined,
      promo_id: selPromo?.id,
      time: new Date().toISOString(),
    } as any;

    if (editSale) {
      updateSale.mutate({ id: editSale.id, data: payload }, {
        onSuccess: () => {
          toast.success("แก้ไขสำเร็จ");
          setSaleModal(false);
          qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
          qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        },
        onError: (e: any) => toast.error(e?.data?.error ?? "แก้ไขล้มเหลว"),
      });
    } else {
      createSale.mutate({ data: payload }, {
        onSuccess: () => {
          toast.success(`ขาย ${selProduct.name} x${saleQty} สำเร็จ`);
          setSaleModal(false);
          qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
          qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        },
        onError: (e: any) => toast.error(e?.data?.error ?? "บันทึกยอดขายล้มเหลว"),
      });
    }
  };

  const handleDeleteSale = (id: number) => {
    if (!confirm("ต้องการลบรายการนี้?")) return;
    deleteSale.mutate({ id }, {
      onSuccess: () => {
        toast.success("ลบสำเร็จ");
        qc.invalidateQueries({ queryKey: getListSalesQueryKey() });
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
      },
      onError: (e: any) => toast.error(e?.data?.error ?? "ลบล้มเหลว"),
    });
  };

  const isEditable = (sale: any) => {
    if (isOwner) return true;
    return (Date.now() - new Date(sale.time).getTime()) < LOCK_MS;
  };

  const activePromos = promotions?.filter((p: any) => p.active && p.product_id === selProduct?.id) ?? [];

  const todayTotal = (todaySales ?? []).filter((s: any) => !s.is_gift).reduce((a: number, s: any) => a + s.total, 0);
  const todayCash = (todaySales ?? []).filter((s: any) => !s.is_gift && s.payment_type === "เงินสด").reduce((a: number, s: any) => a + s.total, 0);
  const todayTransfer = (todaySales ?? []).filter((s: any) => !s.is_gift && s.payment_type === "โอน").reduce((a: number, s: any) => a + s.total, 0);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-foreground">ขายสินค้า</h1>
          <div className="flex gap-2 flex-wrap">
            {!openShift ? (
              <Button onClick={() => setShiftModal(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" /> เปิดกะ
              </Button>
            ) : (
              <>
                <Badge variant="outline" className="text-green-500 border-green-500 px-3 py-1 text-sm">
                  กะ{openShift.shift_type} เปิดอยู่
                </Badge>
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setCloseModal(true)}>
                  ปิดกะ
                </Button>
              </>
            )}
            {openShift && (
              <Button onClick={() => openSaleModal()} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> บันทึกขาย
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">ยอดรวมวันนี้</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-green-500">{formatMoney(todayTotal)}฿</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">เงินสด</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold">{formatMoney(todayCash)}฿</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">เงินโอน</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-blue-400">{formatMoney(todayTransfer)}฿</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">รายการขายวันนี้</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เวลา</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead className="text-right">รวม</TableHead>
                  <TableHead>ชำระ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(todaySales ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ยังไม่มีรายการ</TableCell></TableRow>
                )}
                {(todaySales ?? []).map((sale: any) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm whitespace-nowrap">{formatTime(sale.time)}</TableCell>
                    <TableCell>
                      <div>{sale.product_name}</div>
                      {sale.is_gift && <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/50">ของแถม</Badge>}
                      {sale.promo_name && <Badge variant="outline" className="text-xs text-purple-400 border-purple-400/50 ml-1">{sale.promo_name}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">{sale.qty}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(sale.total)}฿</TableCell>
                    <TableCell>
                      <span className={sale.payment_type === "เงินสด" ? "text-green-400" : "text-blue-400"}>{sale.payment_type}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {isEditable(sale) ? (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openSaleModal(sale)}><Edit2 className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteSale(sale.id)}><Trash2 className="h-3 w-3" /></Button>
                          </>
                        ) : (
                          <Lock className="h-4 w-4 text-muted-foreground mx-2" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Open Shift Modal */}
      <Dialog open={shiftModal} onOpenChange={setShiftModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>เปิดกะใหม่</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ประเภทกะ</Label>
              <Select value={shiftType} onValueChange={setShiftType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SHIFT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {shiftType === "เช้า" && (
              <>
                <div>
                  <Label>สินค้าที่ต้ม</Label>
                  <Select onValueChange={(v) => setBrewingProductId(Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
                    <SelectContent className="max-h-56">
                      {(products ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>จำนวนที่ต้ม</Label>
                  <Input type="number" className="mt-1" value={brewingQty} onChange={(e) => setBrewingQty(Number(e.target.value))} />
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShiftModal(false)}>ยกเลิก</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleStartShift} disabled={createShift.isPending}>เปิดกะ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Shift Modal */}
      <Dialog open={closeModal} onOpenChange={setCloseModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>ปิดกะ {openShift?.shift_type}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>เงินสดที่นับได้ (฿)</Label>
              <Input type="number" className="mt-1" value={cashCount} onChange={(e) => setCashCount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>เงินโอนทั้งหมด (฿)</Label>
              <Input type="number" className="mt-1" value={accountTotal} onChange={(e) => setAccountTotal(e.target.value)} placeholder="0" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>รูปถ่าย</Label>
                <span className="text-xs text-muted-foreground">{closePhotos.length}/{MAX_CLOSE_PHOTOS} รูป</span>
              </div>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button" variant="outline" size="sm" className="flex-1 gap-1"
                  onClick={handleAddClosePhotoCamera}
                  disabled={closePhotos.length >= MAX_CLOSE_PHOTOS}
                >
                  <Camera className="w-4 h-4" /> ถ่ายรูป
                </Button>
                <Button
                  type="button" variant="outline" size="sm" className="flex-1 gap-1"
                  onClick={handleAddClosePhotoFile}
                  disabled={closePhotos.length >= MAX_CLOSE_PHOTOS}
                >
                  <ImageIcon className="w-4 h-4" /> เลือกรูป
                </Button>
              </div>
              {closePhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {closePhotos.map((p, i) => (
                    <div key={i} className="relative w-16 h-16">
                      <img src={p} className="w-16 h-16 object-cover rounded border border-border" alt="" />
                      <button
                        className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-4 h-4 text-xs flex items-center justify-center"
                        onClick={() => setClosePhotos((ps) => ps.filter((_, j) => j !== i))}
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setCloseModal(false)}>ยกเลิก</Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90"
                onClick={handleCloseShift}
                disabled={closeShiftMut.isPending || !cashCount || closePhotos.length === 0}
              >ปิดกะ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sale Modal */}
      <Dialog open={saleModal} onOpenChange={setSaleModal}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editSale ? "แก้ไขรายการ" : "บันทึกยอดขาย"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>สินค้า</Label>
              <div className="grid grid-cols-2 gap-2 mt-1 max-h-48 overflow-y-auto pr-1">
                {(products ?? []).map((p: any) => (
                  <button
                    key={p.id}
                    className={`p-2 rounded border text-sm text-left transition-colors ${selProduct?.id === p.id ? "border-primary bg-primary/20 text-primary" : "border-border bg-card hover:border-primary/50"}`}
                    onClick={() => pickProduct(p)}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.price}฿ | คงเหลือ {p.qty}</div>
                  </button>
                ))}
              </div>
            </div>

            {selProduct && activePromos.length > 0 && (
              <div>
                <Label>โปรโมชั่น</Label>
                <div className="flex gap-2 flex-wrap mt-1">
                  <button className={`px-3 py-1 rounded-full border text-sm ${!selPromo ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`} onClick={() => setSelPromo(null)}>ปกติ</button>
                  {activePromos.map((promo: any) => (
                    <button key={promo.id} className={`px-3 py-1 rounded-full border text-sm ${selPromo?.id === promo.id ? "border-purple-400 bg-purple-400/20 text-purple-400" : "border-border text-muted-foreground"}`} onClick={() => pickPromo(promo)}>
                      {promo.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>จำนวน</Label>
                <Input type="number" className="mt-1" value={saleQty} min={1} onChange={(e) => setSaleQty(Number(e.target.value))} />
              </div>
              <div>
                <Label>ราคา/หน่วย (฿)</Label>
                <Input type="number" className="mt-1" value={salePrice} onChange={(e) => setSalePrice(Number(e.target.value))} />
              </div>
            </div>

            <div className="p-2 bg-primary/10 rounded text-center">
              <span className="text-sm text-muted-foreground">รวม: </span>
              <span className="text-lg font-bold text-primary">{isGift ? "ของแถม" : `${formatMoney(saleQty * salePrice)}฿`}</span>
            </div>

            <div>
              <Label>ประเภทการชำระ</Label>
              <div className="flex gap-2 mt-1">
                {PAYMENT_TYPES.map((t) => (
                  <button key={t} className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${paymentType === t ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`} onClick={() => setPaymentType(t)}>{t}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch id="gift" checked={isGift} onCheckedChange={setIsGift} />
              <Label htmlFor="gift">ของแถม (ไม่คิดเงิน)</Label>
            </div>

            {paymentType === "โอน" && (
              <div>
                <Label>หลักฐานการโอน</Label>
                {slipPhoto ? (
                  <div className="mt-1 relative inline-block">
                    <img src={slipPhoto} className="w-24 h-24 object-cover rounded border border-border" alt="" />
                    <button
                      className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                      onClick={() => setSlipPhoto(null)}
                    >×</button>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-1">
                    <Button
                      type="button" variant="outline" size="sm" className="flex-1 gap-1"
                      onClick={async () => { const p = await pickImage(true); if (p) setSlipPhoto(p); }}
                    >
                      <Camera className="w-4 h-4" /> ถ่ายสลิป
                    </Button>
                    <Button
                      type="button" variant="outline" size="sm" className="flex-1 gap-1"
                      onClick={async () => { const p = await pickImage(false); if (p) setSlipPhoto(p); }}
                    >
                      <ImageIcon className="w-4 h-4" /> เลือกรูป
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>หมายเหตุ</Label>
              <Textarea className="mt-1 resize-none" rows={2} value={saleNote} onChange={(e) => setSaleNote(e.target.value)} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSaleModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleSaleSubmit} disabled={createSale.isPending || updateSale.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {editSale ? "บันทึกแก้ไข" : "บันทึกขาย"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
