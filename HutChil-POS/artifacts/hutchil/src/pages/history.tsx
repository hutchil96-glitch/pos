import { Layout } from "@/components/layout";
import { useListSales } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

export default function History() {
  const { data: sales } = useListSales({});

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(amount);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">ประวัติการขาย</h1>
        
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เวลา</TableHead>
                <TableHead>พนักงาน</TableHead>
                <TableHead>สินค้า</TableHead>
                <TableHead className="text-right">จำนวน</TableHead>
                <TableHead className="text-right">ยอดรวม</TableHead>
                <TableHead>การชำระเงิน</TableHead>
                <TableHead>โปรโมชั่น</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales?.map(sale => (
                <TableRow key={sale.id}>
                  <TableCell>{new Date(sale.time).toLocaleString('th-TH')}</TableCell>
                  <TableCell>{sale.user_name}</TableCell>
                  <TableCell>
                    {sale.product_name}
                    {sale.is_gift && <Badge variant="outline" className="ml-2 text-yellow-500 border-yellow-500/50">ของแถม</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{sale.qty}</TableCell>
                  <TableCell className="text-right font-bold text-green-500">{formatMoney(sale.total)}</TableCell>
                  <TableCell>
                    <span className={sale.payment_type === 'เงินสด' ? 'text-green-500' : 'text-blue-500'}>
                      {sale.payment_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sale.promo_name || '-'}</TableCell>
                  <TableCell className="text-right">
                    {sale.locked && <Lock className="h-4 w-4 inline text-muted-foreground" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
