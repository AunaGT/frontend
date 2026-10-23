const test=require('node:test'),assert=require('node:assert/strict')
const {createClient}=require('@supabase/supabase-js')
const {loadReportModule}=require('./helpers/loadReportModule.cjs')
test('realtime-only client does not start a second session refresh scheduler',async()=>{
 const {supabase}=loadReportModule('../../lib/supabaseClient.ts',{'@supabase/supabase-js':{createClient:(_url,_key,options)=>createClient('https://example.supabase.co','test-public-key',{...options,global:{fetch:()=>assert.fail('no auth request expected')}})}})
 try{
  await supabase.auth.initialize();await supabase.auth._handleVisibilityChange()
  assert.equal(supabase.auth.autoRefreshTicker,null)
  assert.equal(supabase.auth.persistSession,false);assert.equal(supabase.auth.detectSessionInUrl,false)
  assert.equal(supabase.channel('test-realtime').topic,'realtime:test-realtime')
 }finally{await supabase.auth.stopAutoRefresh();await supabase.removeAllChannels()}
})
