import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'

const server = await createServer({
  configFile: false,
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('../../', import.meta.url)) } },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})
try {
  const { ImageUploadDropzone } = await server.ssrLoadModule('/src/components/ui/image-upload-dropzone.tsx')
  const html = renderToStaticMarkup(createElement(ImageUploadDropzone, {
    onFileSelect() {},
    accept: '.xlsx,.xls,.csv',
    maxSizeBytes: 10 * 1024 * 1024,
    fileLabel: 'archivo',
    formatsLabel: 'XLSX, XLS o CSV',
  }))

  assert.match(html, /Arrastra un archivo o haz clic aquí/)
  assert.match(html, /XLSX, XLS o CSV · máx\. 10 MB/)
  assert.match(html, /aria-label="Seleccionar archivo"/)
  assert.match(html, /Elegir archivo/)
  assert.match(html, /border-dashed/)

  const imageHtml = renderToStaticMarkup(createElement(ImageUploadDropzone, { onFileSelect() {} }))
  assert.match(imageHtml, /Arrastra una imagen o haz clic aquí/)
  assert.match(imageHtml, /PNG, JPG, WebP · máx\. 5 MB/)
} finally {
  await server.close()
}
