/**
 * Copyright (c) 2026 Diego Patzán. All Rights Reserved.
 * 
 * This source code is licensed under a Proprietary License.
 * Unauthorized copying, modification, distribution, or use of this file,
 * via any medium, is strictly prohibited without express written permission.
 * 
 * For licensing inquiries: GitHub @dpatzan2
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateSupplier, uploadSupplierImage } from "@/services/supplierService";
import { SUPPLIERS_QUERY_KEY } from "@/hooks/useSuppliers";

export const useUpdateSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload, image }: { id: string; payload: Partial<Record<string, unknown>>; image?: File | null }) => {
      const contact = await updateSupplier(id, payload);
      if (!image) return contact;
      try {
        const photo = await uploadSupplierImage(id, image);
        return { ...contact, image_url: photo.image_url };
      } catch (error) {
        await qc.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
        throw Object.assign(new Error(`Los datos se guardaron, pero la foto quedó pendiente. ${error instanceof Error ? error.message : 'Intenta nuevamente.'}`), { imageUploadFailed: true });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY }),
  });
};
