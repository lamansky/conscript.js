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
    '[1, 2, 3] ^= 1',
    '[1, 2, 3] *= 1',
    '[1, 2, "3"] *~= 3',
    '[1, 2, "3"] !*= 3',
    '[1, 2, 3].1 = 2',
    '[1, 2, 3].(1 + 1) = 3',
    '[1, 2, 3].length = 3',
    '[1, 2, 3].count = 3',
    '[5, 6, 7].last = 7',
    '[1, 2, 3].slice(1, 2) = [2]',
    '[1, 2, 3].slice(1, 2) ~= [2]',
    '[1, 2, 3].some((x){x=2})',
    '[1, 2, 3].map((x){x*2}) *= 6',
    '[1, 2, 3].map((x){x*2}).some((x){x=6})',
    '[[1], [2], [3]].every((x){x.some((x){x is number})})',
    '["Hello, world"] *= "Hello, world"',
    '["Hello","world"] *~= "HELLO"',
    '"Test".slice(1, 3) = "es"',
    '"aaa".every((char){char="a"})',
    '"Test".some((char){char="e"})',
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
    '"test" before "ing" = "testing"',
    '"test" then "ing" = "testing"',
    '0 then 2 = 0',
    '1 then 2 = 3',
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
    '1 is int',
    '1.1 is float',
    '1.1 is not int',
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
    '(){obj}().d.key = value',
    'obj.c=3&obj.d.hi=null',
    'obj.e is null',
    'obj.prototype is null',
    'obj.hasOwnProperty is null',
    '(var=123 ? 1 : 2) = 1',
    'under_score = "yes"',
    '$under_score = "yes"',
    '${under_score} = "yes"', // eslint-disable-line no-template-curly-in-string
    'has space = 1',
    '$has space = 1',
    'has space is number',
    '$has space is number',
    '!${has space is number}', // eslint-disable-line no-template-curly-in-string
    '$("v" + "ar") = 123',
    '$(v + ar) = 123',
    '$(x)="z"',
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
    '"Test".0 = "T"',
    '(x){x=1}(1)',
    '(x){x=null}()',
    '(true?(x){x=1}:(x){x=2})(1)',
    '(false?(x){x=1}:(x){x=2})(2)',
    '( x , y ) { x = y } ( 2 , 2 )',
    '(x){x=1} is function',
    '(){}() = null',
  ]

  for (const statement of trueStatements) {
    it(`should evaluate as true: \`${statement}\``, function () {
      const vars = {
        var: 123,
        under_score: 'yes',
        'has space': 1,
        'has space is number': false,
        obj: {'a b': () => x => x, c: 3, d: new Map([['key', 'value']])},
        bool: false,
        x: 'y',
        y: 'z',
      }
      assert.strictEqual(conscript({
        allowRegexLiterals: true,
        debugOutput: (...data) => console.log(...data), // eslint-disable-line no-console
      })(statement)(vars), true)
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
    'null is object',
  ]

  for (const statement of falseStatements) {
    it(`should evaluate as false: \`${statement}\``, function () {
      assert.strictEqual(conscript()(statement)(), false)
    })
  }

  const funcStatements = [
    '$sum is function & $doesntExist is not function & $doesntExist is not string',
    'sum(2,2)=4',
    'sum ( 2 , 2 ) = 4',
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
      assert.strictEqual(conscript()(statement)(funcVars), true)
    })
  }

  it('should support nested function call', function () {
    assert.strictEqual(conscript({unknownsAre: 'errors'})('f(2)(3)=5')({f (x) { return y => x + y }}), true)
  })

  it('should throw an error trying to call a non-function', function () {
    assert.throws(() => conscript()('(1=1)(1=1)')(), TypeError)
    assert.throws(() => conscript()('var("string")')(), TypeError)
  })

  it('should support dot notation', function () {
    assert.strictEqual(conscript()('a.b=1')({a: {b: 1}}), true)
  })

  it('should support dot notation for keys with spaces', function () {
    assert.strictEqual(conscript()('a.{b c}=1')({a: {'b c': 1}}), true)
  })

  it('should ignore operators in quotes', function () {
    assert.strictEqual(conscript()('"1=1" = "1=1" & "1&2" = "1&2"')(), true)
  })

  it('should ignore array syntax in quotes', function () {
    assert.strictEqual(conscript()('"[1, 2]" = "[1, " + "2]"')(), true)
  })

  it('should ignore parentheses in quotes', function () {
    assert.strictEqual(conscript()('("1)" = "1)")')(), true)
  })

  it('should ignore things in brackets', function () {
    assert.strictEqual(conscript()('a.{a?b:"["]\\}} is null', {safe: true})(), true)
  })

  it('should support `debug` operator', function () {
    {
      let called
      assert.strictEqual(conscript({
        debugOutput (syntax, value) {
          assert.strictEqual(syntax, '$x')
          assert.strictEqual(value, 123)
          called = true
        },
      })('debug $x=123')({x: 123}), true)
      assert.strictEqual(called, true)
    }

    assert.strictEqual(conscript()('debug $x=123')({x: 123}), true)

    {
      let called
      assert.strictEqual(conscript({
        debugOutput (syntax, value) {
          assert.strictEqual(syntax, '($x=123)')
          assert.strictEqual(value, true)
          called = true
        },
      })('debug ($x=123) & true=true')({x: 123}), true)
      assert.strictEqual(called, true)
    }
  })

  it('should support `unknownsAre` argument', function () {
    assert.strictEqual(conscript()('unknown="unknown"')(), true)
    assert.strictEqual(conscript()('unknown=null', {unknownsAre: 'null'})(), true)
    assert.throws(() => { conscript({unknownsAre: 'errors'})('unknown=1')() })
    assert.throws(() => { conscript()('unknown=1', {unknownsAre: 'errors'})() })
  })

  it('should throw an error accessing an invalid array property', function () {
    assert.doesNotThrow(() => { conscript()('arr.0')({arr: [1]}) })
    assert.throws(() => { conscript()('arr.pop is function')({arr: [1]}) })
    assert.throws(() => { conscript()('[1].pop is function')() })
  })

  it('should support `defaultLeft` argument', function () {
    assert.strictEqual(conscript()('!"object"&("number"|"string")')({}, {defaultLeft: typeof 'test'}), true)
    assert.strictEqual(conscript()('"string"&!"object"')({}, {defaultLeft: typeof {}}), false)
    assert.strictEqual(conscript()('!string&object&is string&is not int')({}, {defaultLeft: typeof {}}), true)
    assert.strictEqual(conscript()('>2 & +1=4 & -  1 = 2')({}, {defaultLeft: 3}), true)
    assert.strictEqual(conscript()('>2 & +1=4 & -  1 = 2')({}, {defaultLeft: 3}), true)
    assert.strictEqual(conscript()('.key="value"')({}, {defaultLeft: {key: 'value'}}), true)
    assert.strictEqual(conscript()('(?:2)=2')({}, {defaultLeft: false}), true)
    assert.strictEqual(conscript()('is string')({}, {defaultLeft: 'test'}), true)
    assert.strictEqual(conscript({allowRegexLiterals: true})('matches @^t@')({}, {defaultLeft: 'test'}), true)
    assert.strictEqual(conscript()('then "ing" = "testing"')({}, {defaultLeft: 'test'}), true)
  })
})
