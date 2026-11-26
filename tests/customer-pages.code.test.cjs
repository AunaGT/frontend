const test=require('node:test'),assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{loadReportModule}=require('./helpers/loadReportModule.cjs')
test('disabled or same-origin executable artifacts never mount; enabled isolated artifacts have no referrer or same-origin privileges',()=>{
 const {CustomVisualFrame}=loadReportModule('../../components/customer-pages/CustomVisualFrame.tsx'),artifact={url:'https://visual.example.net/artifacts/'+'a'.repeat(64),hash:'a'.repeat(64),channelId:'channel-123'}
 const render=props=>renderToStaticMarkup(React.createElement(CustomVisualFrame,{artifact,fallbackText:'Decoración',...props}))
 assert.doesNotMatch(render({enabled:false}),/<iframe/);assert.doesNotMatch(render({enabled:true,artifact:{...artifact,url:'http://localhost:8080/danger'}}),/<iframe/)
 const html=render({enabled:true});assert.match(html,/sandbox="allow-scripts"/);assert.match(html,/referrerPolicy="no-referrer"/i);assert.doesNotMatch(html,/allow-same-origin|token|srcDoc/i)
})
