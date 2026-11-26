# Motor Portal Studio

`@puckeditor/core` 0.23.0 fijado exactamente, licencia MIT, peer React 18/19 y Node >=20. El entorno local usa Node 22 y React 18. La publicación y su integridad se comprobaron en el registro npm antes de instalar; no se ejecutaron scripts de instalación.

Solo se utiliza el paquete local para composición/selección. No Puck Cloud, plugins remotos ni servicios de IA. El contrato persistente es Auna, con traducción explícita; el renderer visitante no importa Puck.

El iframe de preview de Puck no aísla código libre. `CustomVisual` solo recibe una referencia de bloque y se renderiza como placeholder de confianza, nunca con las fuentes HTML/CSS/JS. La ejecución requiere el servicio sandbox separado de T11.

Prueba de conversión: composición anidada, reordenación y estilos independientes preservados. Pendiente: gate visual/teclado y medición del bundle completo al terminar la integración; no equivale a prueba con navegador.
