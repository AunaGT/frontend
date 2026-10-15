import { useEffect, useRef, useState } from "react";
import {
  createSupplierPayment,
  fetchPayableSelection,
} from "../api/payablesService";
import type {
  PayableEntry,
  PaymentApplication,
  SupplierPaymentInput,
  SupplierReceipt,
} from "../api/payablesTypes";
export function cents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw Error("Indica un monto válido con hasta dos decimales");
  const [whole, part = ""] = value.split(".");
  const n = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  if (!Number.isSafeInteger(n)) throw Error("Monto fuera de rango");
  return n;
}
export const decimal = (n: number) => (n / 100).toFixed(2);
export type DraftContext = {
  companyId: string;
  branchId: string;
  userId: string;
  currencyCode: string;
  timezone: string;
  entries: PayableEntry[];
};
export function useSupplierPaymentDraft(context: DraftContext) {
  const key = JSON.stringify([
      context.companyId,
      context.branchId,
      context.userId,
      context.currencyCode,
    ]),
    currentKey = useRef(key);
  currentKey.current = key;
  const [selected, setSelected] = useState(context.entries),
    [amount, setAmountState] = useState(""),
    [applications, setApplications] = useState<Record<string, string>>({}),
    [method, setMethodState] = useState(""),
    [paidAt, setPaidAtState] = useState(new Date().toISOString()),
    [reference, setReferenceState] = useState(""),
    [notes, setNotesState] = useState(""),
    [reviewing, setReviewing] = useState(false),
    [busy, setBusy] = useState(false),
    [ambiguous, setAmbiguous] = useState(false),
    [error, setError] = useState(""),
    [receipt, setReceipt] = useState<SupplierReceipt | null>(null);
  const flight = useRef(false),
    attempt = useRef<SupplierPaymentInput | null>(null),
    uncertain = useRef(false);
  const storageKey = "auna:supplier-payment-pending:" + key;
  const initialEntries = useRef(context.entries);
  initialEntries.current = context.entries;
  useEffect(() => {
    setSelected(initialEntries.current);
    setAmountState("");
    setApplications({});
    setReviewing(false);
    setBusy(false);
    setAmbiguous(false);
    setError("");
    setReceipt(null);
    flight.current = false;
    attempt.current = null;
    uncertain.current = false;
    try {
      const saved =
        typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(storageKey)
          : null;
      if (saved) {
        const value = JSON.parse(saved) as {
          payload: SupplierPaymentInput;
          entries: PayableEntry[];
        };
        attempt.current = value.payload;
        uncertain.current = true;
        setAmbiguous(true);
        setReviewing(true);
        setSelected(value.entries);
        setAmountState(value.payload.amount);
        setMethodState(String(value.payload.paymentMethodId));
        setPaidAtState(value.payload.paidAt);
        setReferenceState(value.payload.reference || "");
        setNotesState(value.payload.notes || "");
        setApplications(
          Object.fromEntries(
            value.payload.applications.map((a) => [a.incomingId, a.amount]),
          ),
        );
        setError(
          "Hay un pago pendiente de confirmar. Recupera la misma solicitud antes de registrar otro.",
        );
      }
    } catch {
      setError(
        "No se pudo recuperar la solicitud. Revisa el historial del proveedor antes de registrar otro pago.",
      );
      uncertain.current = true;
      setAmbiguous(true);
    }
  }, [key, storageKey]);
  useEffect(
    () => () => {
      currentKey.current = "unmounted";
    },
    [],
  );
  const edit = (fn: () => void) => {
    if (flight.current || uncertain.current || receipt) return;
    attempt.current = null;
    setReviewing(false);
    setError("");
    fn();
  };
  const setAmount = (v: string) => edit(() => setAmountState(v)),
    setMethod = (v: string) => edit(() => setMethodState(v)),
    setPaidAt = (v: string) => edit(() => setPaidAtState(v)),
    setReference = (v: string) => edit(() => setReferenceState(v)),
    setNotes = (v: string) => edit(() => setNotesState(v)),
    setApplication = (id: string, v: string) =>
      edit(() => setApplications((a) => ({ ...a, [id]: v })));
  const distribute = () =>
    edit(() => {
      try {
        let remaining = cents(amount);
        const a: Record<string, string> = {};
        for (const r of [...selected].sort(
          (a, b) =>
            (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
            a.date.localeCompare(b.date) ||
            a.id.localeCompare(b.id),
        )) {
          const n = Math.min(
            remaining,
            r.balance === null ? 0 : cents(r.balance),
          );
          a[r.id] = decimal(n);
          remaining -= n;
        }
        setApplications(a);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  const build = (): SupplierPaymentInput => {
    if (context.branchId === "all" || !context.branchId)
      throw Error("Selecciona una sucursal para registrar el pago");
    if (
      !selected.length ||
      selected.length > 100 ||
      new Set(selected.map((r) => r.supplierId)).size !== 1
    )
      throw Error("Selecciona entradas de un solo proveedor");
    if (!method || !Number.isInteger(Number(method)))
      throw Error("Selecciona el medio de pago");
    const apps: PaymentApplication[] = selected.flatMap((r) => {
      const n = cents(applications[r.id] || "0");
      if (r.excluded || r.balance === null || n > cents(r.balance))
        throw Error(
          "El saldo cambió o requiere revisión. Actualiza y revisa la distribución",
        );
      return n
        ? [
            {
              incomingId: r.id,
              amount: decimal(n),
              expectedRevision: r.revision,
            },
          ]
        : [];
    });
    const total = cents(amount);
    if (
      total <= 0 ||
      total > 999999999999 ||
      apps.reduce((n, a) => n + cents(a.amount), 0) !== total
    )
      throw Error(
        "La distribución debe cubrir el monto exacto, sin diferencia ni exceder saldos",
      );
    if (!paidAt || Number.isNaN(new Date(paidAt).getTime()))
      throw Error("Indica una fecha válida");
    return {
      requestKey: crypto.randomUUID(),
      supplierId: selected[0].supplierId,
      amount: decimal(total),
      currencyCode: context.currencyCode,
      paidAt: new Date(paidAt).toISOString(),
      paymentMethodId: Number(method),
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      applications: apps,
    };
  };
  const review = () => {
    if (flight.current || uncertain.current) return;
    try {
      attempt.current = build();
      setReviewing(true);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const confirm = async () => {
    if (flight.current || !attempt.current || receipt) return;
    const payload = attempt.current,
      scope = key;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      if (typeof sessionStorage !== "undefined")
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({ payload, entries: selected }),
        );
      const result = await createSupplierPayment(payload);
      if (currentKey.current !== scope) return;
      if (typeof sessionStorage !== "undefined")
        sessionStorage.removeItem(storageKey);
      uncertain.current = false;
      setAmbiguous(false);
      setReceipt(result);
    } catch (e) {
      if (currentKey.current !== scope) return;
      const failure = e as Error & { status?: number };
      setError(failure.message);
      if (!failure.status || failure.status >= 500) {
        uncertain.current = true;
        setAmbiguous(true);
      } else {
        if (typeof sessionStorage !== "undefined")
          sessionStorage.removeItem(storageKey);
        attempt.current = null;
        uncertain.current = false;
        setAmbiguous(false);
        setReviewing(false);
      }
    } finally {
      if (currentKey.current === scope) {
        flight.current = false;
        setBusy(false);
      }
    }
  };
  const refresh = async () => {
    if (flight.current || uncertain.current) return;
    const scope = key;
    setBusy(true);
    try {
      const rows = await fetchPayableSelection(selected.map((r) => r.id));
      if (currentKey.current === scope) {
        setSelected(rows);
        attempt.current = null;
        setReviewing(false);
        setError(
          "Saldos actualizados. Revisa la distribución antes de confirmar.",
        );
      }
    } catch (e) {
      if (currentKey.current === scope) setError((e as Error).message);
    } finally {
      if (currentKey.current === scope) setBusy(false);
    }
  };
  let difference: string | null = null;
  try {
    difference = decimal(
      cents(amount || "0") -
        Object.values(applications).reduce((n, v) => n + cents(v || "0"), 0),
    );
  } catch {
    /* shown at review */
  }
  return {
    selected,
    amount,
    applications,
    method,
    paidAt,
    reference,
    notes,
    difference,
    setAmount,
    setMethod,
    setPaidAt,
    setReference,
    setNotes,
    setApplication,
    distribute,
    review,
    confirm,
    refresh,
    busy,
    ambiguous,
    error,
    receipt,
    reviewing,
    canConfirm: reviewing && !busy && !receipt,
    locked: busy || ambiguous || !!receipt,
  };
}
