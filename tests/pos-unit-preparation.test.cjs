const test=require('node:test'),assert=require('node:assert/strict')
const {renderPos,product}=require('./helpers/posPageHarness.cjs'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
function fixture(){const h=require('./helpers/reportHookHarness.cjs').hookHarness();const configured={...product,price:1,kind:'STANDARD',unitValues:{price:'1',cost:'0',stock:'40',minStock:'0',priceWholesale:null,pricePromotion:null},unitConfiguration:{base_unit_id:'unit',base_unit:{id:'unit',name:'Unidad',code:'UNIT',label:'ud',quantity_decimals:0},quantity_decimals:0,unit_revision:1,default_sale_presentation_id:null,presentations:[{id:'box',name:'Caja',label:'caja',active:true,sale_enabled:true,purchase_enabled:true,version:1,factor:'3',quantity_decimals:0,prices:{LIST:'3'}}]}},other={...configured,id:'other',name:'Otro'}
 const {useCart}=loadReportModule('../sales/hooks/useCart.ts',{react:h.hooks,'@/hooks/use-toast':{useToast:()=>({toast(){}})},'@/hooks/useSystemSettings':{useSystemSettings:()=>({locale:'es-GT'})},'@/services/api':{getApiBaseUrl:()=>'/api'}}),cart=()=>h.render(()=>useCart({availableProducts:[configured,other]}))
 cart().addToCart(configured,{presentationId:null});cart().addToCart(configured,{presentationId:'box'});cart().addToCart(other,{presentationId:null})
 return{cart:cart(),products:[configured,other],close:()=>h.unmount()}
}
function response(cart){return{items:cart.cartItems.map(item=>({client_line_key:item.lineKey,preview:{qty:'1',base_qty:item.unitSelection.presentationId?'3':'1',unit_metadata_version:2,unit_revision:1,unit_price:item.unitSelection.presentationId?'3':'1',line_total:item.unitSelection.presentationId?'3.00':'1.00',unit_snapshot:item.unitSelection.snapshot}}))}}
test('POS prepares three lines including two presentations in one request before submitting once',async()=>{
 const f=fixture();let requests=0
 try{const view=renderPos({realCart:f.cart,items:f.cart.cartItems,products:f.products,unitBatchPreview:async(scope,lines)=>{requests++;assert.equal(scope.companyId,'A');assert.equal(lines.length,3);assert.equal(new Set(lines.map(l=>l.client_line_key)).size,3);return response(f.cart)}})
 await view.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();assert.equal(requests,1);assert.equal(view.writes.length,1,JSON.stringify(view.notifications));assert.equal(view.writes[0].items.length,3)
 }finally{f.close()}
})
for(const defect of ['missing','duplicate','foreign','changed-context'])test(`malformed or stale preparation ${defect} never proceeds to checkout`,async()=>{
 const f=fixture();let view,requests=0
 try{view=renderPos({realCart:f.cart,items:f.cart.cartItems,products:f.products,unitBatchPreview:async()=>{requests++;const result=response(f.cart);if(defect==='missing')result.items.pop();if(defect==='duplicate')result.items[1]=result.items[0];if(defect==='foreign')result.items[0].client_line_key='foreign';if(defect==='changed-context')view.pageRefs.reviewContext.current='changed';return result}})
 await view.nodes.find(n=>n.props.onClick?.name==='handleSubmit').props.onClick();assert.equal(requests,1);assert.equal(view.writes.length,0);assert.ok(view.notifications.some(n=>n.variant==='destructive'))
 }finally{f.close()}
})
