import { useState, useMemo, useRef } from "react";
import { Layout } from "@/components/layout";
import {
  useListProducts,
  useAdjustStock,
  useUpdateProduct,
  useCreateProduct,
  useDeleteProduct,
  useListStockLogs,
  getListProductsQueryKey,
  getListStockLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, ArrowUpCircle, ArrowDownCircle, AlertCircle, GripVertical, ArrowUpDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { readStoredToken } from "@/hooks/use-auth";

type SortField = "custom" | "name" | "price" | "qty";
type SortDir = "asc" | "desc";

function SortableProductRow({
  product,
  sortBy,
  onAdjust,
  onEdit,
  onDelete,
}: {
  product: any;
  sortBy: SortField;
  onAdjust: (p: any, dir: "up" | "down") => void;
  onEdit: (p: any) => void;
  onDelete: (p: any) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: isDragging ? ("relative" as const) : undefined,
    zIndex: isDragging ? 9999 : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8 px-2">
        {sortBy === "custom" ? (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground touch-none"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <div className="w-6" />
        )}
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {product.name}
          {product.min_stock && product.qty <= product.min_stock && (
            <AlertCircle className="w-4 h-4 text-destructive" />
          )}
        </div>
      </TableCell>
      <TableCell className={`text-right font-bold text-lg ${product.min_stock && product.qty <= product.min_stock ? "text-destructive" : "text-green-500"}`}>
        {product.qty}
      </TableCell>
      <TableCell className="text-muted-foreground">{product.unit}</TableCell>
      <TableCell className="text-right">{product.price}฿</TableCell>
      <TableCell className="text-right text-muted-foreground">{product.cost_per_unit ? `${product.cost_per_unit}฿` : "-"}</TableCell>
      <TableCell>
        <div className="flex justify-center gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8 text-green-500 border-green-500/20 hover:bg-green-500/10" title="เพิ่มสต็อก" onClick={() => onAdjust(product, "up")}>
            <ArrowUpCircle className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/10" title="ลดสต็อก" onClick={() => onAdjust(product, "down")}>
            <ArrowDownCircle className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => onEdit(product)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDelete(product)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function Stock() {
  const qc = useQueryClient();
  const { data: products } = useListProducts();
  const { data: logs } = useListStockLogs({});

  const adjustStock = useAdjustStock();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [adjustModal, setAdjustModal] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<any>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");

  const [productModal, setProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [pName, setPName] = useState("");
  const [pPrice, setPPrice] = useState(0);
  const [pUnit, setPUnit] = useState("ขวด");
  const [pQty, setPQty] = useState(0);
  const [pMinStock, setPMinStock] = useState(10);
  const [pCost, setPCost] = useState(0);

  const [sortBy, setSortBy] = useState<SortField>("custom");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const isSaving = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const displayedProducts = useMemo(() => {
    if (!products) return [];
    const list = [...products] as any[];
    if (sortBy === "custom") {
      return list.sort((a, b) => (a.display_order ?? a.id) - (b.display_order ?? b.id));
    }
    return list.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortBy === "name") { aVal = a.name; bVal = b.name; }
      else if (sortBy === "price") { aVal = a.price; bVal = b.price; }
      else { aVal = a.qty; bVal = b.qty; }
      const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal, "th") : aVal - bVal;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [products, sortBy, sortDir]);

  const handleSort = (field: SortField) => {
    if (field === "custom") { setSortBy("custom"); return; }
    if (sortBy === field) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  };

  const SortBtn = ({ field, label }: { field: SortField; label: string }) => (
    <Button
      size="sm"
      variant={sortBy === field ? "default" : "outline"}
      className="h-7 px-2 text-xs gap-1"
      onClick={() => handleSort(field)}
    >
      {label}
      {field !== "custom" && sortBy === field && <ArrowUpDown className="w-3 h-3" />}
    </Button>
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayedProducts.findIndex((p) => p.id === active.id);
    const newIndex = displayedProducts.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(displayedProducts, oldIndex, newIndex);

    const payload = reordered.map((p, i) => ({ id: p.id, display_order: i * 10 }));

    if (isSaving.current) return;
    isSaving.current = true;
    try {
      const token = readStoredToken();
      await fetch("/api/stock/reorder", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
    } catch {
      toast.error("บันทึกลำดับล้มเหลว");
    } finally {
      isSaving.current = false;
    }
  };

  const openAdjustModal = (product: any, direction: "up" | "down") => {
    setAdjustProduct(product);
    setAdjustQty(direction === "up" ? 1 : -1);
    setAdjustReason("");
    setAdjustModal(true);
  };

  const handleAdjustSubmit = () => {
    if (!adjustProduct || !adjustQty || !adjustReason) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    adjustStock.mutate({ id: adjustProduct.id, data: { qty_change: adjustQty, reason: adjustReason } }, {
      onSuccess: () => {
        toast.success("ปรับสต็อกสำเร็จ");
        setAdjustModal(false);
        qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
        qc.invalidateQueries({ queryKey: getListStockLogsQueryKey() });
      },
      onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
    });
  };

  const openProductModal = (product?: any) => {
    if (product) {
      setEditProduct(product);
      setPName(product.name); setPPrice(product.price); setPUnit(product.unit ?? "ขวด");
      setPQty(product.qty); setPMinStock(product.min_stock ?? 10); setPCost(product.cost_per_unit ?? 0);
    } else {
      setEditProduct(null); setPName(""); setPPrice(0); setPUnit("ขวด"); setPQty(0); setPMinStock(10); setPCost(0);
    }
    setProductModal(true);
  };

  const handleSaveProduct = () => {
    if (!pName || pPrice === undefined) { toast.error("กรุณากรอกชื่อและราคา"); return; }
    const payload = { name: pName, price: pPrice, unit: pUnit, qty: pQty, min_stock: pMinStock, cost_per_unit: pCost || undefined } as any;
    if (editProduct) {
      updateProduct.mutate({ id: editProduct.id, data: payload }, {
        onSuccess: () => { toast.success("แก้ไขสำเร็จ"); setProductModal(false); qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => { toast.success("เพิ่มสินค้าสำเร็จ"); setProductModal(false); qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
      });
    }
  };

  const handleDeleteProduct = (p: any) => {
    if (!confirm(`ลบ ${p.name}?`)) return;
    deleteProduct.mutate({ id: p.id }, {
      onSuccess: () => { toast.success("ลบสินค้าแล้ว"); qc.invalidateQueries({ queryKey: getListProductsQueryKey() }); },
      onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
    });
  };

  const typeLabel: Record<string, string> = { add: "เพิ่ม", deduct: "หัก", sale: "ขาย", purchase: "รับสต็อก", brew: "ต้มน้ำ", adjust: "ปรับ" };
  const formatTime = (t: string) => new Date(t).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">จัดการสต็อกสินค้า</h1>
          <Button size="sm" onClick={() => openProductModal()}>
            <Plus className="w-4 h-4 mr-1" /> เพิ่มสินค้า
          </Button>
        </div>

        <Tabs defaultValue="products">
          <TabsList>
            <TabsTrigger value="products">สินค้า</TabsTrigger>
            <TabsTrigger value="logs">ประวัติสต็อก</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <div className="flex flex-wrap gap-1 mb-2">
              <SortBtn field="custom" label="ลำดับที่ตั้งเอง" />
              <SortBtn field="name" label={`ชื่อ${sortBy === "name" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}`} />
              <SortBtn field="price" label={`ราคา${sortBy === "price" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}`} />
              <SortBtn field="qty" label={`คงเหลือ${sortBy === "qty" ? (sortDir === "asc" ? " ↑" : " ↓") : ""}`} />
            </div>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={displayedProducts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>สินค้า</TableHead>
                        <TableHead className="text-right">คงเหลือ</TableHead>
                        <TableHead>หน่วย</TableHead>
                        <TableHead className="text-right">ราคาขาย</TableHead>
                        <TableHead className="text-right">ต้นทุน</TableHead>
                        <TableHead className="text-center">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedProducts.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">ยังไม่มีสินค้า</TableCell></TableRow>
                      )}
                      {displayedProducts.map((p: any) => (
                        <SortableProductRow
                          key={p.id}
                          product={p}
                          sortBy={sortBy}
                          onAdjust={openAdjustModal}
                          onEdit={openProductModal}
                          onDelete={handleDeleteProduct}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            </div>
            {sortBy === "custom" && (
              <p className="text-xs text-muted-foreground mt-1 text-center">ลากที่ ⠿ เพื่อเรียงลำดับสินค้า</p>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เวลา</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead>เหตุผล</TableHead>
                    <TableHead>พนักงาน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logs ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ยังไม่มีข้อมูล</TableCell></TableRow>
                  )}
                  {(logs ?? []).map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">{formatTime(log.time)}</TableCell>
                      <TableCell>{log.product_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={log.qty_change > 0 ? "text-green-500 border-green-500/30" : "text-destructive border-destructive/30"}>
                          {typeLabel[log.type] ?? log.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${log.qty_change > 0 ? "text-green-500" : "text-destructive"}`}>
                        {log.qty_change > 0 ? `+${log.qty_change}` : log.qty_change}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">{log.reason}</TableCell>
                      <TableCell className="text-muted-foreground">{log.user_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Adjust Modal */}
      <Dialog open={adjustModal} onOpenChange={setAdjustModal}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>ปรับสต็อก: {adjustProduct?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground text-center">คงเหลือปัจจุบัน: <span className="text-foreground font-bold">{adjustProduct?.qty}</span></div>
            <div>
              <Label>จำนวน (ลบ = หัก)</Label>
              <Input type="number" className="mt-1" value={adjustQty} onChange={(e) => setAdjustQty(Number(e.target.value))} />
            </div>
            <div>
              <Label>เหตุผล</Label>
              <Input className="mt-1" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="เช่น ยอดคงเหลือคลาดเคลื่อน" />
            </div>
            {adjustQty !== 0 && (
              <div className="text-sm text-center">
                หลังปรับ: <span className={`font-bold ${(adjustProduct?.qty + adjustQty) < 0 ? "text-destructive" : "text-green-500"}`}>{adjustProduct?.qty + adjustQty}</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setAdjustModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleAdjustSubmit} disabled={adjustStock.isPending}>บันทึก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Modal */}
      <Dialog open={productModal} onOpenChange={setProductModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ชื่อสินค้า</Label><Input className="mt-1" value={pName} onChange={(e) => setPName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ราคาขาย (฿)</Label><Input type="number" className="mt-1" value={pPrice || ""} onChange={(e) => setPPrice(Number(e.target.value))} /></div>
              <div><Label>ต้นทุน/หน่วย (฿)</Label><Input type="number" className="mt-1" value={pCost || ""} onChange={(e) => setPCost(Number(e.target.value))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>จำนวน</Label><Input type="number" className="mt-1" value={pQty || ""} onChange={(e) => setPQty(Number(e.target.value))} /></div>
              <div><Label>ขั้นต่ำ</Label><Input type="number" className="mt-1" value={pMinStock || ""} onChange={(e) => setPMinStock(Number(e.target.value))} /></div>
              <div>
                <Label>หน่วย</Label>
                <Select value={pUnit} onValueChange={setPUnit}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ขวด">ขวด</SelectItem>
                    <SelectItem value="กรัม">กรัม</SelectItem>
                    <SelectItem value="ชิ้น">ชิ้น</SelectItem>
                    <SelectItem value="แพ็ค">แพ็ค</SelectItem>
                    <SelectItem value="กล่อง">กล่อง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setProductModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleSaveProduct} disabled={createProduct.isPending || updateProduct.isPending}>บันทึก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
