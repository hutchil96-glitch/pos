import { Layout } from "@/components/layout";
import { useListAuditLogs } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Audit() {
  const { data: logs } = useListAuditLogs({});

  const getActionColor = (action: string) => {
    switch(action.toLowerCase()) {
      case 'create': return 'text-green-500 border-green-500/30';
      case 'update': return 'text-yellow-500 border-yellow-500/30';
      case 'delete': return 'text-destructive border-destructive/30';
      default: return 'text-muted-foreground border-border';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">ประวัติกิจกรรมระบบ</h1>
        
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เวลา</TableHead>
                <TableHead>ผู้ใช้</TableHead>
                <TableHead>การกระทำ</TableHead>
                <TableHead>ส่วน</TableHead>
                <TableHead>รายละเอียด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{new Date(log.time).toLocaleString('th-TH')}</TableCell>
                  <TableCell className="font-medium">{log.user_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionColor(log.action)}>
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.entity}</TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground" title={log.description || ''}>
                    {log.description || '-'}
                  </TableCell>
                </TableRow>
              ))}
              {!logs?.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">ไม่มีประวัติกิจกรรม</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
