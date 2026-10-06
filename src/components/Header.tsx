/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useState } from "react";
import { Bell, Search, Settings, User, Wine, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/useAuth";
import { useNavigate } from "react-router-dom";
import { useSystemSettings } from "@/hooks/useSystemSettings";

const Header = () => {
  const [hasAlerts, setHasAlerts] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { companyName } = useSystemSettings();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4 shadow-card">
      <div className="flex items-center justify-between">
        {/* Logo y título */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg shadow-card bg-primary text-primary-foreground">
            <Wine className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{companyName}</h1>
            <p className="text-sm text-muted-foreground"> © Sistema de Inventario todos los derechos reservados ©</p>
          </div>
        </div>

        {/* Búsqueda central */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar productos, códigos, proveedores..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="icon" 
            className="relative"
            onClick={() => setHasAlerts(false)}
          >
            <Bell className="w-4 h-4" />
            {hasAlerts && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full"></span>
            )}
          </Button>
          <Button variant="outline" size="icon">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon">
            <User className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleLogout} title="Cerrar sesión">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
