/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { BrandLoading } from "@/components/branding/BrandLoading";

const PrivateRoute = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return <BrandLoading fullScreen message="Verificando tu sesión…" />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.must_change_password && location.pathname !== '/cambiar-contrasena') return <Navigate to="/cambiar-contrasena" replace />;
  return <Outlet />;
};

export default PrivateRoute;
