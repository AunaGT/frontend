const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('responsive inspector labels inherited controls and exposes reset without a modal',()=>{
 const {PortalInspector}=loadReportModule('../config/customerPages/PortalInspector.tsx'),node={id:'photo',type:'Image',props:{resource:'photo',caption:'Foto',focalX:30,focalY:40},styles:{desktop:{padding:32},tablet:{},mobile:{}},visibility:{},children:[]}
 const html=renderToStaticMarkup(React.createElement(PortalInspector,{node,definition:{label:'Imagen',props:{resource:'key',caption:'string',focalX:'percent',focalY:'percent'}},breakpoint:'mobile',tab:'design',onTab(){},onCommand(){},readOnly:false,resources:{photo:{assetId:'',alt:'Foto'}},onResource(){}}))
 assert.match(html,/Heredado/);assert.match(html,/Restablecer padding/);assert.match(html,/Espaciado/);assert.doesNotMatch(html,/role="dialog"/)
})
