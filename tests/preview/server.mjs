// Local adapter for the actual chat handlers. Never import environment secrets.
import http from 'node:http';
import { readFile, stat, mkdir, cp } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const config=JSON.parse(await readFile(resolve(process.env.CDV_PREVIEW_STATE_DIR || '/private/tmp/cdv-live-chat-preview-state','config.json'),'utf8'));
if(config.localOnly!==true || config.url!=='http://127.0.0.1:8870'||config.rest!=='http://127.0.0.1:8871')throw new Error('Local endpoints required');
for(const key of Object.keys(process.env))if(/SUPABASE|STRIPE|RESEND|GROQ|ADMIN_ANALYTICS|CHAT_.*EMAIL|CONTACT_.*EMAIL|BOOKING_.*EMAIL/.test(key))delete process.env[key];
Object.assign(process.env,{SUPABASE_URL:config.url,SUPABASE_SERVICE_ROLE_KEY:config.serviceKey,ADMIN_ANALYTICS_TOKEN:config.adminToken,RESEND_API_KEY:'local-mock-only',CHAT_NOTIFICATION_EMAIL:'preview@example.test',CHAT_FROM_EMAIL:'preview@example.test',GROQ_API_KEY:'local-mock-only'});
const nativeFetch=globalThis.fetch;
const emails=new Map();let llmCalls=0;
globalThis.fetch=async(input,options={})=>{
 const url=String(typeof input==='string'||input instanceof URL?input:input.url);
 if(url.startsWith(config.url+'/rest/v1/'))return nativeFetch(input,options);
 if(url==='https://api.resend.com/emails'){
  const key=options.headers['Idempotency-Key'];
  if(!emails.has(key))emails.set(key,{id:`local-mail-${emails.size+1}`,payload:JSON.parse(options.body)});
  return Response.json({id:emails.get(key).id});
 }
 if(url==='https://api.groq.com/openai/v1/chat/completions'){
  llmCalls++;return Response.json({choices:[{message:{content:'[PREVIEW LOCAL] Resposta simulada da Olivia.'}}],model:'local-mock',usage:{}});
 }
 throw new Error('Preview blocked an external request');
};
// Legacy Olivia runtime resolves its writable state from cwd. Isolate it locally.
const runtimeDir=resolve(process.env.CDV_PREVIEW_STATE_DIR || '/private/tmp/cdv-live-chat-preview-state','runtime');
await mkdir(resolve(runtimeDir,'engine/state'),{recursive:true,mode:0o700});
await cp(new URL('../../knowledge/',import.meta.url),resolve(runtimeDir,'knowledge'),{recursive:true});
process.chdir(runtimeDir);
const { default: chat }=await import('../../api/chat.js');
const root=resolve(new URL('../..',import.meta.url).pathname);
const aliases={'/api/chat-session':'session','/api/chat-message':'message','/api/chat-admin':'admin','/api/olivia-chat':'assistant'};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.woff2':'font/woff2'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,config.url);
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'; form-action 'self'");
  if(url.pathname==='/__preview/state')return res.end(JSON.stringify({emails:[...emails.values()],llmCalls,localOnly:true}));
  if(url.pathname.startsWith('/rest/v1/')){
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const upstream=await nativeFetch(config.rest+url.pathname.slice(8)+url.search,{method:req.method,headers:Object.fromEntries(['authorization','content-type','prefer','accept','accept-profile','content-profile','range','range-unit'].filter(key=>req.headers[key]).map(key=>[key,req.headers[key]])),...(chunks.length?{body:Buffer.concat(chunks)}:{})});
   res.statusCode=upstream.status;res.setHeader('Content-Type','application/json');return res.end(await upstream.text());
  }
  if(aliases[url.pathname]||url.pathname==='/api/chat'){
   const chunks=[];for await(const chunk of req){chunks.push(chunk);if(Buffer.concat(chunks).length>65536){res.statusCode=413;return res.end();}}
   req.body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
   req.query=Object.fromEntries(url.searchParams);if(aliases[url.pathname])req.query.action=aliases[url.pathname];
   res.status=n=>{res.statusCode=n;return res;};res.json=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
   return await chat(req,res);
  }
  // Prevent any local booking/payment/analytics fixture from reaching real services.
  if(url.pathname.startsWith('/api/')){res.statusCode=403;return res.end('Disabled in isolated chat preview');}
  const path=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  if(!/^(\/assets\/|\/pt\/index.html$|\/en\/index.html$|\/admin\/chats.html$|\/favicon)/.test(path)){res.statusCode=404;return res.end();}
  const file=resolve(root,'.'+decodeURIComponent(path));
  if(!file.startsWith(root+'/')){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  await stat(file);return res.end(await readFile(file));
 }catch(error){res.statusCode=500;res.end('Local preview error');console.error('Preview error:',error.message);}
});
server.listen(8870,'127.0.0.1',()=>console.log('Isolated chat preview: http://127.0.0.1:8870/pt/ and /en/; Resend/Groq intercepted.'));
