import { lazy } from "react";
export const customerPageRoutes = [
  {
    key: "library",
    path: "/configuracion/paginas-clientes",
    Page: lazy(() => import("../pages/CustomerPagesPage")),
    permissions: [
      "customer_pages.view",
      "customer_pages.manage",
      "customer_pages.publish",
      "customer_pages.code",
    ],
  },
  {
    key: "create",
    path: "/configuracion/paginas-clientes/nueva",
    Page: lazy(() => import("../pages/CustomerPageCreatePage")),
    permissions: ["customer_pages.manage"],
  },
  {
    key: "editor",
    path: "/configuracion/paginas-clientes/:id/editar",
    Page: lazy(() => import("../pages/CustomerPageEditorPage")),
    permissions: [
      "customer_pages.view",
      "customer_pages.manage",
      "customer_pages.publish",
      "customer_pages.code",
    ],
  },
  {
    key: "preview",
    path: "/configuracion/paginas-clientes/:id/vista-previa",
    Page: lazy(() => import("../pages/CustomerPagePreviewPage")),
    permissions: [
      "customer_pages.view",
      "customer_pages.manage",
      "customer_pages.publish",
      "customer_pages.code",
    ],
  },
  {
    key: "history",
    path: "/configuracion/paginas-clientes/:id/historial",
    Page: lazy(() => import("../pages/CustomerPageHistoryPage")),
    permissions: [
      "customer_pages.view",
      "customer_pages.manage",
      "customer_pages.publish",
      "customer_pages.code",
    ],
  },
] as const;
