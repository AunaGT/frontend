const {test}=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{hookHarness}=require('./helpers/reportHookHarness.cjs')
test('numeric editor accepts intermediate digits and commits only the complete value',()=>{
  const h=hookHarness(),nodes=[],changes=[]
  const {LabelNumberInput}=loadReportModule('../inventory/barcodeLabels/BarcodeLabelProperties.tsx',{react:h.hooks},nodes)
  const render=()=>{nodes.length=0;h.render(()=>LabelNumberInput({value:9,onCommit:n=>changes.push(n),min:6,max:36}))}
  render();let input=nodes.find(n=>n.props.type==='number');input.props.onChange({target:{value:'3'}});render()
  assert.equal(changes.length,0);input=nodes.find(n=>n.props.type==='number');assert.equal(input.props.value,'3')
  input.props.onChange({target:{value:'36'}});render();nodes.find(n=>n.props.type==='number').props.onBlur();assert.deepEqual(changes,[36]);h.unmount()
})
