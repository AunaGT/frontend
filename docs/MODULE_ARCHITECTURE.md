# Arquitectura modular del frontend

## Principio

El backend es la autoridad de módulos. `ModuleProvider` consulta `/api/modules`
para la empresa activa y separa la activación comercial de los permisos del
usuario. La UI oculta accesos no contratados y `ModuleAccessBoundary` bloquea
la navegación directa; aun así, la seguridad definitiva siempre vive en el
backend.

## Estructura objetivo

```text
src/modules/<module>/
  manifest.ts       # código, dependencias, rutas y páginas lazy
  api/              # llamadas exclusivas del módulo
  pages/
  components/
  hooks/
  tests/
```

El piloto está en `src/modules/promotions/manifest.ts`. Durante la transición
sus páginas continúan en `components/`, pero ningún consumidor nuevo debe
importarlas directamente: debe usar el manifiesto.

## Reglas

1. Toda pantalla de negocio se carga con `React.lazy`; el shell, login e inicio
   pueden permanecer en el bundle inicial.
2. El `code` debe coincidir exactamente con el registro del backend.
3. Una ruta se muestra solo si el módulo está activo **y** el usuario tiene al
   menos uno de sus permisos.
4. Ser administrador omite permisos, pero nunca activaciones comerciales.
5. Las rutas legacy se declaran en `routePrefixes` para que el boundary también
   las proteja.
6. Un módulo importa componentes compartidos desde `shared`/`ui`, no archivos
   internos de otro módulo.
7. Si algo solo sirve a un módulo, no debe colocarse en `shared`.
8. Cambiar de empresa invalida las consultas y vuelve a consultar módulos.
9. Un fallo temporal al consultar el catálogo no concede seguridad: la UI abre
   por compatibilidad, pero el backend continúa bloqueando la operación.

## Añadir un módulo

1. Crear su carpeta y `manifest.ts`.
2. Agregar la tarjeta a `config/appModules.ts`, incluidos permisos y aliases.
3. Registrar páginas mediante `lazy()`.
4. Añadir el código y dependencias en el backend.
5. Probar inicio, lanzador, URL directa, cambio de empresa y usuario sin permiso.

## Lista de comprobación

- El módulo desactivado desaparece del inicio y del lanzador.
- Una URL guardada muestra “Módulo no disponible”.
- El backend responde `403` con `code: MODULE_DISABLED`.
- Sus chunks no forman parte del bundle inicial.
- Un administrador tampoco puede entrar si la empresa no lo tiene activo.
- Activarlo nuevamente no requiere reconstruir ni reiniciar la aplicación.
