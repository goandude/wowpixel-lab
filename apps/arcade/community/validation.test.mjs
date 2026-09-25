import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:[new URL('../lib/community-validation.ts',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')],bundle:true,write:false,format:'esm',platform:'node'});
const {profileInput,racerResult}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
test('profile uses case-insensitive handle keys and defaults country to private',()=>{const p=profileInput({handle:'Driver_7',avatar:'racer',country:'us'});assert.equal(p.handleKey,'driver_7');assert.equal(p.showCountry,false);assert.equal(p.country,'US');});
test('reject unsafe handles and unknown characters',()=>{for(const handle of ['a','7driver','a/b','<script>','a'.repeat(21)])assert.throws(()=>profileInput({handle}));assert.throws(()=>profileInput({handle:'Valid',avatar:'external-url'}));});
test('racer combines distance and bonus once',()=>{assert.equal(racerResult({distance:150.9,bonus:250,seconds:10},11).score,400);});
test('reject invalid values, negative scores, impossible speed and elapsed time',()=>{for(const changes of [{distance:Infinity},{distance:-1},{distance:10000},{bonus:NaN},{bonus:-50},{bonus:51},{seconds:50},{seconds:0},{seconds:Infinity},{bonus:999999}])assert.throws(()=>racerResult({distance:100,bonus:100,seconds:10,...changes},11));});
