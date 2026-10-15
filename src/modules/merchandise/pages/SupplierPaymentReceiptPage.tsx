import { receivablesModule } from "@/modules/receivables";

export default function MerchandiseSupplierPaymentReceiptPage() {
  const Page = receivablesModule.pages.SupplierReceipt;
  return <Page source="merchandise" />;
}
