import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetPayrollSummary,
  useListPayroll,
  useCreatePayroll,
  useListUsers,
  getListPayrollQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

const PAYROLL_TYPES = ["เงินเดือน", "โบนัส", "เบิกล่วงหน้า", "ปรับ"];

function getMonthRange(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${new Date(y, d.getMonth() + 1, 0).getDate()}` };
}

export default function Payroll() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isOwner = user?.role === "owner";

  const [monthOffset, setMonthOffset] = useState(0);
  const { from, to } = getMonthRange(monthOffset);

  const { data: summary } = useGetPayrollSummary({ date_from: from, date_to: to });
  const { data: payrollLogs } = useListPayroll({});
  const { data: allUsers } = useListUsers();

  const createPayroll = useCreatePayroll();

  const [modal, setModal] = useState(false);
  const [selUserId, setSelUserId] = useState<string>("");
  const [amount, setAmount] = useState(0);
  const [payType, setPayType] = useState("เบิกล่วงหน้า");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");

  const employees = (allUsers ?? []).filter((u: any) => u.role === "employee");

  const handleSubmit = () => {
    if (!selUserId || !amount) { toast.error("กรุณากรอกข้อมูลให้ครบ"); return; }
    createPayroll.mutate({
      data: { user_id: Number(selUserId), amount, type: payType, note: payNote || undefined, date: payDate } as any
    }, {
      onSuccess: () => {
        toast.success("บันทึกสำเร็จ");
        setModal(false);
        setAmount(0); setPayNote(""); setSelUserId("");
        qc.invalidateQueries({ queryKey: getListPayrollQueryKey() });
      },
      onError: (e: any) => toast.error(e?.data?.error ?? "บันทึกล้มเหลว"),
    });
  };

  const formatMoney = (v?: number) => (v ?? 0).toLocaleString("th-TH");

  const monthName = (offset: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
  };

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold">จัดการเงินเดือน</h1>
          <Button onClick={() => setModal(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" /> บันทึกรายการ
          </Button>
        </div>

        {isOwner && (
          <Tabs defaultValue="summary">
            <TabsList>
              <TabsTrigger value="summary">สรุปรายเดือน</TabsTrigger>
              <TabsTrigger value="logs">รายการทั้งหมด</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setMonthOffset((m) => m - 1)}>‹ ก่อนหน้า</Button>
                <span className="font-medium">{monthName(monthOffset)}</span>
                <Button variant="outline" size="sm" onClick={() => setMonthOffset((m) => m + 1)} disabled={monthOffset >= 0}>ถัดไป ›</Button>
              </div>

              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead className="text-right">วันทำงาน</TableHead>
                      <TableHead className="text-right">ค่าจ้าง/วัน</TableHead>
                      <TableHead className="text-right">รวมได้</TableHead>
                      <TableHead className="text-right">เบิกแล้ว</TableHead>
                      <TableHead className="text-right font-bold">คงค้าง</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(summary ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ไม่มีข้อมูล</TableCell></TableRow>
                    )}
                    {(summary ?? []).map((s: any) => (
                      <TableRow key={s.user_id}>
                        <TableCell className="font-medium">{s.user_name}</TableCell>
                        <TableCell className="text-right">{s.days_worked}</TableCell>
                        <TableCell className="text-right">{formatMoney(s.daily_wage)}</TableCell>
                        <TableCell className="text-right text-green-500">{formatMoney(s.total_earned)}฿</TableCell>
                        <TableCell className="text-right text-destructive">{formatMoney(s.total_advances)}฿</TableCell>
                        <TableCell className="text-right font-bold">
                          <span className={s.net_payable >= 0 ? "text-green-500" : "text-destructive"}>
                            {s.net_payable >= 0 ? "+" : ""}{formatMoney(s.net_payable)}฿
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="logs">
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>พนักงาน</TableHead>
                      <TableHead>ประเภท</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(payrollLogs ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">ยังไม่มีรายการ</TableCell></TableRow>
                    )}
                    {(payrollLogs ?? []).map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.date}</TableCell>
                        <TableCell>{p.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.type === "เบิกล่วงหน้า" ? "text-destructive border-destructive/30" : "text-green-500 border-green-500/30"}>
                            {p.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${p.type === "เบิกล่วงหน้า" ? "text-destructive" : "text-green-500"}`}>
                          {p.type === "เบิกล่วงหน้า" ? "-" : "+"}{formatMoney(p.amount)}฿
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={p.status === "approved" ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                            {p.status === "approved" ? "อนุมัติ" : "รอ"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.note || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {!isOwner && (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payrollLogs ?? []).filter((p: any) => p.user_id === user?.id).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">ยังไม่มีรายการ</TableCell></TableRow>
                )}
                {(payrollLogs ?? []).filter((p: any) => p.user_id === user?.id).map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date}</TableCell>
                    <TableCell>{p.type}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMoney(p.amount)}฿</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={p.status === "approved" ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                        {p.status === "approved" ? "อนุมัติ" : "รอ"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>บันทึกรายการเงินเดือน</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {isOwner && (
              <div>
                <Label>พนักงาน</Label>
                <Select value={selUserId} onValueChange={setSelUserId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกพนักงาน" /></SelectTrigger>
                  <SelectContent>{employees.map((u: any) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>ประเภท</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(isOwner ? PAYROLL_TYPES : ["เบิกล่วงหน้า"]).map((t) => (
                  <button key={t} className={`px-3 py-1 rounded-full border text-sm transition-colors ${payType === t ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground"}`} onClick={() => setPayType(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div><Label>จำนวน (฿)</Label><Input type="number" className="mt-1" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} /></div>
            <div><Label>วันที่</Label><Input type="date" className="mt-1" value={payDate} onChange={(e) => setPayDate(e.target.value)} /></div>
            <div><Label>หมายเหตุ</Label><Textarea className="mt-1 resize-none" rows={2} value={payNote} onChange={(e) => setPayNote(e.target.value)} /></div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal(false)}>ยกเลิก</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={createPayroll.isPending}>บันทึก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
