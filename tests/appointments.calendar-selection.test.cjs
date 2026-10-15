const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('arrastre inverso preserva tramo y clic propone30min en hora real',()=>{
  const {selectionRange}=loadReportModule('../appointments/calendarSelection.ts')
  assert.deepEqual(selectionRange({day:'2030-01-01',anchorMinutes:660,endMinutes:600,timezone:'America/Guatemala'}),{date:'2030-01-01',startsAt:'2030-01-01T16:00:00.000Z',endsAt:'2030-01-01T17:00:00.000Z',timezone:'America/Guatemala'})
  assert.equal(selectionRange({day:'2030-01-01',anchorMinutes:585,endMinutes:585,timezone:'America/Guatemala'}).endsAt,'2030-01-01T16:15:00.000Z')
  assert.throws(()=>selectionRange({day:'2026-03-08',anchorMinutes:150,endMinutes:150,timezone:'America/New_York'}),/no existe/)
})
function calendar() {
  const nodes=[],selected=[]
  const {AgendaCalendar}=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes)
  renderToStaticMarkup(React.createElement(AgendaCalendar,{sessions:[],view:'day',date:'2030-01-01',timezone:'America/Guatemala',onDay(){},onOpen(){},onSelect:s=>selected.push(s)}))
  const column=nodes.find(n=>n.props.className==='agenda-day-column')
  const target={getBoundingClientRect:()=>({top:100,bottom:700,left:0,right:500,width:500,height:600}),setPointerCapture(){},releasePointerCapture(){},dataset:{}}
  const event={pointerType:'mouse',button:0,pointerId:1,clientX:100,clientY:205,target,currentTarget:target,preventDefault(){},stopPropagation(){}}
  return {column,event,target,selected}
}
test('doble clic abre sin servicio a09:45, una sola vez',()=>{
  const {column,event,selected}=calendar()
  column.props.onDoubleClick(event);column.props.onDoubleClick(event)
  assert.equal(selected.length,1);assert.equal(selected[0].startsAt,'2030-01-01T15:45:00.000Z')
})
test('rango se confirma al soltar; cancelación y salida no crean actividad',()=>{
  const {column,event,selected}=calendar()
  column.props.onPointerDown(event);column.props.onPointerMove({...event,clientY:325});column.props.onPointerCancel(event);column.props.onPointerUp({...event,clientY:325})
  assert.equal(selected.length,0)
  column.props.onPointerDown(event);column.props.onPointerMove({...event,clientY:325});column.props.onPointerUp({...event,clientY:325})
  assert.equal(selected.length,1);assert.equal(selected[0].endsAt,'2030-01-01T17:45:00.000Z')
})
test('teclado abre creación y clic en control no dispara selección de fondo',()=>{
  const {column,event,selected}=calendar()
  column.props.onDoubleClick({...event,target:{closest:()=>({})}});assert.equal(selected.length,0)
  column.props.onKeyDown({...event,key:'Enter'});assert.equal(selected.length,1)
})
test('ajuste de duración propone confirmación y no abre creación de fondo',()=>{
  const nodes=[],resizes=[]
  const {AgendaCalendar}=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes)
  const row={id:'a',recordType:'ACTIVITY',serviceName:'Show',mode:'INDIVIDUAL',status:'SCHEDULED',startsAt:'2030-01-01T15:00Z',endsAt:'2030-01-01T16:00Z',occupiedFrom:'2030-01-01T14:30Z',occupiedUntil:'2030-01-01T16:30Z',conflicts:[],providerIds:[],resourceIds:[]}
  renderToStaticMarkup(React.createElement(AgendaCalendar,{sessions:[row],view:'day',date:'2030-01-01',timezone:'America/Guatemala',onOpen(){},onDay(){},onMove(){},onResize:(...args)=>resizes.push(args)}))
  assert.ok(nodes.some(n=>n.props['data-resize']))
  nodes.find(n=>n.props.className==='agenda-day-columns').props.ref.current={getBoundingClientRect:()=>({top:0,left:0,right:400,bottom:600,width:400,height:600})}
  const button=nodes.find(n=>n.type==='button'&&n.props.onPointerDown),target={dataset:{},getBoundingClientRect:()=>({top:30}),setPointerCapture(){}}
  const e={pointerType:'mouse',button:0,pointerId:1,clientX:100,clientY:120,target:{closest:()=>({})},currentTarget:target,stopPropagation(){}}
  button.props.onPointerDown(e);button.props.onPointerMove({...e,clientY:180});button.props.onPointerUp({...e,clientY:180})
  assert.equal(resizes.length,1);assert.equal(resizes[0][2],'2030-01-01T17:00:00.000Z')
})
test('márgenes nocturnos se segmentan sin desplazar el horario real',()=>{
  const nodes=[],{AgendaCalendar}=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes)
  const row={id:'n',recordType:'ACTIVITY',serviceName:'Show nocturno',mode:'INDIVIDUAL',status:'SCHEDULED',startsAt:'2030-01-02T05:45Z',endsAt:'2030-01-02T06:15Z',occupiedFrom:'2030-01-02T05:30Z',occupiedUntil:'2030-01-02T06:30Z',conflicts:[],providerIds:[],resourceIds:[]}
  renderToStaticMarkup(React.createElement(AgendaCalendar,{sessions:[row],view:'week',date:'2030-01-01',timezone:'America/Guatemala',onOpen(){},onDay(){}}))
  const spans=nodes.filter(n=>n.props.className==='agenda-work-window')
  assert.deepEqual(spans.map(n=>n.props.style),[{top:'50%',height:'50%'},{top:'0%',height:'50%'}])
})
test('arrastrar continuación mueve todo el evento solo15min y muestra un único ajuste',()=>{
  const nodes=[],moves=[],{AgendaCalendar}=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes)
  const row={id:'n',recordType:'ACTIVITY',serviceName:'Noche',mode:'INDIVIDUAL',status:'SCHEDULED',startsAt:'2030-01-02T05:00Z',endsAt:'2030-01-02T07:00Z',occupiedFrom:'2030-01-02T05:00Z',occupiedUntil:'2030-01-02T08:00Z',conflicts:[],providerIds:[],resourceIds:[]}
  renderToStaticMarkup(React.createElement(AgendaCalendar,{sessions:[row],view:'week',date:'2030-01-01',timezone:'America/Guatemala',onOpen(){},onDay(){},onMove:(...args)=>moves.push(args),onResize(){}}))
  assert.equal(nodes.filter(n=>n.props['data-resize']).length,1)
  nodes.find(n=>n.props.className==='agenda-day-columns').props.ref.current={getBoundingClientRect:()=>({top:100,left:0,right:700,bottom:1540,width:700,height:1440})}
  const button=nodes.filter(n=>n.type==='button'&&n.props.onPointerDown)[1]
  const target={dataset:{},getBoundingClientRect:()=>({top:100}),setPointerCapture(){}}
  const e={pointerType:'mouse',button:0,pointerId:1,clientX:250,clientY:100,currentTarget:target,stopPropagation(){}}
  button.props.onPointerDown(e);button.props.onPointerMove({...e,clientY:115});button.props.onPointerUp({...e,clientY:115})
  assert.equal(moves[0][1],'2030-01-02T05:15:00.000Z');assert.equal(moves[0][2],'2030-01-02T07:15:00.000Z')
})
