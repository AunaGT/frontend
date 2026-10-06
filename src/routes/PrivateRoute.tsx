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
import { HomeLoadingPage } from "@/components/layout/HomeLoadingPage";

const PrivateRoute = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Keep the entry layout stable, without mounting private content before /auth/me resolves.
  if (isLoading) {
    return <HomeLoadingPage />;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.must_change_password && location.pathname !== '/cambiar-contrasena') return <Navigate to="/cambiar-contrasena" replace />;
  return <Outlet />;
};

export default PrivateRoute;
