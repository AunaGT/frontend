/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState, useEffect } from "react";
import { useLogin } from "@/hooks/useLogin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail } from "lucide-react";
import { getCompanyNamePublic } from "@/services/settingsService";
import { applyDocumentBranding } from "@/utils/documentBranding";
import { CompanyLogo } from "@/components/branding/CompanyLogo";

const Login = () => {
  const { mutateAsync, isPending, error } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("Auna");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  useEffect(() => {
    getCompanyNamePublic().then((d) => {
      setCompanyName(d.company_name);
      setCompanyLogoUrl(d.company_logo_url ?? "");
      applyDocumentBranding({
        companyName: d.company_name,
        companyLogoUrl: d.company_logo_url,
      });
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  await mutateAsync({ email: email.trim(), password: password.trim() });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="items-center space-y-3">
          <CompanyLogo src={companyLogoUrl} size="lg" fallback={companyName.slice(0, 1) || "A"} />
          <CardTitle className="text-center text-2xl">{companyName}</CardTitle>
          <p className="text-sm text-muted-foreground text-center">Accede a tu cuenta</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="pl-9"
                required
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="pl-9"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">Credenciales inválidas o error de red.</p>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground/70">
        <img src="/auna/isotipo-192.png" alt="" className="h-4 w-4 opacity-70" />
        <span>Powered by Auna</span>
      </div>
    </div>
  );
};

export default Login;
