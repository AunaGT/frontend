const test=require('node:test'),assert=require('node:assert/strict'),{loadReportModule}=require('./helpers/loadReportModule.cjs'),{resolveBase}=require('../../deposito-backend/src/modules/config/customerPages/bases')
test('version comparison identifies changed visual properties and never prints executable code',()=>{
 const {diffPortalDesigns}=loadReportModule('../config/customerPages/historyDiff.ts'),a=resolveBase('QUOTE'),b=structuredClone(a);b.nodes[0].styles.mobile.padding=18;b.customBlocks.demo={html:'<script>secret source</script>',css:'',js:'alert(1)',fallbackText:'Hola'}
 const diff=diffPortalDesigns(a,b);assert.ok(diff.some(r=>r.path.includes('mobile.padding')&&r.after==='18'));assert.doesNotMatch(JSON.stringify(diff),/secret source|alert\(1\)/)
})
