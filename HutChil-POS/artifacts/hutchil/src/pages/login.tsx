import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logoUrl from "@assets/1_20260530_040639_0000_1780092945958.png";

const loginSchema = z.object({
  username: z.string().min(1, "กรุณากรอกชื่อผู้ใช้"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: setAuthUser } = useAuth();
  const [remember, setRemember] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const loginMutation = useLogin();

  const onSubmit = (data: LoginValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        setAuthUser(res.token, res.user, remember);
        if (res.user.role === "owner") {
          setLocation("/dashboard");
        } else {
          setLocation("/sale");
        }
      },
      onError: (err) => {
        toast.error("เข้าสู่ระบบไม่สำเร็จ", {
          description: (err as any).message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        });
      }
    });
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-8">
          <img src={logoUrl} alt="HutChil Logo" className="w-24 h-24 mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">เข้าสู่ระบบ HutChil</h1>
          <p className="text-sm text-muted-foreground mt-2">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อผู้ใช้</FormLabel>
                  <FormControl>
                    <Input placeholder="Username" autoComplete="username" {...field} className="bg-input border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>รหัสผ่าน</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" autoComplete="current-password" {...field} className="bg-input border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={remember}
                onCheckedChange={(v) => setRemember(Boolean(v))}
              />
              <Label htmlFor="remember" className="cursor-pointer text-sm text-muted-foreground">
                จดจำการเข้าสู่ระบบ
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
