'use strict'

const assert = require('assert')
const conscript = require('.')

describe('conscript()', function () {
  const trueStatements = [
    '1=1',
    '"test" = "test"',
    "'test' = 'test'",
    '1 < 2',
    '2 > -1',
    '"test" = "te"+"st"',
    '"b" > "a"',
    '0 <> 1',
    '"a" != "b"',
    '[1, 2, 3] *= 1',
    '[1, 2, "3"] *~= 3',
    '[1, 2, "3"] !*= 3',
    '["Hello, world"] *= "Hello, world"',
    '["Hello","world"] *~= "HELLO"',
    '[0] = [0]',
    '["test"] = [\'test\']',
    '"test" ~= "TEST"',
    '"Hello"^="H"',
    '"Hello" !^= "W"',
    '"This is a test" $= "test"',
    '"Hello" $~= "O"',
    '"Hello" !$~= "H"',
    '"Hello world!" *= "!"',
    '"Test" *= ""',
    '10 *= 0',
    '"" = ""',
    '5 + 5 = 10',
    '5 + 5 ~= "10"',
    '3000 - 1 = 2999',
    '-1 = 0-1',
    '2*2=4',
    '100 / 2 = 50',
    '7 % 2 = 1',
    '2^4=16',
    '1+1+1 = 3',
    '"3" - 2 = 1',
    '1=2 | 2=2',
    '(1=2|2=3)|(3=4|(4=5|5=5))',
    '("a" = "b" | "b" = "c" | 1 < 2)&( 2 & 3=3)',
    '(((1=1)))',
    '!!1',
    '!0',
    'true',
    'true = false | true',
    '"test" is "string"',
    '[] is "array"',
    '1+2 is "number"',
    '"test" !is "number"',
    '"test" is not number',
    'true is boolean',
    '[var, "test"] *= 123',
    '!(1=1 & "0" is number)',
    '!!true=true',
    '[] is empty array',
    'obj.{a b}()(c) = c',
    '(1|2)=1',
    'obj.d.key = value',
    'obj.c=3&obj.d.hi=null',
    '(var=123 ? 1 : 2) = 1',
    '(var ?: null) = var',
    '(null ?: var) = var',
    'first word != first',
    '(2 ? 3 ? 4 : 5 : 6) = 4',
    '(false ? 1 ? 2 : 3 : 4) = 4',
    '(true?!true?2:3:4) = 3',
    '!bool',
    '"test" matches @^t@',
    '"test" !matches @^T@',
    '"test" matches @^T@i',
    '"test" matches @(T)$@i',
    '"test" !matches @^x@',
    '@h(?:i|ello) world!?@i matches "Hello world"',
    '"test" in "testing"',
    '"test" in ["test", "example"]',
    '"test" !in "example"',
    '"test" ~in "Test"',
  ]

  for (const statement of trueStatements) {
    it(`should evaluate as true: \`${statement}\``, function () {
      const context = {var: 123, obj: {'a b': () => x => x, c: 3, d: new Map([['key', 'value']])}, bool: false}
      assert.strictEqual(conscript(statement)(context), true)
    })
  }

  const falseStatements = [
    '0=1',
    '0/0=0',
    '0 = ""',
    '"" = 0',
    '1 = "1"',
    '"Hello" $~= "H"',
    '!     1',
    '![0]',
    'False',
    'TRUE = false',
    '"123" is number',
    'true ? false : true',
    '"test" in "Test"',
  ]

  for (const statement of falseStatements) {
    it(`should evaluate as false: \`${statement}\``, function () {
      assert.strictEqual(conscript(statement)(), false)
    })
  }

  const funcStatements = [
    '$sum is function & $doesntExist is not function & $doesntExist is not string',
    'sum(2,2)=4',
    'sum(2, sum(1, 1)) = 4',
    '"test(\'1\', 2)"=sum("test(\'1\',", " 2)")',
    '[sum(5,3)] = [8]',
    '[sum(5,4)] != [8, 9, 10]',
    'sum(sum(1, 1), sum(2, sum(1, 3))) = 8',
  ]

  const funcVars = {
    sum (a, b) { return a + b },
  }

  for (const statement of funcStatements) {
    it(`should evaluate a function call: \`${statement}\``, function () {
      assert.strictEqual(conscript(statement)(funcVars), true)
    })
  }

  it('should support nested function call', function () {
    assert.strictEqual(conscript('f(2)(3)=5', {unknownsAre: 'errors'})({f (x) { return y => x + y }}), true)
  })

  it('should support dot notation', function () {
    assert.strictEqual(conscript('a.b=1')({a: {b: 1}}), true)
  })

  it('should support dot notation for keys with spaces', function () {
    assert.strictEqual(conscript('a.{b c}=1')({a: {'b c': 1}}), true)
  })

  it('should ignore operators in quotes', function () {
    assert.strictEqual(conscript('"1=1" = "1=1" & "1&2" = "1&2"')(), true)
  })

  it('should ignore array syntax in quotes', function () {
    assert.strictEqual(conscript('"[1, 2]" = "[1, " + "2]"')(), true)
  })

  it('should ignore parentheses in quotes', function () {
    assert.strictEqual(conscript('("1)" = "1)")')(), true)
  })

  it('should ignore things in brackets', function () {
    assert.strictEqual(conscript('a.{a?b:"["]\\}} is null', {safe: true})(), true)
  })

  it('should support `unknownsAre` argument', function () {
    assert.strictEqual(conscript('unknown="unknown"')(), true)
    assert.strictEqual(conscript('unknown=null', {unknownsAre: 'null'})(), true)
    assert.throws(() => { conscript('unknown=1', {unknownsAre: 'errors'})() })
  })

  it('should support `defaultLeft` argument', function () {
    assert.strictEqual(conscript('!"object"&("number"|"string")')({}, {defaultLeft: typeof 'test'}), true)
    assert.strictEqual(conscript('"string"&!"object"')({}, {defaultLeft: typeof {}}), false)
    assert.strictEqual(conscript('!string&object&is string&is not int')({}, {defaultLeft: typeof {}}), true)
    assert.strictEqual(conscript('>2 & +1=4 & -  1 = 2')({}, {defaultLeft: 3}), true)
    assert.strictEqual(conscript('>2 & +1=4 & -  1 = 2')({}, {defaultLeft: 3}), true)
    assert.strictEqual(conscript('.key="value"')({}, {defaultLeft: {key: 'value'}}), true)
    assert.strictEqual(conscript('(?:2)=2')({}, {defaultLeft: false}), true)
    assert.strictEqual(conscript('is string')({}, {defaultLeft: 'test'}), true)
    assert.strictEqual(conscript('matches @^t@')({}, {defaultLeft: 'test'}), true)
  })
})
