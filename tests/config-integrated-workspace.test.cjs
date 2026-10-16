const test=require('node:test'),assert=require('node:assert/strict'),{renderConfig}=require('./helpers/configViewHarness.cjs')
test('integrated settings workspace exposes its content region, company footer and real module icons',()=>{
  const {html,nodes}=renderConfig({section:'ventas'})
  assert.match(html,/role="region"[^>]*aria-labelledby="config-section-title"/)
  assert.match(html,/id="config-section-title"[^>]*>Ventas y POS/)
  assert.match(html,/config-navigation-identity/);assert.match(html,/Empresa A/)
  assert.match(html,/aria-current="page"/);assert.match(html,/config-nav-icon/)
  assert.ok(nodes.some(n=>n.props.type==='search'&&n.props.onChange))
  assert.doesNotMatch(html,/Centro de ajustes|Espacio integrado|Me gusta esta dirección/)
})
test('workspace navigation stretches with content and keeps mobile layout shrinkable without sticky controls',async()=>{
  const fs=require('node:fs'),{root}=await require('postcss')().process(fs.readFileSync(require('node:path').join(__dirname,'../src/modules/config/pages/config.css'),'utf8'),{from:undefined})
  const props=selector=>{const result={};root.walkRules(rule=>{if(rule.selector===selector&&!rule.parent.params)rule.walkDecls(d=>result[d.prop]=d.value)});return result}
  assert.equal(props('.config-center')['align-items'],'stretch')
  assert.equal(props('.config-navigation')['flex-direction'],'column')
  assert.equal(props('.config-navigation-identity')['margin-top'],'auto')
  assert.equal(props('.config-center-content')['min-width'],'0')
  assert.notEqual(props('.config-section-actions').position,'fixed')
})
test('a single workspace frame contains flat forms and embedded tables, not nested card frames',async()=>{
  const fs=require('node:fs'),{root}=await require('postcss')().process(fs.readFileSync(require('node:path').join(__dirname,'../src/modules/config/pages/config.css'),'utf8'),{from:undefined})
  for(const selector of ['.config-center-content .config-panel','.config-center-content .auna-data-table-shell']){
    const props={};root.walkRules(rule=>{if(rule.selector===selector)rule.walkDecls(d=>props[d.prop]=d.value)})
    assert.equal(props.border,'0');assert.equal(props['border-radius'],'0');assert.equal(props.background,'transparent');assert.equal(props['box-shadow'],'none')
  }
})
