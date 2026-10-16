# Auna — propuesta funcional para Configuración

Fecha: 15 de octubre de 2026. Estado: arquitectura funcional aprobada por el usuario. La ejecución requiere revisar el plan técnico de cada entrega; las ampliaciones opcionales no están aprobadas automáticamente.

## 1. Objetivo y alcance

Convertir Configuración en el lugar donde una empresa adapta Auna a su operación, sin convertirlo en otro módulo operativo ni duplicar pantallas existentes.

En este documento, **global significa para la empresa activa**, no para todas las empresas que utilizan Auna. Los ajustes de la plataforma, conexiones a base de datos, claves, límites de seguridad y tareas técnicas no son preferencias editables por sus clientes.

Aclaración del usuario, 15 de octubre de 2026: el modelo de despliegue previsto es **una instancia de Supabase por cliente contratado**, con varias empresas del mismo cliente dentro de esa instancia. Empresa no equivale a cliente contratado. Mantener preferencias y permisos por empresa no implica crear instalaciones diferentes para cada empresa ni compartir automáticamente sus reglas. No se introduce en esta reorganización una capa de preferencias comunes a toda la instalación; requeriría necesidades y reglas de herencia explícitas.

La revisión se basa en el código local. No se consultaron valores reales de cada empresa ni se validaron estas pantallas en el navegador. Los valores predeterminados mencionados no necesariamente son los valores guardados de una empresa.

## 2. Alternativas y recomendación

1. **Centro único con accesos contextuales — recomendado.** Configuración organiza las reglas por tema/módulo. Cada módulo puede ofrecer “Configuración” y abrir la misma sección canónica. Los registros operativos y sus catálogos naturales permanecen en su módulo.
2. Todo dentro de Configuración. Facilita encontrar un acceso inicial, pero mezcla reglas, registros y operaciones; termina siendo un formulario demasiado grande.
3. Toda la configuración distribuida por módulo. Es contextual, pero dificulta descubrir reglas compartidas y favorece formularios duplicados.

La primera opción permite que un usuario llegue desde Inventario, Ventas o Agenda y edite exactamente la misma configuración, con los mismos permisos y validaciones.

## 3. Navegación propuesta

Mantener `/configuracion` como entrada y permitir enlaces directos a sus secciones. Los nombres siguientes son una propuesta de navegación, no rutas ya implementadas.

- **Empresa y preferencias generales:** identidad, información regional y preferencias compartidas de documentos.
- **Facturación e impuestos:** datos fiscales, habilitación FEL y estado de la integración.
- **Pagos y cobros:** métodos de pago disponibles para la empresa.
- **Por módulo:** Inventario; Ventas y POS; Cotizaciones; Pedidos; Devoluciones; Caja y cierres; Compras y proveedores; Cartera; Agenda; Contabilidad; Recursos humanos y Nómina; otras secciones solo cuando tengan ajustes reales.
- **Módulos y accesos:** activación de módulos; acceso al administrador existente de usuarios y roles, sin duplicarlo.

Usar navegación lateral por grupos y un buscador de ajustes de ancho contenido, no veinte pestañas horizontales. Ejemplos de búsqueda: “días de devolución”, “billetes”, “servicios”, “vigencia de cotización”. En móvil, selector de sección o navegación desplegable.

Cada sección tendrá una explicación breve, campos relacionados y su propio “Guardar cambios”. Mostrar cuándo existen cambios sin guardar, errores junto a los campos y el efecto de una regla antes de guardarla. No agregar botones de guardar que no persistan nada ni controles cuyo backend no aplique el valor.

Conservar el lenguaje visual de Auna: ancho de contenido contenido, formularios compactos, componentes e iconos existentes, sin grandes encabezados duplicados. En oscuro, paneles elevados respecto al fondo; no superficies negras que parezcan agujeros. Estadísticas solo en catálogos donde aporten información, no en cada formulario de ajustes.

## 4. Qué hacer con Datos maestros

El módulo actual contiene cuatro apartados, no un conjunto indefinido de catálogos:

| Actual | Destino recomendado | Motivo |
| --- | --- | --- |
| Categorías | Inventario → Categorías | Se administran junto a productos; conservar vínculos con proveedores y promociones. |
| Cajas | Configuración → Caja y cierres → Cajas | Son puntos de cobro por sucursal. Abrir/cerrar turnos sigue siendo operativo. |
| Métodos de pago | Configuración → Pagos y cobros | Los utilizan ventas, devoluciones, cartera y pagos a proveedores. |
| Términos de pago | Configuración → Compras y proveedores → Condiciones de pago | Actualmente corresponden a proveedores/entradas de mercancía, no a condiciones de crédito de clientes. |

**Sí puede desaparecer del menú principal**, pero no se deben borrar de golpe sus tablas, API, permisos o identificadores. Primero reubicar los accesos y reutilizar los formularios existentes; después ocultar su entrada independiente.

Preservar importación, exportación, filtros, paginación, bajas/restauración y referencias históricas. Extraer los paneles incrustados en la pantalla actual a componentes reutilizables, sin mantener dos copias del mismo formulario.

Conservar compatibilidad con `/datos-maestros`, `/catalogos`, sus pestañas y sus rutas de importación mediante redirecciones que mantengan la sección y el tipo de importación. No eliminar `/api/catalogs` solo por cambiar el menú. La retirada definitiva de compatibilidad sería una decisión posterior.

## 5. Reubicar lo que ya existe

| Ajuste existente | Sección propuesta |
| --- | --- |
| Nombre y logo de empresa | Empresa → Identidad |
| Moneda, zona horaria, idioma/formato regional y fecha | Empresa → Información regional |
| Vender servicios | Inventario → Bienes y servicios |
| Perfil de experiencia del POS, permitir crédito, mostrar campos fiscales y canales | Ventas y POS → Experiencia de venta |
| Datos fiscales y habilitación FEL | Facturación e impuestos |
| Denominaciones de efectivo y tolerancia de diferencia | Caja y cierres |
| Vigencia de cotizaciones y reserva temporal | Cotizaciones |
| Vigencia de pedidos | Pedidos |
| Tipos/documentación de expedientes de empleados | Recursos humanos |
| Activación de módulos | Módulos y accesos |
| Cuentas contables predeterminadas | Contabilidad, reutilizando su editor actual |
| Profesionales, salas/equipos, calendarios y configuración de servicios | Acceso a la configuración existente de Agenda |
| Diseños de códigos de barras y etiquetas de precios | Inventario → Impresión, reutilizando sus editores |

No cambiar los valores existentes por nuevos predeterminados durante la reorganización. El nombre/logo y los datos fiscales deben mantener su sincronización con la entidad Empresa; no crear una segunda identidad independiente para reportes.

## 6. Cobertura por módulo

Leyenda: **existente** = ya tiene configuración o formulario reutilizable; **parcial** = hay soporte en código, pero falta exposición o alcance correcto; **propuesto** = necesita comportamiento nuevo y aprobación de sus reglas, no solo un campo.

| Área | Primera entrega / reutilización | Ampliación razonable, no comprometida automáticamente |
| --- | --- | --- |
| Inventario | Existente: servicios, categorías y diseños de impresión. Parcial: ventanas de alertas de vencimiento. | Valores iniciales para nuevos productos, solo si no reemplazan la configuración individual. |
| Ventas y POS | Existente: crédito, experiencia, visibilidad fiscal y canales. | Preferencias de impresión/ticket; reglas de descuentos autorizados, si se implementa su validación real. |
| Cotizaciones | Existente: vigencia y duración de reserva temporal. | Texto comercial predeterminado para documentos nuevos, conservando el contenido aceptado de los anteriores. |
| Pedidos | Existente: vigencia. Corregir antes su lectura por empresa. | Condiciones predeterminadas de entrega/reserva cuando el flujo las soporte. |
| Devoluciones | Parcial: política por empresa ya aplicada por backend; falta formulario. | Políticas diferenciadas por categoría/tipo de servicio únicamente en una fase posterior. |
| Caja y cierres | Existente: denominaciones, tolerancia y cajas por sucursal. | Mensajes y autorizaciones de diferencias, sin convertir tolerancia en aprobación automática. |
| Mercancía / compras | Existente: condiciones de pago de proveedores. | Valores iniciales de recepción y avisos documentales, respetando requisitos por producto. |
| Cartera | Reutilizar métodos de pago y condiciones de proveedores, con accesos desde cobrar/pagar. | Política de crédito de clientes, recordatorios y límites, con aplicación en ventas y no solo en Cartera. |
| Contactos | Mantener información, clasificación y condiciones particulares en cada contacto. | Valores iniciales para contactos nuevos cuando exista una necesidad real. No duplicar la configuración de crédito. |
| Agenda | Existente: calendarios, profesionales, recursos, disponibilidad y perfiles de servicio. | Plantillas para servicios nuevos; jamás sobrescribir perfiles configurados. Mantener reuniones/eventos sin servicio obligatorio. |
| Promociones | Existente: diseño y reglas por promoción. | Plantilla inicial opcional para nuevas promociones; el diseño personalizado sigue siendo por promoción. |
| Recursos humanos | Existente: expedientes/documentación. | Calendarios laborales y políticas de ausencias cuando se definan sus efectos en Agenda/Nómina. |
| Nómina | Parcial: lector de `payroll.rates` por empresa, sin editor completo de configuración. | Editor validado de parámetros y vigencias; requiere trazabilidad y protección de nóminas ya pagadas. |
| Contabilidad | Existente: cuentas predeterminadas y configuración fiscal. Unificar datos fiscales compartidos. | Versionado/vigencia de reglas sensibles; no permitir cambios que reinterpreten asientos históricos. |
| Conteos de inventario | Conservar el flujo actual de conteo y ajuste. | Motivos o umbrales de autorización si se implementa el circuito de aprobación correspondiente. |
| Traslados | Conservar restricciones de origen/destino y permisos. | Justificaciones o confirmaciones adicionales solo con validación en ambos extremos del traslado. |
| Sucursales | Mantener sucursales, almacenes y ubicaciones en su módulo. | Excepciones por sucursal únicamente para reglas que lo necesiten y tengan consumidor real. |
| Usuarios y roles | Acceso al administrador existente; mantener protección de admin y alcance de empresa. | Preferencias personales separadas de reglas empresariales; no crear otro editor de permisos. |
| Alertas | Compartir la política de vencimiento con Inventario. | Suscripciones/preferencias personales; envío externo requiere proveedor e implementación adicional. |
| Reportes | Reutilizar identidad de empresa y formatos mejorados. Enlaces a preferencias compartidas de impresión. | Preferencias de exportación compatibles con cada formato; CSV no tiene papel ni diseño de página. |
| Analítica | Heredar moneda, fechas y zona horaria de la empresa. | Filtros predeterminados por usuario; no crear una sección vacía de configuración empresarial. |
| Datos maestros | Reubicar sus cuatro apartados y preservar compatibilidad. | Retirar el menú solo cuando todos los accesos y permisos estén cubiertos. |
| Configuración | Navegación, búsqueda, permisos y guardado coherente por sección. | Agregar nuevas secciones solo cuando exista un caso de uso, no una por cada módulo obligatoriamente. |

## 7. Devoluciones: primera regla que conviene exponer

La política **ya se guarda por empresa** en `returns.policy` y el backend la utiliza. No hace falta inventar otra configuración. Su valor predeterminado de plazo es 30 días; se debe mostrar el valor guardado de la empresa activa.

Formulario propuesto:

- Plazo válido, en días enteros positivos.
- Permitir excepciones autorizadas fuera del plazo.
- Resoluciones habilitadas: reembolso al medio original, efectivo, transferencia, saldo a favor o cambio.
- Precio para un cambio: precio original o precio actual, según las opciones del dominio existente.

Mostrar ejemplos de efecto y una advertencia al cambiar la regla. La excepción seguirá exigiendo el permiso `returns.override_policy` y una justificación; activar la opción no concede ese permiso.

Preservar inicialmente el cálculo actual por períodos de 24 horas y su límite (`daysElapsed > windowDays`), y documentarlo sin ambigüedad. Una regla distinta por días calendario sería un cambio de negocio adicional. Probar el límite y el primer período que lo supera. No ofrecer cero, “ilimitado” ni desactivar todas las resoluciones mientras el contrato actual no lo soporte: una lista vacía actualmente vuelve a las resoluciones predeterminadas.

Los documentos completados no se recalculan. Antes de completar una devolución pendiente debe revalidarse la política aplicable y explicarse cualquier cambio. Si se necesita conservar la regla original por documento, introducir una versión/copia de política explícita; no asumir que ya existe.

Una devolución de servicio no genera recepción ni reposición física. Ninguna preferencia debe saltarse límites de devolución, permisos de caja, validación de fondos o trazabilidad contable.

## 8. Hallazgos que deben resolverse antes de ampliar ajustes

### 8.1 Vigencia de pedidos sin alcance de empresa

`defaultOrderValidUntil(client)` consulta los ajustes comerciales sin recibir `companyId`; sus llamadas desde Pedidos tampoco lo pasan. Es un riesgo confirmado en código de mezclar preferencias entre empresas, no una fecha incorrecta observada en la base.

Exigir empresa en la lectura y sus consumidores, con prueba de dos empresas con vigencias diferentes. No basta con reubicar el campo en una nueva pantalla.

### 8.2 Métodos de pago compartidos entre empresas

El modelo actual de métodos de pago no tiene `company_id` y sus operaciones son globales. Mover su formulario no convierte los datos en privados de cada negocio.

Recomendación: conservar identidades/semánticas base y referencias históricas; separar disponibilidad y preferencias por empresa. Una empresa no debe poder renombrar, eliminar o cambiar el comportamiento financiero de un método que utiliza otra. Definir por separado cómo se soportarían métodos personalizados. Validar disponibilidad también en ventas, devoluciones y cobros/pagos, no solo en el listado.

No copiar métodos masivamente ni reescribir referencias de ventas/pagos como efecto lateral de la reorganización. Este punto requiere un diseño de datos y compatibilidad antes de implementarse.

### 8.3 Nómina: parámetros con lector, sin administración completa

Existe `payroll.rates`, utilizado por el cálculo, pero no está expuesto en el formulario ni admitido por la lista actual de ajustes generales editables. Incluye conceptos de contribuciones, bonificaciones, retenciones, horas extra y provisiones.

Agregar escritura validada y autorizada, ayuda comprensible, fechas de vigencia y trazabilidad. No presentar valores de código como normativa legal vigente: los valores deben verificarse y aprobarse por el responsable del negocio. No recalcular nóminas pagadas ni afirmar que ya existe un historial de versiones sin implementarlo.

### 8.4 Vencimiento de lotes fijo en código

La generación de alertas usa una ventana de 30 días y un umbral de prioridad de 7 días. Estos sí son candidatos reales a parámetros de negocio. Deben compartir una única política Inventario/Alertas, con umbral crítico no mayor que el de aviso, aplicada al contexto de cada empresa.

La tarea actual procesa lotes de forma global: al introducir preferencias por empresa, debe resolver explícitamente la política correspondiente a cada lote. Su frecuencia técnica y mecanismos de protección de carga no se convierten en campos para el cliente.

## 9. Datos, alcance y seguridad

### Dónde guardar cada cosa

- Preferencias/reglas de empresa: conservar `SystemSetting` y sus claves existentes cuando corresponda, con contratos específicos y validación. No crear un editor libre de JSON o de claves arbitrarias.
- Cajas, categorías, condiciones de pago, profesionales y recursos: conservar sus entidades y relaciones. No convertir registros en grandes documentos de preferencias.
- Reglas particulares de producto, servicio o contacto: conservarlas en su entidad; los valores predeterminados de empresa no deben reemplazarlas retroactivamente.
- Tema visual, densidad, preferencias de listado y filtros personales: almacenamiento por usuario, claramente separado de reglas compartidas. El sistema actual no debe darse por hecho que ya guarda todas estas preferencias.
- Sucursal: excepciones explícitas donde aporten valor, no una infraestructura universal de herencia para cada campo.

### Guardado y permisos

- Guardar por sección de forma atómica: validar todo antes de escribir; no dejar nombre actualizado y logo/fiscalidad sin actualizar por un error parcial.
- Evitar sobrescrituras entre usuarios con comprobación de versión o actualización esperada y un aviso de conflicto.
- Al cambiar de empresa: avisar por cambios sin guardar, limpiar el borrador y descartar respuestas tardías de la empresa anterior.
- El servidor resuelve empresa y autorización; no confiar en un identificador elegido en el formulario.
- Auditar ajustes sensibles: quién, empresa, fecha y valores anterior/nuevo, sin registrar secretos. Definir retención y soporte antes de ofrecer restauración general.
- Invalidar cachés y refrescar consumidores después de guardar; distinguir “no configurado” de “no se pudo cargar”.
- Conservar permisos actuales por dominio. Un usuario autorizado para catálogos debe poder llegar a su sección sin obtener por ello `settings.manage`; los ajustes generales siguen protegidos.
- Si se añaden permisos más específicos, migrarlos explícitamente y sin concederlos automáticamente. No activar módulos como consecuencia de mover un formulario.
- Un módulo inactivo puede mostrar un acceso informativo al administrador autorizado, sin habilitar operaciones ni eludir su disponibilidad real.

### Límites importantes

No exponer claves de Supabase/certificadores en formularios comunes ni en respuestas públicas de ajustes. Para futuras credenciales FEL, diseñar almacenamiento de secretos y respuestas redactadas; no basta con agregar campos de texto a `SystemSetting`.

La activación de facturación no equivale a tener un certificador conectado. Mostrar el estado real y conservar la factura pendiente cuando corresponda. No generar una apariencia de certificación legal sin integración.

Cambiar moneda o régimen fiscal con operaciones existentes requiere restricciones y explicación: no convierte importes históricos ni recalcula impuestos. No introducir conversión monetaria implícita. Mantener coherencia entre interfaz, documentos y cálculos.

Los cierres de períodos, cierres anuales, saldos iniciales, apertura/cierre de turnos y pagos son **operaciones**, no preferencias; permanecen en sus módulos con sus controles.

## 10. Fases propuestas

### Fase 0 — contratos y seguridad de alcance

Inventariar claves, lectores/escritores, permisos y valores existentes. Resolver la lectura comercial por empresa. Acordar y probar la compatibilidad de métodos de pago por empresa. Definir guardado por sección y comportamiento al cambiar de empresa. No mover destructivamente datos para mejorar navegación.

Aceptación: dos empresas pueden tener preferencias diferentes sin interferencia; no se pierden configuraciones ni referencias históricas; quedan definidos los contratos que cada pantalla usará.

### Fase 1 — reorganizar lo existente

Construir la navegación del centro de Configuración. Reagrupar campos actuales. Reutilizar paneles y accesos de Agenda, Contabilidad e impresión. Mover categorías a Inventario y los otros tres catálogos a sus secciones. Mantener enlaces antiguos e importaciones. Ocultar Datos maestros del menú al completar esa cobertura.

Aceptación: todo lo que hoy puede administrarse sigue disponible, sin duplicación de formularios, sin cambios de valores ni elevación de permisos.

### Fase 2 — exponer reglas respaldadas por comportamiento

Primero, formulario de política de devoluciones. Después, ventana/prioridad de vencimientos por empresa. Finalmente, parámetros de nómina con validación, vigencia y protección del histórico. Unificar fiscalidad compartida entre Configuración y Contabilidad sin duplicar fuentes.

Aceptación: cada ajuste produce un efecto comprobable en su operación; validaciones y permisos se aplican también por API. No se modifican documentos completados.

### Fase 3 — ampliar solo según necesidades aprobadas

Priorizar entre preferencias de documentos nuevos, plantillas iniciales, reglas de crédito/descuentos y recordatorios. Cada opción debe tener su propia definición de negocio, consumidor, permisos, pruebas y compatibilidad. No implementar todo el catálogo de ideas por agregar casillas.

### Fase 4 — validación transversal y cierre

Probar rutas antiguas/nuevas, importaciones, edición, permisos por sección, navegación con módulos desactivados, guardado concurrente, empresa activa, cachés y datos históricos. Revisar claro, oscuro y móvil cuando el navegador esté autorizado. Documentar claves y decisiones para nuevas instalaciones y semillas idempotentes.

## 11. Casos mínimos de aceptación

1. Dos empresas con vigencias distintas crean pedidos/cotizaciones usando solo su propia configuración.
2. Una empresa modifica métodos disponibles sin cambiar los de otra; pagos históricos siguen legibles.
3. Un gestor de categorías conserva acceso tras la reubicación, pero no obtiene administración fiscal.
4. Cambiar de empresa con un formulario abierto no guarda datos ni respuestas tardías en la empresa equivocada.
5. Un error de validación no produce un guardado parcial; un conflicto de edición no sobrescribe silenciosamente.
6. Devolución dentro/fuera del límite, excepción permitida/prohibida, permiso ausente y motivo vacío: resultados consistentes entre pantalla y API.
7. Ventanas de lotes distintas generan avisos distintos por empresa, sin duplicar políticas en Alertas.
8. Parámetros de nómina nuevos no alteran una nómina pagada ni se aceptan sin permisos.
9. Categorías conservan productos/proveedores/promociones relacionados; importación/exportación y enlaces previos funcionan.
10. Diseños guardados de impresión y cupones personalizados permanecen intactos; no se vuelve a pedir el diseño en cada impresión.
11. Desactivar un módulo no permite operar entrando por su enlace de Configuración.
12. Moneda/fiscalidad cambian solo con las restricciones definidas; reportes y ventas históricas no se reinterpretan.

## 12. Referencias de código revisadas

Rutas relativas a sus respectivos repositorios:

- Frontend: `src/modules/config/pages/ConfigManagement.tsx`, `src/services/settingsService.ts`.
- Frontend: `src/modules/catalogs/pages/CatalogsManagement.tsx`, componentes de cajas/métodos de pago e importación.
- Frontend: `src/modules/appointments/pages/AgendaSettingsPage.tsx`, `src/modules/accounting/components/SettingsTab.tsx`.
- Backend: `src/services/companySettings.js`, `src/modules/config/controller.js`, `src/modules/config/routes.js`.
- Backend: `src/services/commercialDocumentSettings.js`, `src/modules/orders/controller.js`.
- Backend: `src/modules/returns/domain.js`, `src/services/returnPolicy.js`.
- Backend: `src/services/payroll/rates.js`, `src/services/lots.js`.
- Backend: `src/modules/catalogs/paymentMethods.controller.js`, `prisma/schema.prisma`.
- Backend: `src/services/accounting/core.js`, `src/modules/inventory/barcodeLabels/layouts.js`.

## 13. Decisión para aprobar el alcance

El usuario aprobó la arquitectura: Configuración como centro único, accesos contextuales al mismo editor, categorías en Inventario y retirada gradual del menú Datos maestros. Después se revisará el alcance concreto de cada entrega y su plan técnico. Las ampliaciones marcadas como propuestas no quedan autorizadas por aceptar únicamente la reorganización.

La primera entrega técnica es una parte de la fase 0: aislamiento de las vigencias comerciales y guardado atómico del PATCH de ajustes existente. Tendrá un plan independiente en `docs/superpowers/plans/2026-10-15-configuracion-base-segura.md`. No se considerará completada toda la fase 0 al terminar esa entrega: la compatibilidad de métodos de pago y el ciclo de borradores por empresa requieren sus propias entregas antes de reubicar los formularios afectados.

Esta revisión no modificó el producto, permisos, módulos, procesos ni la base de datos. Solo se añadió esta propuesta documental.

Actualización de ejecución, 15 de octubre de 2026: la primera entrega técnica fue aprobada e implementada. Se corrigieron las vigencias comerciales por empresa y el PATCH de ajustes quedó validado y atómico. No se completó toda la fase 0 ni se reorganizaron pantallas. Resultados y pendientes en `docs/planning/2026-10-15-configuracion-base-segura-verificacion.md`.

Continuación, 15 de octubre de 2026: métodos de pago por empresa desplegados en la Supabase de desarrollo existente; evidencia en `docs/planning/2026-10-15-metodos-pago-por-empresa-verificacion.md`. El siguiente bloque, centro de Configuración y ciclo de borradores, tiene diseño técnico aprobado en `docs/superpowers/specs/2026-10-15-centro-configuracion-design.md` y plan en `docs/superpowers/plans/2026-10-15-centro-configuracion.md`, pendiente de revisión y confirmación de ejecución. Estos enlaces no marcan implementada la nueva navegación.
