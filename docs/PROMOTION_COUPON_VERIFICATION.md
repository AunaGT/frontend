# Editor de cupones por promoción

## Uso

En crear/editar una promoción, abre **Diseño del cupón** junto a su vista previa. Agrega campos vinculados, texto, formas o imágenes. Arrastra/redimensiona, usa flechas (Shift para un paso mayor) o cambia porcentajes en Propiedades. Las capas tienen orden, bloqueo, visibilidad y duplicado cuando corresponde. Deshacer/rehacer conserva hasta 50 cambios.

Puedes cambiar fondo, tipografía, colores, bordes, opacidad y condiciones adicionales. Restaurar vuelve a la plantilla original en el borrador. Cerrar el editor conserva el borrador; **Guardar promoción** lo persiste. Cancelar una promoción con cambios del diseño pide confirmación y retira solo imágenes temporales propias.

La exportación usa el diseño guardado. Al abrir Códigos se seleccionan los códigos activos; sin selección no descarga. Imprime 4 cupones por hoja A4 horizontal o 2 por hoja A4 vertical. El PDF y el SVG consumen las mismas líneas, posiciones, fuentes, recortes y capas. Texto vectorial y degradado nativo, sin captura de pantalla.

## Límites y seguridad

30 elementos, 5 imágenes únicas por diseño, 5 MB por imagen PNG/JPG/WebP. El servidor verifica el contenido, limita 20 millones de píxeles, elimina metadatos y normaliza a WebP de hasta 2400×2400. Bucket privado `promotion-coupons`; URLs firmadas por una hora. Borradores temporales duran 24 horas y admiten 10 recursos para permitir reemplazos. Guardado/limpieza comparten bloqueos y no borran imágenes referenciadas. Un recurso DELETING no puede reclamarse.

Código, beneficio y restricciones aplicables deben permanecer visibles. La impresión rechaza texto desbordado, ilegible, caracteres incompatibles y campos obligatorios tapados. Las condiciones visuales no cambian el cálculo ni el canje de promociones.

## Despliegue de staging (12 octubre 2026)

Migración exacta: `202610120001_promotion_coupon_design`. Ensayada en un esquema aislado y retirado en `finally`. Backup privado verificado en `/home/DiegoPatzan/.local/share/auna-backups/coupons-vhZ1gp/staging-public.dump` (directorio 0700, archivo 0600). Antes/después: 11 promociones, 133 códigos, 8 usos. No se desplegaron migraciones ajenas ni se recalcularon datos. Bucket creado privado; no se modificaron otros buckets. Cliente Prisma generado.

## Evidencia y aceptación

Pruebas de contrato FE/BE, Sharp real, rechazo de recursos ajenos, reserva/claim concurrentes con barreras, preservación de actualizaciones sin diseño, estado/historial, SVG real, hook de scope y formulario de edición. PDFs reales de 9 códigos en ambos tamaños; contenido extraído con Poppler y primera/última página inspeccionadas.

Ejercicio real de staging: carga privada, claim, reapertura idéntica, reemplazo, conservación al actualizar solo active, restauración null y rechazo entre empresas. Se retiraron exclusivamente usuario/empresa/promoción/códigos/objetos QA creados por la prueba. No se modificaron datos de usuarios existentes.

Revisión independiente: seis hallazgos importantes corregidos con pruebas RED→GREEN (alfa WebP real, oclusión por línea, movimiento con teclado, contexto de empresa, beneficio fijo de combo y contraste con opacidad). También se verificó el recorte de trazos en el límite físico del cupón mediante píxeles de un PDF renderizado. Sin revisión independiente repetida: las regresiones y la suite completa verifican las correcciones.

Concurrencia real: prueba en un esquema PostgreSQL aislado observó el bloqueo asesor en espera; la limpieza esperó al claim y conservó el recurso vinculado. Reservar DELETING impidió reclamarlo. Se retiró el esquema QA exacto al terminar. Storage es una frontera simulada en esta prueba, no se borraron imágenes reales.

Verificación: FE 482/482, BE 394/394; fronteras de 22 módulos frontend y 96 checks backend, lint local, build y `git diff --check` correctos. Tipado: 11 errores previos fuera de Promociones, ninguno en este cambio. Además: zoom al 200% probado con el rectángulo expandido, PDF de WebP normalizado renderizado e inspeccionado y guardas de vigencia probadas contra una fecha que permanece almacenada.

Los recursos QA se eliminaron; una imagen existente en la empresa PRIN pertenece al usuario y se conservó. No se hicieron commits, push ni PR. No se detectó un proceso backend local en este entorno para reiniciar: el cliente fue regenerado y el backend debe arrancar/reiniciarse con su proceso habitual para cargar las rutas/servicios nuevos.

Retoques menores diferidos: avisar antes de subir un fondo si ya existen cinco imágenes distintas (el contrato/reducer rechazan la sexta referencia); definir retención de imágenes de promociones eliminadas lógicamente, que por ahora se conservan.

Pendiente aceptación manual del editor: temas claro/oscuro, móvil, foco, touch, mouse, zoom y comparación en pantalla. No se autorizó navegador automatizado; SSR no acredita geometría real. Impresión física no probada. El chequeo de tipos mantiene errores previos fuera de Promociones; no deben ocultarse ni atribuirse a este editor.
