import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, LayoutDashboard, ShoppingCart, Package, DollarSign, History as HistoryIcon, Users, Activity, Settings as SettingsIcon } from "lucide-react";
import logoUrl from "@assets/2_20260530_040639_0001_1780092945966.png";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  const isOwner = user.role === "owner";

  const navigation = [
    { name: "ขาย", href: "/sale", icon: ShoppingCart },
    ...(isOwner ? [
      { name: "แดชบอร์ด", href: "/dashboard", icon: LayoutDashboard },
      { name: "สต็อก", href: "/stock", icon: Package },
      { name: "ค่าใช้จ่าย", href: "/costs", icon: DollarSign },
      { name: "ประวัติ", href: "/history", icon: HistoryIcon },
      { name: "เงินเดือน", href: "/payroll", icon: Users },
      { name: "ประวัติกิจกรรม", href: "/audit", icon: Activity },
      { name: "ตั้งค่า", href: "/settings", icon: SettingsIcon },
    ] : []),
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex">
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img src={logoUrl} alt="HutChil Logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-lg text-foreground">HutChil POS</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Button
                key={item.name}
                variant={isActive ? "secondary" : "ghost"}
                className={`w-full justify-start ${isActive ? "bg-primary/20 text-primary hover:bg-primary/30" : "text-muted-foreground"}`}
                onClick={() => setLocation(item.href)}
              >
                <Icon className="mr-2 h-5 w-5" />
                {item.name}
              </Button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="text-sm text-muted-foreground mb-4 px-2">
            ผู้ใช้: {user.name}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-border bg-card flex items-center justify-end px-4 shrink-0">
          <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => logout()}>
            <LogOut className="mr-2 h-4 w-4" />
            ออกจากระบบ
          </Button>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
