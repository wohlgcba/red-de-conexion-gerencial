import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validPassword, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '../src/utils/passwordPolicy.ts'

for (const [name,password,expected] of [
  ['exactly eight characters','PruebaA1',true],
  ['longer password','UnaClaveDePrueba123',true],
  ['symbols optional','Clave12!',true],
  ['seven characters','ClaveA1',false],
  ['missing uppercase','pruebaa1',false],
  ['missing lowercase','PRUEBAA1',false],
  ['missing number','PruebaAb',false],
  ['numeric initial identifier cannot become permanent','20999900020',false],
  ['empty','',false],
]) test(`password policy: ${name}`,()=>{
  assert.equal(PASSWORD_MIN_LENGTH,8)
  assert.equal(validPassword(password),expected)
  assert.equal(new RegExp(`^(?:${PASSWORD_PATTERN})$`).test(password),expected)
})
