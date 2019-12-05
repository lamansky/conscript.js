# conscript.js

The JavaScript parser for the Conscript language. Conscript (pronounced _CON-script_) is a very simple language for writing potentially-complex sets of conditions according to which data should be evaluated. A script written in this language is called a “Conscription” and is usually only one line long. Think of it as being analogous to the `WHERE` component of a SQL query.

Here’s an example that uses Conscript in a calendar context:

```javascript
const conscript = require('conscript')()

const date = new Date()
const vars = {
  year: date.getUTCFullYear(),
  month: date.getUTCMonth() + 1,
  day: date.getUTCDate(),
}

// This turns the string into a test function
const test = conscript('month=10 & day=28')

if (test(vars)) {
  // This will run if today is October 28
}
```

## Installation

Requires [Node.js](https://nodejs.org/) 8.3.0 or above.

```bash
npm i conscript
```

## API

The module exports a single function which returns a function which returns another function.

The first function is intended to be called at require-time, e.g. `require('conscript')(globalOptions)`.

### Parameter of the First Function

1. Optional: Object argument: Global options that will apply to all subsequent calls. Possible options:
    * `allowRegexLiterals` (bool): Whether to permit regular expression literals in condition scripts. Defaults to `false`.
    * `safeCall` (bool): If set to `true`, calling a non-function will fail silently and generate `null`. If set to `false`, an error will be thrown. Defaults to `false`.
    * `safeNav` (bool): If set to `true`, accessing a property of a non-object will fail silently and generate `null`. If set to `false`, an error will be thrown. Defaults to `false`.
    * `safe` (bool): A shortcut for setting both `safeCall` and `safeNav` simultaneously.
    * `unknownsAre` (string): A mode for handling unknown identifiers. Possible values are:
        * `strings` (default): Treat unknown identifiers as as strings.
        * `null`: Convert unknown identifiers to `null`.
        * `errors`: Throw a `ReferenceError` whenever an unknown identifier is found.

### Parameters of the Second Function

1. `conscription` (string): A condition script.
2. Optional: `options` (object): Any options that should override the global options you set when you called the first function (see above).

### Parameters of the Third Function

1. `vars` (function, object, or Map)
    * If `vars` is a function, it is called whenever Conscript comes across an identifier, and is passed two arguments: the identifier name, and a `notAVar` symbol to be returned if the identifier is not a variable.
    * If `vars` is an object or Map, its keys are considered the variables to which the values are mapped.
2. Optional: Object argument:
    * `defaultLeft` (any): A value to be used as the left operand for operations that omit a left operand.

### Return Value

Returns the result of the condition script. Usually this is `true` or `false` if you used a comparison operator, or in most use cases involving `defaultLeft`, but otherwise theoretically can be any value to which your script evaluates.

## Conscript Syntax

Here are some of the language features which you can use in the Conscript string that you pass to the parser:

### Literals

#### Number Literals

Floats and negative numbers are supported.

```javascript
const conscript = require('conscript')()
conscript('2 > 1')() // true
conscript('1.1 > 1')() // true
conscript('-1 < 0')() // true
```

#### String Literals

String literals are enclosed with either double or single quotes.

```javascript
const conscript = require('conscript')()
conscript('"test" = "test"')() // true
```

If the `unknownsAre` setting is set to `strings` (which is the default), then strings do not need to be quoted.

```javascript
const conscript = require('conscript')({unknownsAre: 'strings'})

// Two unquoted strings ("test" and "string") separated by the `is` operator:
conscript('test is string')() // true
```

#### Boolean and Null Literals

Conscript supports `true`, `false`, and `null` literals. These are case-insensitive.

```javascript
const conscript = require('conscript')()
conscript('true')() // true
conscript('!false')() // true
conscript('!null')() // true
```

Unlike JavaScript, Conscript does not distinguish between `null` and `undefined`. Only `null` is used. Also unlike JavaScript, Conscript does not consider `null` to be an object.

#### Array Literals

Arrays are created using square brackets and can contain variables or other literals.

```javascript
const conscript = require('conscript')()
// The *= operator checks to see if the array on the left contains the value on the right.
conscript('[123, "test", var] *= "value"')({var: 'value'}) // true
```

#### Function Literals

Function literals are generally used as callback arguments for other functions. To create a function, define the named parameters list, surrounded by parentheses, then define the function body, surrounded by curly brackets.

All Conscript syntax produces some sort of value (Conscript does not use [statements](https://2ality.com/2012/09/expressions-vs-statements.html)), so Conscript function declarations do not use `return`.

If needed, you can call a function immediately after defining it. Functions are called using a parenthesized list of arguments, as in JavaScript.

```javascript
const conscript = require('conscript')()

// This is the same as `typeof (x => x === 1) === 'function'` in JavaScript
conscript('(x){x=1} is function')({}) // true

// This calls the function immediately after defining it
conscript('(x,y){x=y}(1,1)')({}) // true
```

#### Regular Expression Literals

Regular expressions are surrounded on either side by `@`. Flags (such as `i`) can go after the final `@`. Regular expressions are used in conjunction with the `matches` operator. The regex can go on the left and the string on the right, or vice versa.

The use of regular expression literals (e.g. `@regex@`) requires the `allowRegexLiterals` option to be set to `true`.

```javascript
const conscript = require('conscript')({allowRegexLiterals: true})
conscript('@^ex@ matches "Example"')() // false
conscript('@^ex@ !matches "Example"')() // true
conscript('@^ex@i matches "Example"')() // true
conscript('"Example" matches @^ex@i')() // true
```

### Variables

```javascript
const conscript = require('conscript')()
conscript('x=1')({x: 1}) // true
conscript('x=1')({x: 2}) // false
```

When Conscript comes across an identifier (`x` in the example above), it will look for its value in the `vars` argument.

Normally, variable names must be alphanumeric. If you need support for more characters, use the `${var}` construction:

```javascript
const conscript = require('conscript')()
conscript('${hello world!}=123')({'hello world!': 123}) // true
```

If you need "variable variables," use the `$(expression)` construction:

```javascript
const conscript = require('conscript')()
conscript('$(x)="z"')({x: 'y', y: 'z'}) // true
```

You can implement determined-at-runtime variable names by passing a function instead of a dictionary object:

```javascript
const conscript = require('conscript')()
conscript('variable="variable"')(varName => varName) // true
```

You can pass functions as variables and can call them from within the condition string.

```javascript
const conscript = require('conscript')()
const vars = {
  sum (a, b) { return a + b },
}
conscript('sum(2,2)=4')(vars) // true
```

If the variable is not a function, the Conscript parser will throw an error. If you want non-function calls to fail silently, set the `safeCall` setting to `true`, like so:

```javascript
const conscript = require('conscript')({safeCall: true})
conscript('sum(2,2)=4')({}) // false
```

### Parentheses

Clauses can be grouped with parentheses, allowing for nested logical tests.

```javascript
const conscript = require('conscript')()
conscript('(x>0&x<=y-1)|x=999')({x: 51, y: 100}) // true
```

### Properties & Methods

#### Objects

If one of your variables is an object, you can access its properties like so:

```javascript
const conscript = require('conscript')()
const vars = {
  obj: {a: 1},
}
conscript('obj.a=1')(vars) // true
```

Normally, property names must be alphanumeric. If you need support for more characters, use the `.{prop}` construction:

```javascript
const conscript = require('conscript')()
const vars = {
  obj: {'number one': 1},
}
conscript('obj.{number one}=1')(vars) // true
```

If you need dynamic property access, use the `.(expression)` construction:

```javascript
const conscript = require('conscript')()
const vars = {
  arr: [0, 10, 20],
}
conscript('arr.(1 + 1) = 20')(vars) // true
```

#### Arrays & Strings

You can access array elements and string characters with the same syntax used to access object properties. Arrays and strings are zero-indexed.

```javascript
const conscript = require('conscript')()
conscript('[1, 2, 3].0 = 1')() // true
conscript('"Test".1 = "e"')() // true
```

Besides numeric indexes, arrays and strings have the following properties:

* `empty` returns `true` if the array has no items, and `false` otherwise.
* `last` is the same as `arr.(arr.length - 1)`.
* `length` returns the number of elements in the array.
* `multiple` returns `true` if the array has more than one item, and `false` otherwise.

```javascript
const conscript = require('conscript')()
conscript('[].empty')() // true
conscript('[2, 4, 6].length = 3')() // true
conscript('[2, 4, 6].last = 6')() // true
conscript('[1, 2].multiple')() // true
```

Arrays and strings also have the following methods:

* `every`
* `map`
* `slice`
* `some`

These methods work like their JavaScript equivalents. Strings are treated as if they are arrays of characters.

```javascript
const conscript = require('conscript')()
conscript('[1, 2, 3].every((x){x is number})')() // true
conscript('[1, 2, 3].map((x){x*2}) = [2, 4, 6]')() // true
conscript('[1, 2, 3].slice(1, 2) = [2]')() // true
conscript('[1, 2, 3].some((x){x=3})')() // true
conscript('"aaa".every((char){char="a"})')() // true
```

### Comparison Operators

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `=` | Equals, or has equal elements | `1 = 1`<br>`"a" = "a"`<br>`[1,2]=[1,2]` |
| `~=` | Case-insensitively equals | `"Abc" ~= "abc"` |
| `>` | Greater than | `2 > 1` |
| `>=` | Greater than or equal to | `1 >= 1` |
| `<` | Less than | `2 < 3` |
| `<=` | Less than or equal to | `2 <= 3` |
| `<>` | Not equal to | `100 <> 200`<br>`"a" <> "b"` |
| `!=` | Not equal to | `100 != 200`<br>`"a" != "b"` |

#### Starts/Ends With

The use of these operators will cast both operands to strings.

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `^=` | String starts with | `"test" ^= "t"` |
| `^~=` | String case-insensitively starts with | `"Test" ^~= "t"` |
| `!^=` | String does not start with | `"test" !^= "T"` |
| `!^~=` | String does not case-insensitively start with | `"test" !^~= "x"` |
| `$=` | String ends with | `"test" $= "t"` |
| `$~=` | String case-insensitively ends with | `"Test" $~= "t"` |
| `!$=` | String does not end with | `"test" !$= "T"` |
| `!$~=` | String does not case-insensitively end with | `"test" !$~= "x"` |

#### Inclusion

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `*=` | String or array contains | `"test" *= "e"`<br>`[1,2,3] *= 1` |
| `*~=` | String or array case-insensitively contains |`"test" *~= "E"`<br>`["Hello", "world"] *~= "hello"` |
| `!*=` | String or array does not contain | `"test" !*= "T"`<br>`[1,2,3] !*= 4` |
| `!*~=` | String or array does not case-insensitively contain | `"test" !*~= "x"` |
| `in` | Contained in string or array | `"e" in "test"`<br>`1 in [1,2,3]` |
| `~in` | Case-insensitively contained in string or array |`"E" ~in "test"`<br>`"hello" ~in ["Hello", "world"]` |
| `!in` | Not contained in string or array | `"T" !in "test"` |
| `not in` | Not contained in string or array | `4 not in [1,2,3]` |
| `!~in` | Not case-insensitively contained in string or array | `"x" !~in "test"` |
| `not ~in` | Not case-insensitively contained in string or array | `"x" not ~in "test"` |

#### Regex Matching

Theoretically, these operators can be used even when `allowRegexLiterals` is off, if you provide a regular expression as a variable.

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `matches` | The regex pattern matches the string, or vice versa | `@^t@ matches "test"`<br>`"test" matches @^t@`<br>`"test" matches @^T@i` |
| `!matches` | The regex pattern does not match the string, and vice versa | `@^T@ !matches "test"`<br>`"test" !matches @^T@` |

#### Type

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `is` | The type/class of the value is | `"test" is string`<br>`[] is array`<br>`[] is empty array`<br>`now() is Date` |
| `!is` | The type/class of the value is not | `"0" !is number`
| `is not` | The type/class of the value is not | `"0" is not number`

To the right side of the type operators is a string representing a type check and/or a class name. For more information on what type checks are possible, refer to the documentation for the [isit](https://github.com/lamansky/isit) module.

### Mathematical Operators

| Operator | Meaning |
| -------- | ------- |
| `+` | Add |
| `-` | Subtract |
| `*` | Multiply |
| `/` | Divide |
| `%` | Modulo |
| `^` | Exponentiate |

### Concatenation Operators

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `+` | Concatenate | `"prefix" + $str + "suffix"` |
| `before` | Prefix the left operand to the right operand if the right is non-empty | `"prefix" before $str` |
| `then` | Suffix the right operand to the left operand if the left is non-empty | `$str then "suffix"` |

### Logical Operators

| Operator | Meaning |
| -------- | ------- |
| `&` | And |
| <code>&#124;</code> | Or |

Note that this differs from JavaScript, which uses double ampersand and pipe characters.

### Prefix Operator

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `!` | Not | `!true = false` |

### Ternary Comparison Operator

```javascript
const conscript = require('conscript')()
conscript('enabled ? x=1 : x=2')({x: 1, enabled: true}) // true
conscript('(x ?: 123) = 123')({x: false}) // true
```

### Default Left Operand

If you set the `defaultLeft` option, the left sides of operations can be omitted:

```javascript
const conscript = require('conscript')()
conscript('>2 & <4 & *2=6')({}, {defaultLeft: 3}) // true
```

The only operator that cannot be used in this way is `-` (subtraction). For example, it would be ambiguous whether `-1` is supposed to represent the number negative one or is supposed to be a subtraction from the default left operand. If you need to subtract from the default left operand, prefix your expression with a plus sign (e.g. `+-1`), since adding a negative number accomplishes the same thing as does subtraction.

If you are performing equality comparison (`=`), you can even omit the operator altogether:

```javascript
conscript('"a"|"b"')({}, {defaultLeft: 'a'}) // true
conscript('"a"|"b"')({}, {defaultLeft: 'X'}) // false
```

## Version Migration Guide

Here are backward-incompatible changes you need to know about.

### 0.1.0 ⇒ 0.2.0

* The minimum supported Node version is now 8.3.0 (instead of 7.0.0).
* A complete Conscript call now involves 3 function calls instead of 2. The first function call is an opportunity to specify global settings, e.g. `require('conscript')(globalSettings)`. The only modification necessary to migrate your existing code is to change `require('conscript')` to `require('conscript')()`.
* Regular expression literals are now disabled by default, to protect against [ReDoS](https://en.wikipedia.org/wiki/ReDoS) attacks when dealing with user input. Enabling them requires the `allowRegexLiterals` option to be set to `true`.

### 0.0.0 ⇒ 0.1.0

* In version 0.0.0, the return value function signature was `({vars, defaultLeft})`. In version 0.1.0, the signature is `(vars, {defaultLeft})`. If you are using `conscript('test')({vars})`, you will need to change this to `conscript('test')(vars)`. If you are using `conscript('test')({vars, defaultLeft: 123})`, you will need to change this to `conscript('test')(vars, {defaultLeft: 123})`.
