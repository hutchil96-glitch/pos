import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetSheetsSettings,
  useUpdateSheetsSettings,
  useExportToSheets,
  useListUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useListPromotions,
  useCreatePromotion,
  useUpdatePromotion,
  useDeletePromotion,
  useListProducts,
  getListUsersQueryKey,
  getListPromotionsQueryKey,
  getGetSheetsSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, Upload, CheckCircle2, AlertCircle } from "lucide-react";

export default function Settings() {
  const qc = useQueryClient();

  const { data: sheetsSettings } = useGetSheetsSettings();
  const { data: users } = useListUsers();
  const { data: promotions } = useListPromotions();
  const { data: products } = useListProducts();

  const updateSheets = useUpdateSheetsSettings();
  const exportSheets = useExportToSheets();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const createPromo = useCreatePromotion();
  const updatePromo = useUpdatePromotion();
  const deletePromo = useDeletePromotion();

  const [sheetsId, setSheetsId] = useState("");
  const [sheetsJson, setSheetsJson] = useState("");
  const [autoSync, setAutoSync] = useState(false);

  const [userModal, setUserModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [userName, setUserName] = useState("");
  const [userUsername, setUserUsername] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState("employee");
  const [userWage, setUserWage] = useState(0);
  const [userShift, setUserShift] = useState("เช้า");

  const [promoModal, setPromoModal] = useState(false);
  const [editPromo, setEditPromo] = useState<any>(null);
  const [promoName, setPromoName] = useState("");
  const [promoProductId, setPromoProductId] = useState<string>("");
  const [promoBundleQty, setPromoBundleQty] = useState(0);
  const [promoBundlePrice, setPromoBundlePrice] = useState(0);
  const [promoActive, setPromoActive] = useState(true);

  const openUserModal = (user?: any) => {
    if (user) {
      setEditUser(user);
      setUserName(user.name); setUserUsername(user.username); setUserPassword("");
      setUserRole(user.role); setUserWage(user.daily_wage ?? 0); setUserShift(user.shift ?? "เช้า");
    } else {
      setEditUser(null); setUserName(""); setUserUsername(""); setUserPassword("");
      setUserRole("employee"); setUserWage(300); setUserShift("เช้า");
    }
    setUserModal(true);
  };

  const handleSaveUser = () => {
    if (!userName || !userUsername || (!editUser && !userPassword)) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const payload = { name: userName, username: userUsername, role: userRole, daily_wage: userWage, shift: userShift, ...(userPassword ? { password: userPassword } : {}) } as any;
    if (editUser) {
      updateUser.mutate({ id: editUser.id, data: payload }, {
        onSuccess: () => { toast.success("แก้ไขสำเร็จ"); setUserModal(false); qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
      });
    } else {
      createUser.mutate({ data: { ...payload, password: userPassword } }, {
        onSuccess: () => { toast.success("เพิ่มพนักงานสำเร็จ"); setUserModal(false); qc.invalidateQueries({ queryKey: getListUsersQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
      });
    }
  };

  const openPromoModal = (promo?: any) => {
    if (promo) {
      setEditPromo(promo); setPromoName(promo.name); setPromoProductId(String(promo.product_id));
      setPromoBundleQty(promo.bundle_qty); setPromoBundlePrice(promo.bundle_price); setPromoActive(promo.active);
    } else {
      setEditPromo(null); setPromoName(""); setPromoProductId(""); setPromoBundleQty(0); setPromoBundlePrice(0); setPromoActive(true);
    }
    setPromoModal(true);
  };

  const handleSavePromo = () => {
    if (!promoName || !promoProductId || !promoBundleQty || !promoBundlePrice) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    const payload = { name: promoName, product_id: Number(promoProductId), bundle_qty: promoBundleQty, bundle_price: promoBundlePrice, active: promoActive } as any;
    if (editPromo) {
      updatePromo.mutate({ id: editPromo.id, data: payload }, {
        onSuccess: () => { toast.success("แก้ไขสำเร็จ"); setPromoModal(false); qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
      });
    } else {
      createPromo.mutate({ data: payload }, {
        onSuccess: () => { toast.success("เพิ่มสำเร็จ"); setPromoModal(false); qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }); },
        onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
      });
    }
  };

  const handleSheetsSettings = () => {
    updateSheets.mutate({
      data: { spreadsheet_id: sheetsId || sheetsSettings?.spreadsheet_id, service_account_json: sheetsJson || sheetsSettings?.service_account_json, auto_sync: autoSync } as any
    }, {
      onSuccess: () => { toast.success("บันทึกการตั้งค่าสำเร็จ"); qc.invalidateQueries({ queryKey: getGetSheetsSettingsQueryKey() }); },
      onError: (e: any) => toast.error(e?.data?.error ?? "ล้มเหลว"),
    });
  };

  const handleExport = () => {
    exportSheets.mutate(undefined as any, {
      onSuccess: (r: any) => toast.success(r.message ?? "ส่งออกสำเร็จ"),
      onError: (e: any) => toast.error(e?.data?.message ?? "ส่งออกล้มเหลว"),
    });
  };

  return (
    <Layout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">ตั้งค่าระบบ</h1>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">พนักงาน</TabsTrigger>
            <TabsTrigger value="promos">โปรโมชั่น</TabsTrigger>
            <TabsTrigger value="sheets">Google Sheets</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openUserModal()}><Plus className="w-4 h-4 mr-1" /> เพิ่มพนักงาน</Button>
            </div>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>สิทธิ์</TableHead>
                    <TableHead className="text-right">ค่าแรง/วัน</TableHead>
                    <TableHead>กะ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users ?? []).map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-muted-foreground">{u.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={u.role === "owner" ? "text-yellow-500 border-yellow-500/30" : "text-blue-400 border-blue-400/30"}>
                          {u.role === "owner" ? "เจ้าของ" : "พนักงาน"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{u.daily_wage ? `${u.daily_wage}฿` : "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.shift || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openUserModal(u)}><Edit2 className="h-3 w-3" /></Button>
                          {u.role !== "owner" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm("ลบพนักงาน?")) deleteUser.mutate({ id: u.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() }) }); }}><Trash2 className="h-3 w-3" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="promos" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => openPromoModal()}><Plus className="w-4 h-4 mr-1" /> เพิ่มโปรโมชั่น</Button>
            </div>
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อโปรโมชั่น</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead className="text-right">ราคาชุด</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(promotions ?? []).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ยังไม่มีโปรโมชั่น</TableCell></TableRow>
                  )}
                  {(promotions ?? []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.product_name}</TableCell>
                      <TableCell className="text-right">{p.bundle_qty}</TableCell>
                      <TableCell className="text-right text-primary font-semibold">{p.bundle_price}฿</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.active ? "text-green-500 border-green-500/30" : "text-muted-foreground border-border"}>
                          {p.active ? "เปิด" : "ปิด"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openPromoModal(p)}><Edit2 className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm("ลบโปรโมชั่น?")) deletePromo.mutate({ id: p.id }, { onSuccess: () => qc.invalidateQueries({ queryKey: getListPromotionsQueryKey() }) }); }}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="sheets" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">เชื่อมต่อ Google Sheets</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Spreadsheet ID</Label>
                  <Input className="mt-1 font-mono" placeholder={sheetsSettings?.spreadsheet_id ?? "ใส่ ID ของ Spreadsheet"} value={sheetsId} onChange={(e) => setSheetsId(e.target.value)} />
                </div>
                <div>
                  <Label>Service Account JSON</Label>
                  <Textarea className="mt-1 font-mono text-xs resize-none" rows={6} placeholder="วาง JSON ของ Service Account ที่นี่" value={sheetsJson} onChange={(e) => setSheetsJson(e.target.value)} />
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="auto-sync" checked={autoSync} onCheckedChange={setAutoSync} />
                  <Label htmlFor="auto-sync">ซิงค์อัตโนมัติ</Label>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSheetsSettings} disabled={updateSheets.isPending} variant="outline">บันทึกการตั้งค่า</Button>
                  <Button onClick={handleExport} disabled={exportSheets.isPending} className="bg-green-600 hover:bg-green-700">
                    <Upload className="w-4 h-4 mr-2" />
                    {exportSheets.isPending ? "กำลังส่งออก..." : "ส่งออกไป Google Sheets"}
                  </Button>
                </div>
                {sheetsSettings?.last_sync && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ซิงค์ล่าสุด: {new Date(sheetsSettings.last_sync).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
                  </div>
                )}
                {!sheetsSettings?.spreadsheet_id && (
                  <div className="flex items-center gap-2 text-sm text-yellow-500">
                    <AlertCircle className="w-4 h-4" />
                    ยังไม่ได้ตั้งค่า Google Sheets
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Modal */}
      <Dialog open={userModal} onOpenChange={setUserModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editUser ? "แก้ไขพนักงาน" : "เพิ่มพนักงาน"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ชื่อ-นามสกุล</Label><Input className="mt-1" value={userName} onChange={(e) => setUserName(e.target.value)} /></div>
            <div><Label>Username</Label><Input className="mt-1" value={userUsername} onChange={(e) => setUserUsername(e.target.value)} /></div>
            <div><Label>{editUser ? "รหัสผ่านใหม่ (ว่างไว้=ไม่เปลี่ยน)" : "รหัสผ่าน"}</Label><Input type="password" className="mt-1" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} /></div>
            <div>
              <Label>สิทธิ์</Label>
              <Select value={userRole} onValueChange={setUserRole}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">พนักงาน</SelectItem>
                  <SelectItem value="owner">เจ้าของ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {userRole === "employee" && (
              <>
                <div><Label>ค่าแรง/วัน (฿)</Label><Input type="number" className="mt-1" value={userWage || ""} onChange={(e) => setUserWage(Number(e.target.value))} /></div>
                <div>
                  <Label>กะ</Label>
                  <Select value={userShift} onValueChange={setUserShift}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="เช้า">เช้า</SelectItem>
                      <SelectItem value="บ่าย">บ่าย</SelectItem>
                      <SelectItem value="ดึก">ดึก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setUserModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleSaveUser} disabled={createUser.isPending || updateUser.isPending}>บันทึก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Promo Modal */}
      <Dialog open={promoModal} onOpenChange={setPromoModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editPromo ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่น"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ชื่อโปรโมชั่น</Label><Input className="mt-1" value={promoName} onChange={(e) => setPromoName(e.target.value)} /></div>
            <div>
              <Label>สินค้า</Label>
              <Select value={promoProductId} onValueChange={setPromoProductId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกสินค้า" /></SelectTrigger>
                <SelectContent>{(products ?? []).map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>จำนวนชุด</Label><Input type="number" className="mt-1" value={promoBundleQty || ""} onChange={(e) => setPromoBundleQty(Number(e.target.value))} /></div>
              <div><Label>ราคาชุด (฿)</Label><Input type="number" className="mt-1" value={promoBundlePrice || ""} onChange={(e) => setPromoBundlePrice(Number(e.target.value))} /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="promo-active" checked={promoActive} onCheckedChange={setPromoActive} />
              <Label htmlFor="promo-active">เปิดใช้งาน</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setPromoModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleSavePromo} disabled={createPromo.isPending || updatePromo.isPending}>บันทึก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
