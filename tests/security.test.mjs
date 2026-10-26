import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
const require=createRequire(import.meta.url)
process.env.NODE_ENV='test'
process.env.SESSION_SECRET=randomBytes(48).toString('base64')
process.env.APP_PIN='531826'
process.env.TONY_PIN='874293'
const auth=require('../api/auth.js')
const proxy=require('../api/notion.js')
const {sameOrigin,pinRole}=require('../server/session.cjs')
const res=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k.toLowerCase()]=v},getHeader(k){return this.headers[k.toLowerCase()]},status(code){this.statusCode=code;return this},json(body){this.body=body;return this},end(){return this}})
const req=(method='GET',body={},cookie='')=>({method,body,query:{},headers:{host:'studio.example',origin:'https://studio.example',cookie},socket:{remoteAddress:'127.0.0.1'}})
test('unauthenticated clients cannot query private Notion data',async()=>{
 const response=res();await proxy(req('POST'),response)
 assert.equal(response.statusCode,401)
})
test('authentication uses server configuration, not role from sessionStorage',async()=>{
 const response=res();await auth(req('POST',{pin:'531826',role:'tony'}),response)
 assert.equal(response.body.role,'amely')
 const cookie=response.headers['set-cookie'][0]
 assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i)
 const read=res();await auth(req('GET',{},cookie.split(';')[0]),read)
 assert.equal(read.body.role,'amely')
})
test('tampered cookies cannot authenticate',async()=>{
 const response=res();await auth(req('GET',{},'bt_session=forged'),response)
 assert.equal(response.body.role,null)
})
test('cross-origin login and malformed origin are rejected',async()=>{
 const r=req('POST',{pin:'531826'});r.headers.origin='https://other.example'
 const response=res();await auth(r,response);assert.equal(response.statusCode,403)
 assert.equal(sameOrigin({headers:{origin:'bad-url',host:'studio.example'}}),false)
})
test('incorrect PIN and old four-digit public codes are rejected',()=>{
 assert.equal(pinRole('000000'),null);assert.equal(pinRole('2026'),null);assert.equal(pinRole('1111'),null)
})
test('repeated failed logins are throttled',async()=>{
 for(let i=0;i<8;i++){const r=req('POST',{pin:'000000'});r.socket.remoteAddress='test-rate';await auth(r,res())}
 const r=req('POST',{pin:'000000'});r.socket.remoteAddress='test-rate';const response=res();await auth(r,response)
 assert.equal(response.statusCode,429)
})
