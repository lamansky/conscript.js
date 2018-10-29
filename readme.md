# conscript.js

The JavaScript parser for the Conscript language. Conscript (pronounced _CON-script_) is a very simple language for writing potentially-complex sets of conditions according to which data should be evaluated. A script written in this language is called a “Conscription” and is usually only one line long. Think of it as being analogous to the `WHERE` component of a SQL query.

Here’s an example that uses Conscript in a calendar context:

```javascript
const conscript = require('conscript')

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

Requires [Node.js](https://nodejs.org/) 7.0.0 or above.

```bash
npm i conscript
```

## API

The module exports a single function.

### Parameters

1. `conscription` (string): A condition script.
2. Optional: Object argument:
    * `safeCall` (bool): If set to `true`, calling a non-function will fail silently and generate `null`. If set to `false`, an error will be thrown. Defaults to `false`.
    * `safeNav` (bool): If set to `true`, accessing a property of a non-object will fail silently and generate `null`. If set to `false`, an error will be thrown. Defaults to `false`.
    * `safe` (bool): A shortcut for setting both `safeCall` and `safeNav` simultaneously.
    * `unknownsAre` (string): A mode for handling unknown identifiers. Possible values are:
        * `strings` (default): Treat unknown identifiers as as strings.
        * `null`: Convert unknown identifiers to `null`.
        * `errors`: Throw a `ReferenceError` whenever an unknown identifier is found.

### Return Value

Converts the condition script into a function. This returned function accepts one object argument:

#### Parameters

* Optional: Object argument:
    * `defaultLeft` (any): A value to be used as the left operand for operations that omit a left operand.
    * `vars` (function, object, or Map)
        * If `vars` is a function, it is called whenever Conscript comes across an identifier, and is passed two arguments: the identifier name, and a `notAVar` symbol to be returned if the identifier is not a variable.
        * If `vars` is an object or Map, its keys are considered the variables to which the values are mapped.

#### Return Value

Returns `true` or `false` depending on whether or not the condition script is met on the basis of `vars`.

## Conscript Syntax

Here are some of the language features which you can use in the Conscript string that you pass to the parser:

### Literals

Conscript supports string literals and number literals. String literals are surrounded with either double or single quotes.

```javascript
conscript('2 > 1')() // true
conscript('"test" = "test"')() // true
```

If `unknownsAre` is set to `strings`, then strings do not need to be quoted.

```javascript
conscript('test is string')() // true
```

### Variables

```javascript
conscript('x=1')({x: 1}) // true
conscript('x=1')({x: 2}) // false
```

When Conscript comes across an identifier (`x` in the example above), it will look for its value in the `vars` argument.

Normally, variable names must be alphanumeric. If you need support for more characters, use the `${var}` construction:

```javascript
conscript('${hello world!}=123')({'hello world!': 123}) // true
```

You can also implement dynamic variables by passing a function instead of a dictionary object:

```javascript
conscript('variable="variable"')(varName => varName) // true
```

### Arrays

Arrays are created using square brackets and can contain literals or variables.

```javascript
// The *= operator checks to see if the array on the left contains the value on the right.
conscript('[123, "test", var] *= "value"')({var: 'value'}) // true
```

### Functions

You can pass functions as variables and can call them from within the condition string.

```javascript
const vars = {
  sum (a, b) { return a + b },
}
conscript('sum(2,2)=4')(vars) // true
```

If the variable is not a function, the Conscript parser will throw an error. If you want non-function calls to fail silently, set the `safeCall` setting to `true`.

### Parentheses

Clauses can be grouped with parentheses, allowing for nested logical tests.

```javascript
conscript('(x>0&x<=y-1)|x=999')({x: 51, y: 100}) // true
```

### Property Access

If one of your variables is an object, you can access its properties like so:

```javascript
const vars = {
  obj: {a: 1},
}
conscript('obj.a=1')(vars) // true
```

Normally, property names must be alphanumeric. If you need support for more characters, use the `.{prop}` construction:

```javascript
const vars = {
  obj: {'number one': 1},
}
conscript('obj.{number one}=1')(vars) // true
```

### Comparison Operators

All comparisons of equality or inequality are strict, except for the case-insensitive operators.

Operators that specifically work on strings (such as the “starts with” / “ends with” operators) will result in both operands being casted to strings.

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `=` | Equals | `1 = 1`<br>`"a" = "a"` |
| `~=` | Case-insensitively equals | `"Abc" ~= "abc"` |
| `>` | Greater than | `2 > 1` |
| `>=` | Greater than or equal to | `1 >= 1` |
| `<` | Less than | `2 < 3` |
| `<=` | Less than or equal to | `2 <= 3` |
| `<>` | Not equal to | `100 <> 200`<br>`"a" <> "b"` |
| `!=` | Not equal to | `100 != 200`<br>`"a" != "b"` |
| `^=` | String starts with | `"test" ^= "t"` |
| `^~=` | String case-insensitively starts with | `"Test" ^~= "t"` |
| `!^=` | String does not start with | `"test" !^= "T"` |
| `!^~=` | String does not case-insensitively start with | `"test" !^~= "x"` |
| `$=` | String ends with | `"test" $= "t"` |
| `$~=` | String case-insensitively ends with | `"Test" $~= "t"` |
| `!$=` | String does not end with | `"test" !$= "T"` |
| `!$~=` | String does not case-insensitively end with | `"test" !$~= "x"` |
| `*=` | String or array contains | `"test" *= "e"`<br>`[1,2,3] *= 1` |
| `*~=` | String or array case-insensitively contains |`"test" *~= "E"`<br>`["Hello", "world"] *~= "hello"` |
| `!*=` | String or array does not contain | `"test" !*= "T"`<br>`[1,2,3] !*= 4` |
| `!*~=` | String or array does not case-insensitively contain | `"test" !*~= "x"` |

### Type Operators

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `is` | The type/class of the value is | `"test" is string`<br>`[] is array`<br>`[] is empty array`<br>`now() is Date` |
| `!is` | The type/class of the value is not | `"0" !is number`
| `is not` | The type/class of the value is not | `"0" is not number`

To the right side of the type operators is a string representing a type check and/or a class name. For more information on what type checks are possible, refer to the documentation for the [isit](https://github.com/lamansky/isit) module.

### Mathematical Operators

| Operator | Meaning |
| -------- | ------- |
| `+` | Add or concatenate |
| `-` | Subtract |
| `*` | Multiply |
| `/` | Divide |
| `%` | Modulo |
| `^` | Exponentiate |

### Logical Operators

| Operator | Meaning |
| -------- | ------- |
| `&` | And |
| <code>&#124;</code> | Or |

### Prefix Operator

| Operator | Meaning | Example |
| -------- | ------- | ------- |
| `!` | Not | `!true = false` |

### Ternary Comparison Operator

```javascript
conscript('enabled ? x=1 : x=2')({x: 1, enabled: true}) // true
conscript('(x ?: 123) = 123')({x: false}) // true
```

### Default Left Operand

If you set the `defaultLeft` option, the left sides of operations can be omitted:

```javascript
conscript('>2 & <4 & *2=6', {defaultLeft: 3})() // true
```

The only operator that cannot be used in this way is `-` (subtraction). For example, it would be ambiguous whether `-1` is supposed to represent the number negative one or is supposed to be a subtraction from the default left operand. If you need to subtract from the default left operand, prefix your expression with a plus sign (e.g. `+-1`), since adding a negative number accomplishes the same thing as does subtraction.

If you are performing equality comparison (`=`), you can even omit the operator altogether:

```javascript
conscript('"a"|"b"', {defaultLeft: 'a'})() // true
conscript('"a"|"b"', {defaultLeft: 'X'})() // false
```
