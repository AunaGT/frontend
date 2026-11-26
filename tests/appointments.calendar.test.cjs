const test = require('node:test'), assert = require('node:assert/strict')
const { loadReportModule } = require('./helpers/loadReportModule.cjs')
const model = loadReportModule('../appointments/viewModel.ts')
test('horarios ambiguos se distinguen por offset en picker y nombre accesible de evento',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server')
  const slots=['2026-11-01T05:30:00Z','2026-11-01T06:30:00Z'].map(startsAt=>({startsAt,endsAt:new Date(new Date(startsAt).getTime()+900000).toISOString(),timezone:'America/New_York',providerIds:[],resourceIds:[],remaining:1,sessionId:null}))
  const {SlotPicker}=loadReportModule('../appointments/components/BookingFields.tsx',{'@/services/api':{apiFetch(){}}})
  const html=renderToStaticMarkup(React.createElement(SlotPicker,{slots,value:'',onSelect(){}}))
  assert.match(html,/GMT-4/);assert.match(html,/GMT-5/)
  const nodes=[]
  const Calendar=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes).AgendaCalendar
  const sessions=slots.map((s,i)=>({...s,id:String(i),serviceName:'Consulta',mode:'INDIVIDUAL',status:'SCHEDULED',conflicts:[]}))
  renderToStaticMarkup(React.createElement(Calendar,{sessions,date:'2026-11-01',view:'day',timezone:'America/New_York',onOpen(){},onDay(){}}))
  const labels=nodes.filter(n=>n.type==='button'&&n.props.className?.startsWith('agenda-event')).map(n=>n.props['aria-label'])
  assert.ok(labels.some(s=>s.includes('GMT-4')));assert.ok(labels.some(s=>s.includes('GMT-5')))
})
test('la tarjeta diaria muestra modalidad y horas limpias; conserva la zona horaria en su nombre accesible',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),nodes=[]
  const Calendar=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes).AgendaCalendar
  const row={id:'meeting',recordType:'ACTIVITY',purpose:'MEETING',venue:{kind:'ONLINE'},serviceName:'Reunión de producto',mode:'INDIVIDUAL',startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T16:00:00Z',status:'SCHEDULED',conflicts:[],providerIds:[],resourceIds:[]}
  renderToStaticMarkup(React.createElement(Calendar,{sessions:[row],view:'day',date:'2030-01-01',timezone:'America/Guatemala',onOpen(){},onDay(){}}))
  const event=nodes.find(n=>n.type==='button'&&n.props.className?.startsWith('agenda-event'))
  const visible=renderToStaticMarkup(React.createElement('div',{},event.props.children))
  assert.match(visible,/virtual/i);assert.doesNotMatch(visible,/GMT-/)
  assert.match(event.props['aria-label'],/GMT-6/)
})
test('la semana ubica la tarjeta en el horario real y conserva los márgenes en su descripción',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),nodes=[]
  const {AgendaCalendar}=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes)
  const row={id:'event',recordType:'ACTIVITY',purpose:'EVENT',serviceName:'Show de carreta de 80 shots',mode:'INDIVIDUAL',startsAt:'2030-01-02T01:00:00Z',endsAt:'2030-01-02T01:45:00Z',occupiedFrom:'2030-01-02T00:30:00Z',occupiedUntil:'2030-01-02T02:00:00Z',status:'SCHEDULED',conflicts:[],providerIds:[],resourceIds:[]}
  renderToStaticMarkup(React.createElement(AgendaCalendar,{sessions:[row],view:'week',date:'2030-01-01',timezone:'America/Guatemala',onOpen(){},onDay(){},onCreate(){},onSelect(){}}))
  const event=nodes.find(n=>n.type==='button'&&n.props['data-agenda-event']===true)
  assert.equal(event.props.style.top,`${(19*60-8*60)/(12*60)*100}%`)
  assert.equal(event.props.style.height,'6.25%')
  const visible=renderToStaticMarkup(React.createElement('div',{},event.props.children))
  assert.doesNotMatch(visible,/Traslado|preparación|Evento/)
  assert.match(event.props['aria-label'],/reserva con traslado y preparación/)
  assert.equal(nodes.some(n=>n.props.className==='agenda-new-slot'),false)
})
test('arrastrar desde el horario real conserva los márgenes y la duración del evento',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),nodes=[],moves=[]
  const {AgendaCalendar}=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes)
  const row={id:'event',recordType:'ACTIVITY',purpose:'EVENT',serviceName:'Show',mode:'INDIVIDUAL',startsAt:'2030-01-02T01:00:00Z',endsAt:'2030-01-02T01:45:00Z',occupiedFrom:'2030-01-02T00:30:00Z',occupiedUntil:'2030-01-02T02:00:00Z',status:'SCHEDULED',conflicts:[],providerIds:[],resourceIds:[]}
  renderToStaticMarkup(React.createElement(AgendaCalendar,{sessions:[row],view:'day',date:'2030-01-01',timezone:'America/Guatemala',onOpen(){},onDay(){},onMove:(...args)=>moves.push(args)}))
  nodes.find(n=>n.props.className==='agenda-day-columns').props.ref.current={getBoundingClientRect:()=>({top:100,left:0,right:800,bottom:820,width:800,height:720})}
  const button=nodes.find(n=>n.type==='button'&&n.props.onPointerDown),target={dataset:{},getBoundingClientRect:()=>({top:760}),setPointerCapture(){}}
  const e={pointerType:'mouse',button:0,pointerId:1,clientX:100,clientY:760,currentTarget:target}
  button.props.onPointerDown(e);button.props.onPointerMove({...e,clientY:700});button.props.onPointerUp({...e,clientY:700})
  assert.equal(moves[0][1],'2030-01-02T00:00:00.000Z')
  assert.equal(moves[0][2],'2030-01-02T00:45:00.000Z')
})
test('rangos en zona de empresa cruzan año y respetan DST; mes tiene42 días', () => {
  assert.deepEqual(model.agendaRange('2026-12-31', 'week', 'America/Guatemala'), { from: '2026-12-28T06:00:00.000Z', to: '2027-01-04T06:00:00.000Z' })
  assert.deepEqual(model.agendaRange('2026-03-08', 'day', 'America/New_York'), { from: '2026-03-08T05:00:00.000Z', to: '2026-03-09T04:00:00.000Z' })
  const month = model.agendaRange('2026-10-12', 'month', 'America/Guatemala')
  assert.equal((new Date(month.to) - new Date(month.from)) / 86400000, 42)
  assert.throws(() => model.localInstant('2026-11-01T01:30', 'America/New_York'), /ambigua/)
})
test('sesión que cruza medianoche aparece en ambos días sin duplicar inscripción', () => {
  const rows = model.groupAgendaSessions([{ id: 's', startsAt: '2026-10-13T05:45Z', endsAt: '2026-10-13T06:30Z' }], 'America/Guatemala')
  assert.deepEqual(rows.map(r => r.date), ['2026-10-12', '2026-10-13'])
})
test('avanzar mes respeta fin de mes y no repite enero por avanzar28 días',()=>{
  assert.equal(model.shiftAgendaDate('2026-01-01','month',1),'2026-02-01')
  assert.equal(model.shiftAgendaDate('2026-01-31','month',1),'2026-02-28')
  assert.equal(model.shiftAgendaDate('2026-12-31','month',1),'2027-01-31')
})
test('lanes y movimiento usan geometría real incluso con zoom, nunca mutan por cancelación', () => {
  const { calendarLanes, dragTarget } = loadReportModule('../appointments/components/AgendaCalendar.tsx')
  const rows = calendarLanes([{ id: 'a', start: 540, end: 600 }, { id: 'b', start: 570, end: 630 }])
  assert.notEqual(rows[0].lane, rows[1].lane)
  assert.equal(dragTarget({ from: 540, to: 1080, rect: { top: 100, height: 1080 }, y: 220 }), 600)
})
test('handlers del calendario cancelan drag y solo proponen una reprogramación al soltar',()=>{
  const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),nodes=[],moves=[],opened=[]
  const {AgendaCalendar}=loadReportModule('../appointments/components/AgendaCalendar.tsx',{},nodes)
  const row={id:'s',serviceName:'Servicio largo de prueba',mode:'INDIVIDUAL',startsAt:'2030-01-01T15:00:00Z',endsAt:'2030-01-01T16:00:00Z',status:'SCHEDULED',conflicts:[],providerIds:[],resourceIds:[]}
  renderToStaticMarkup(React.createElement(AgendaCalendar,{sessions:[row],view:'day',date:'2030-01-01',timezone:'America/Guatemala',onOpen:id=>opened.push(id),onMove:(...args)=>moves.push(args),onDay(){}}))
  nodes.find(n=>n.props.className==='agenda-day-columns').props.ref.current={getBoundingClientRect:()=>({top:100,left:0,right:800,bottom:1300,width:800,height:1200})}
  const button=nodes.find(n=>n.type==='button'&&n.props.onPointerDown),target={dataset:{},getBoundingClientRect:()=>({top:220}),setPointerCapture(){}}
  const event={pointerType:'mouse',button:0,pointerId:1,clientX:100,clientY:220,currentTarget:target}
  button.props.onPointerDown(event);button.props.onPointerMove({...event,clientY:340});button.props.onPointerCancel(event);button.props.onPointerUp({...event,clientY:340})
  assert.equal(moves.length,0)
  button.props.onPointerDown(event);button.props.onPointerMove({...event,clientY:340});button.props.onPointerUp({...event,clientY:340});button.props.onClick({stopPropagation(){}})
  assert.equal(moves.length,1);assert.equal(opened.length,0)
  assert.equal(moves[0][0],'s');assert.equal(new Date(moves[0][1]).toISOString(),'2030-01-01T16:00:00.000Z')
})
