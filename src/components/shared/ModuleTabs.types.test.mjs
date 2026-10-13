import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

test('tab items preserve literal values for typed React setters without allowing invalid values', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const file = path.join(root, 'src/components/shared/__module-tabs-typecheck.tsx')
  const source = `
    import { useState } from 'react'
    import { ModuleTabBar } from './ModuleTabs'
    export function TransferViews() {
      const [view, setView] = useState<'table' | 'cards'>('table')
      return <ModuleTabBar items={[{ value: 'table', label: '' }, { value: 'cards', label: '' }]} value={view} onValueChange={setView} ariaLabel="Vista" />
    }
    export function UserSections() {
      const tabs = [{ key: 'profile', label: 'Perfil' }, { key: 'access', label: 'Acceso' }] as const
      const [tab, setTab] = useState<'profile' | 'access'>('profile')
      return <ModuleTabBar items={tabs.map(item => ({ value: item.key, label: item.label }))} value={tab} onValueChange={setTab} ariaLabel="Secciones" />
    }
    export function StringState() {
      const [tab, setTab] = useState('ALL')
      return <ModuleTabBar items={[{ value: 'ALL', label: 'Todas' }]} value={tab} onValueChange={setTab} ariaLabel="Cartera" />
    }
    // @ts-expect-error A restricted tab list must reject unknown entries.
    const invalidItem = <ModuleTabBar<'table' | 'cards'> items={[{ value: 'unknown', label: 'Inválida' }]} value="table" onValueChange={() => {}} ariaLabel="Vista" />
    // @ts-expect-error A restricted tab list must reject unknown active values.
    const invalidValue = <ModuleTabBar<'table' | 'cards'> items={[{ value: 'table', label: 'Tabla' }]} value="unknown" onValueChange={() => {}} ariaLabel="Vista" />
  `
  const config = ts.readConfigFile(path.join(root, 'tsconfig.app.json'), ts.sys.readFile)
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host), fileExists = host.fileExists.bind(host)
  host.readFile = name => name === file ? source : readFile(name)
  host.fileExists = name => name === file || fileExists(name)
  const program = ts.createProgram([file], options, host)
  const errors = ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)
  assert.deepEqual(errors.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')), [])
})
