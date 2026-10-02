import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { hashSources } from '../scripts/client-build-meta.mjs'
test('build fingerprint is location and CRLF independent, but content/path sensitive',()=>{
 const temp=mkdtempSync(join(tmpdir(),'ow-build-meta-'))
 try {
  const a=join(temp,'first'),b=join(temp,'second');mkdirSync(a);mkdirSync(b)
  const pa=join(a,'module.js'),pb=join(b,'module.js')
  writeFileSync(pa,'const answer = 42\n');writeFileSync(pb,'const answer = 42\r\n')
  assert.equal(hashSources([pa],a),hashSources([pb],b))
  writeFileSync(pb,'const answer = 43\n');assert.notEqual(hashSources([pa],a),hashSources([pb],b))
  const renamed=join(b,'renamed.js');writeFileSync(renamed,'const answer = 42\n')
  assert.notEqual(hashSources([pa],a),hashSources([renamed],b))
 } finally {rmSync(temp,{recursive:true,force:true})}
})
