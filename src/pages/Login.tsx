/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useEffect, useState } from "react";
import { useLogin } from "@/hooks/useLogin";
import { Button } from "@/components/ui/button";
import { IconInput } from "@/components/ui/icon-input";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AunaBrand } from "@/components/branding/AunaBrand";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Lock, Mail } from "lucide-react";
import { getCompanyNamePublic } from "@/services/settingsService";
import { applyDocumentBranding } from "@/utils/documentBranding";
import { CompanyLogo } from "@/components/branding/CompanyLogo";

const Login = () => {
  const { mutateAsync, isPending, error } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [companyName, setCompanyName] = useState("Auna");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");

  useEffect(() => {
    getCompanyNamePublic()
      .then((company) => {
        setCompanyName(company.company_name);
        setCompanyLogoUrl(company.company_logo_url ?? "");
        applyDocumentBranding({
          companyName: company.company_name,
          companyLogoUrl: company.company_logo_url,
        });
      })
      .catch(() => {
        applyDocumentBranding({ companyName: "Auna" });
      });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutateAsync({ email: email.trim(), password: password.trim() });
  };

  return (
    <AuthLayout>
      <AunaBrand className="mb-10 lg:hidden" logoClassName="w-32" />

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_-35px_rgba(23,32,51,0.35)] sm:p-9 dark:border-border dark:bg-card">
        <div className="mb-8 flex items-center gap-4">
          <CompanyLogo
            src={companyLogoUrl}
            size="lg"
            fallback={companyName.slice(0, 1) || "A"}
            className="rounded-2xl shadow-sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-orange">Bienvenido de vuelta</p>
            <h2 className="truncate text-2xl font-semibold tracking-tight text-brand-navy dark:text-foreground">
              {companyName}
            </h2>
          </div>
        </div>

        <div className="mb-7">
          <h1 className="text-3xl font-semibold tracking-tight text-brand-navy dark:text-foreground">
            Inicia sesión
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ingresa tus credenciales para acceder a tu espacio de trabajo.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <IconInput
            label="Correo electrónico"
            icon={Mail}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@empresa.com"
            disabled={isPending}
            required
          />

          <IconInput
            label="Contraseña"
            icon={Lock}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ingresa tu contraseña"
            disabled={isPending}
            required
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            }
          />

          {error && (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              No pudimos iniciar sesión. Revisa tus credenciales e inténtalo nuevamente.
            </div>
          )}

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-brand-orange text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.85)] hover:bg-brand-orange-strong focus-visible:ring-brand-orange"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden="true" />
                Ingresando...
              </>
            ) : (
              <>
                Ingresar
                <ArrowRight aria-hidden="true" />
              </>
            )}
          </Button>
        </form>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <img src="/auna/isotipo-192.png" alt="" className="h-4 w-4" />
        <span>Protegido por Auna ERP</span>
      </div>
    </AuthLayout>
  );
};

export default Login;
