# Cierre de pendientes de Configuración

Fecha: 16 de octubre de 2026. Solicitud: «termina todo los pendientes entonces».

Estado: implementación funcional cerrada y verificada el16-10-2026, con vigencia por fecha de pago y autorización conjunta `settings.manage`/`payroll.confirm`. Dos migraciones aplicadas a la Supabase de desarrollo; revisión independiente y una pasada de correcciones verificadas. B incluye el refinamiento explícito de un único marco exterior. La comprobación visual autenticada sigue pendiente por la preferencia de navegador bloqueada; no se certifica Storage real ni normativa. Evidencia y decisiones: `docs/planning/2026-10-16-cierre-configuracion-verificacion.md`. Continúa la arquitectura aprobada en `docs/planning/2026-10-15-configuracion-por-modulo-propuesta.md`.

## Objetivo y límites

Cerrar vencimientos por empresa, parámetros de nómina con vigencias y protección del histórico, guardados simultáneos, historial de ajustes, diseño B y verificación transversal. Corregir también el caso API pendiente y los 11 errores TypeScript conocidos. No agregar opciones comerciales de la fase 3, certificadores FEL, nuevas políticas legales ni recuperación automática de ajustes antiguos.

Una instancia/Supabase corresponde a un cliente contratado y puede contener varias empresas relacionadas. Cada política pertenece a la empresa activa. Mantener los permisos por dominio y las carpetas/rama actuales. Usar únicamente la Supabase de desarrollo existente; sin otra staging, reseteos ni cambio de credenciales.

## 1. Vencimientos de Inventario y Alertas

Una clave empresarial `inventory.expiry_alert_policy`, con `warningDays` y `highPriorityDays`. Predeterminados compatibles: 30 y 7. Decisión propuesta: enteros seguros, `1 <= warningDays <= 3650` y `0 <= highPriorityDays <= warningDays`. El máximo limita rangos accidentales, no representa una norma legal.

El editor vive en Inventario dentro del centro, con explicación y ejemplo. No duplicar campos en Alertas. La sincronización existente resuelve por empresa antes de consultar sus lotes y antes de resolver alertas: nunca resolver las de otra empresa porque su ventana sea menor. Lote vencido sigue siendo Crítica; dentro del umbral próximo, Alta; resto dentro de aviso, Media. Cantidad cero no genera alerta. Servicios no participan en lotes.

Conservar el día UTC que hoy utiliza esta tarea; cambiarlo a días locales sería una regla adicional. Conservar throttle/frecuencia técnica fuera del formulario. Fallo de lectura no equivale a política predeterminada: no cerrar alertas si no se pudo conocer la regla. Una política ausente sí adopta 30/7. Guardar solicita sincronización compatible con el throttle; la interfaz distingue guardado de la posterior actualización de avisos.

## 2. Nómina con vigencia y copia del cálculo

Reutilizar los 15 parámetros de `src/services/payroll/rates.js`; no inventar tasas nuevas ni afirmar que son las legalmente vigentes. Agrupar aportes, ISR, horas extra y provisiones. Porcentajes visibles como porcentaje, almacenados como fracción; importes con moneda empresarial; campos numéricos estrictos, sin coerciones de booleanos/arrays/objetos. Decisión propuesta: tasas entre 0 y 1, importes entre 0 y 10^12, factor de horas extra positivo y no mayor de 10. El responsable del negocio valida sus valores.

Decisión propuesta de vigencia: **fecha de pago de la corrida (`pay_date`)**, por coherencia con el lector/cálculo y clasificación actuales. Cada publicación requiere fecha de inicio y motivo. No modifica por sí sola una corrida existente ni un empleado. Se elige la última versión no cancelada cuyo inicio sea igual o anterior a esa fecha.

Tabla empresarial `PayrollRateVersion`: id, empresa, inicio (DATE), tasas JSON completas, motivo, autor/fecha y eventual cancelación con motivo/autor/fecha. Una versión vigente o pasada es inmutable. Se puede cancelar una futura aún no aplicada y publicar su reemplazo; nunca editar silenciosamente su contenido. Serializar publicaciones por empresa para impedir dos versiones activas en la misma fecha. No se ofrecen fechas retroactivas en el editor.

La ausencia de versiones conserva la lectura actual `payroll.rates` y sus predeterminados. Al publicar la primera versión, guardar una base identificada como «configuración heredada capturada», sin inventar autor, fecha de cambios ni leyes históricas. Desde entonces el lector fechado usa esa base para fechas anteriores a las publicaciones. No cambiar la antigua clave como si describiera todas las vigencias.

Agregar a `PayrollRun` una copia nullable de las tasas efectivamente usadas y la referencia de su versión. Crear un borrador fija esa copia dentro de la transacción. Recalcular un borrador conserva la copia; un cambio explícito «Actualizar parámetros del borrador» muestra diferencias, requiere confirmación y vuelve a calcular de forma atómica. Confirmar/pagar nunca vuelve a leer tasas nuevas. Una corrida antigua sin copia no recibe una reconstrucción ficticia: conservar sus recibos y señalar su procedencia histórica; solo un borrador puede adoptar explícitamente una copia al recalcular.

El endpoint de recalcular también reclama/bloquea la corrida para no competir con confirmar/pagar. Nóminas confirmadas/pagadas no admiten cambio de copia ni recálculo. Mantener anticipos, redondeos y asientos existentes. `bonificacionIncentivo` de la política es valor inicial para empleados nuevos únicamente cuando no se envía uno: enlazar ese consumidor hoy fijo en 250, sin cambiar empleados existentes.

Propuesta de permisos para confirmar: lectura de esta política requiere `settings.view`/`settings.manage`, `payroll.view` y acceso al módulo activo de Nómina; publicar/cancelar requiere **`settings.manage` y `payroll.confirm`**, pues afecta las reglas que autorizan un cálculo, no basta con crear borradores. No existe un permiso `payroll.manage`, no se inventa ni se concede uno automáticamente. Copias en detalles de corrida siguen el permiso actual de consulta de nómina. La política se sirve por su endpoint protegido de Nómina, no se añade a respuestas públicas ni se filtra mediante el GET general a usuarios sin acceso al dominio.

## 3. Guardado concurrente e historial

Agregar revisión entera por fila `SystemSetting` y tabla append-only `SettingAuditEvent`, ambas con migración aditiva. Una revisión es del registro real; clave ausente tiene revisión 0. Trigger PostgreSQL incrementa la revisión al cambiar valor/tipo, incluso si escribe otro editor existente. No aumenta revisión ni crea evento por guardar lo mismo.

GET privado agrega metadatos de revisiones sin cambiar el objeto de valores existente; nunca incluirlos en GET público. PATCH del centro requiere `expectedRevisions` para todas las claves admitidas enviadas: rechazo explicativo si falta, y 409 si difieren. Comparación y escritura condicional son atómicas; insertar una clave ausente también comprueba que siga ausente. Un conflicto en una clave revierte toda la sección y el espejo Company. Cambios en secciones distintas no deben provocar conflictos innecesarios.

La protección propuesta cubre **todos los editores de esas configuraciones**, no solo el centro: el espejo de identidad desde Empresas, logo y cuentas contables deben leer/enviar sus revisiones y comprobarlas dentro de su transacción. Conservar permisos propios de cada endpoint. No se pretende versionar campos operativos ajenos a Configuración, por ejemplo teléfono o estado de una empresa. Los diseños de impresión conservan su revisión de JSON y bloqueo ya existentes; no se reemplaza una protección válida por otra innecesaria, pero sus cambios sí se auditan. Se adaptan lectores, formularios y pruebas de esos contratos, sin dejar una vía antigua que sobrescriba silenciosamente los mismos ajustes.

El formulario guarda revisiones junto a los valores confirmados y envía solo las de su sección. Tras guardar, actualiza únicamente valores/revisiones de esa sección: no asociar una revisión nueva de otra sección a un valor local antiguo. Un 409 conserva el borrador y permite consultar/recargar solo esa sección, confirmando su descarte y preservando otros borradores. No auto-reintentar ni imponer el borrador viejo al servidor. Conservar protecciones A→B→A, permisos, pending y errores accesibles.

El trigger audita únicamente claves de negocio explícitamente permitidas: preferencias conocidas, políticas, cuentas contables y diseños de impresión. No registrar valores de claves desconocidas, secretos, credenciales ni tokens. Evento: empresa, clave, revisión anterior/nueva, antes/después, usuario cuando se conoce, fecha y origen. Retención propuesta: sin borrado automático dentro de la vida de la empresa; sin restauración automática. Eventos sin actor por semillas/operaciones previas se muestran como sistema/no disponible, no se atribuyen a un usuario ficticio.

Los escritores de Configuración, logo, espejo desde Empresas, cuentas contables y diseños de impresión fijan autor/origen en su transacción. La auditoría de cambios de clave es transaccional; una operación revertida no deja un falso éxito. Mantener separadas las operaciones de Storage: no prometer que el trigger revierte un archivo subido. No auditar módulos o expedientes como si fueran preferencias JSON; conservan sus registros propios.

En logo, un conflicto de revisión no elimina la imagen confirmada: limpiar únicamente el objeto nuevo de la operación fallida si pertenece a esa subida y el borrado es seguro; si falla esa limpieza, reportarlo sin fingir rollback de Storage. La eliminación del objeto anterior solo ocurre tras confirmar la referencia nueva. En el historial, cuentas contables, diseños y Nómina aplican los permisos de su editor además del permiso de lectura general; no revelar sus valores por una vía de historial más abierta.

Historial de ajustes en el centro: consulta paginada y por sección/clave, con nombres comprensibles, quién/cuándo y diferencias. Solo usuarios autorizados para leer esos ajustes de la empresa; ocultar claves fuera de su permiso. Sin edición ni borrado de eventos desde la UI.

## 4. B · Espacio integrado

Referencia elegida: `/home/DiegoPatzan/Documents/CODE/Auna/.superpowers/brainstorm/23007-1792158179/propuesta-b-claro.jpg` y decisión en `decision.md` del mismo directorio.

Navegación lateral y contenido pertenecen a una superficie continua que llega al fondo del área de trabajo; no una barra flotando centrada y corta. Buscador contenido en la navegación, iconos Auna existentes, agrupaciones y estado activo nítidos, sin nuevo encabezado gigante ni duplicar la cabecera general de la aplicación. Identidad empresarial discreta al pie. En móvil, selector/menú accesible sin desplazar horizontalmente la página.

Refinamiento explícito del usuario durante implementación: un solo marco exterior. Dentro, formularios y tablas planos, sin contenedores decorativos anidados; agrupar mediante espacio y separadores, conservando los bordes propios de controles y mensajes de validación.

Reutilizar editores, controles, ayudas, guardado por sección, enlaces canónicos de catálogos y permisos actuales. Añadir Vencimientos, Nómina e Historial sin mostrar secciones vacías. Formularios compactos con ancho legible; no estirarlos a todo el viewport. Claro/oscuro con tokens semánticos y superficies elevadas: oscuro no debe crear «agujeros» más negros que el fondo. Foco visible y nunca oculto tras acciones persistentes. Respetar ampliación y movimiento reducido. La maqueta es referencia, no prueba de la aplicación real.

## 5. Compatibilidad, despliegue y comprobación

Aplicar migraciones aditivas en la Supabase de desarrollo actual y regenerar Prisma; comprobar estado y conectividad sin imprimir credenciales. No resetear, volver a sembrar datos falsos masivamente ni crear otra instancia. No inventar metadatos históricos para registros existentes. Si se requiere detener/reiniciar, únicamente procesos Auna identificados, preservando su forma actual de arranque.

Pruebas de dos empresas, conflictos reales, rollback de eventos, límites numéricos/fecha, versiones futuras/canceladas, copia pagada inalterada, cambios de contexto y catálogos. Ejecutar suites completas de ambos repositorios, fronteras de módulos, TypeScript y build. Semilla idempotente solo añade la política de vencimientos faltante; no sustituye reglas actuales ni cambia permisos.

La preferencia guardada bloquea navegador en localhost:8080. No rodearla con otros hosts/puertos/superficies. La certificación visual/autenticada seguirá pendiente hasta que se revoque; una captura estática o prueba con dobles no la sustituye.

## Decisiones propuestas para confirmar

- Vigencia de nómina por fecha de pago; tasas ya calculadas se congelan y la adopción en borradores es explícita.
- Auditoría de ajustes permitidos, sin borrado automático ni restauración; editores privados pasan a exigir revisión esperada.
- Publicar/cancelar tasas exige `settings.manage` y `payroll.confirm`; los cambios de configuración quedan protegidos también desde Empresas/logo/Contabilidad y los diseños conservan su control ya implementado.
- Límites de entrada descritos arriba, sin venderlos como límites legales.
- Alcance: cierre definido aquí, no ampliaciones opcionales de todos los módulos ni certificación del historial importado de devoluciones.

## Comprobación del diseño

Un lector independiente contrastó el diseño y los escritores existentes. Sus dos preguntas importantes fueron la inexistencia de `payroll.manage` y el alcance del control concurrente fuera del centro. Ambas quedan explícitas arriba como propuestas para confirmación del usuario; no se ha modificado autorización ni persistencia de esas áreas antes de confirmarlas.
