/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/services/api";

export const PAYMENT_METHODS_QUERY_KEY = ["payment-methods"] as const;

export interface PaymentMethod {
  id: number;
  name: string;
  /** Venta al crédito: no entra dinero, genera cuenta por cobrar. */
  is_credit?: boolean;
}

const fetchPaymentMethods = async (): Promise<PaymentMethod[]> => {
  return apiFetch<PaymentMethod[]>("/catalogs/payment-methods");
};

export const usePaymentMethods = () => {
  return useQuery({
    queryKey: PAYMENT_METHODS_QUERY_KEY,
    queryFn: fetchPaymentMethods,
    staleTime: 60 * 1000,
  });
};
