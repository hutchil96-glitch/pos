import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetDashboardStats, useGetSalesChart, useGetTopProducts, useListShifts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CreditCard, Wallet, ShoppingBag, AlertCircle, Package } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: stats } = useGetDashboardStats();
  const { data: chartData } = useGetSalesChart({ days: 30 });
  const { data: topProducts } = useGetTopProducts();
  const { data: shifts } = useListShifts({ open: true });

  const formatMoney = (amount: number | undefined) => {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(amount || 0);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">แดชบอร์ด</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">ยอดขายวันนี้</CardTitle>
              <DollarSign className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(stats?.today_revenue)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">เงินสด</CardTitle>
              <Wallet className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(stats?.today_cash)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">เงินโอน</CardTitle>
              <CreditCard className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(stats?.today_transfer)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">กำไรสุทธิ</CardTitle>
              <DollarSign className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatMoney(stats?.net_profit)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">จำนวนรายการ</CardTitle>
              <ShoppingBag className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.today_count || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">สต็อกต่ำ</CardTitle>
              <AlertCircle className="w-4 h-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.low_stock_count || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>ยอดขายและกำไร 30 วัน</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {chartData && chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" stroke="#888" fontSize={12} />
                    <YAxis stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Legend />
                    <Area type="monotone" dataKey="revenue" name="ยอดขาย" stackId="1" stroke="#4ade80" fill="#4ade80" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="profit" name="กำไร" stackId="2" stroke="#22c55e" fill="#22c55e" fillOpacity={0.4} />
                    <Area type="monotone" dataKey="cost" name="ต้นทุน" stackId="3" stroke="#f87171" fill="#f87171" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>สินค้าขายดี</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {topProducts && topProducts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#888" fontSize={12} />
                    <YAxis dataKey="product_name" type="category" stroke="#888" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333' }} />
                    <Legend />
                    <Bar dataKey="total_qty" name="จำนวน (ชิ้น)" fill="#4ade80" />
                    <Bar dataKey="total_revenue" name="ยอดขาย (บาท)" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">ไม่มีข้อมูล</div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>กะที่กำลังเปิดอยู่</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>พนักงาน</TableHead>
                  <TableHead>กะ</TableHead>
                  <TableHead>เวลาเข้า</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts?.map(shift => (
                  <TableRow key={shift.id}>
                    <TableCell>{shift.user_name}</TableCell>
                    <TableCell>{shift.shift_type}</TableCell>
                    <TableCell>{new Date(shift.check_in_time).toLocaleString('th-TH')}</TableCell>
                    <TableCell><Badge variant="outline" className="text-green-500 border-green-500">กำลังเปิด</Badge></TableCell>
                  </TableRow>
                ))}
                {!shifts?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">ไม่มีกะที่เปิดอยู่</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
