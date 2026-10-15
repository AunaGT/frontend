import { receivablesModule } from "@/modules/receivables";

/** El mismo flujo de pagos sin exigir el módulo de navegación Cartera. */
export default function MerchandiseSupplierPaymentPage() {
  const Page = receivablesModule.pages.SupplierPayment;
  return <Page source="merchandise" />;
}
