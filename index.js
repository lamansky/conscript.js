'use strict'

const caseInsensitive = require('case-insensitive')
const equals = require('equals')
const isObject = require('is-object')
const isit = require('isit')
const {has, get} = require('m-o')
const removePrefix = require('remove-prefix')
const toNumber = require('2/number')
const toString = require('2/string')

const notAVar = Symbol('notAVar')
const u = x => typeof x === 'undefined'

const boolOps = ['&', '|']
const absCompOps = ['<', '<=', '=', '>=', '>', '<>', '~=', '^=', '^~=', '$=', '$~=', '*=', '*~=']
const compOps = [' is ', ' is not ', ' !is ', ' in ', ' ~in ', ' not in ', ' !in ', ' !~in ', ' not ~in ', ' matches ', ' !matches ', ...absCompOps, ...absCompOps.map(s => '!' + s)]
const mathOps = ['+', '-', '*', '/', '%', '^']
const regexDelimiter = '@'

const alphanumeric = /[a-zA-Z0-9]/
const digits = '0123456789'
const escape = '\\'
const ignore = [['(', ')'], ['[', ']'], ['{', '}'], ['"', '"', {escape}], ["'", "'", {escape}], ['@', '@', {escape}]]
const number = /^-?\.?[0-9]/

function getApplyRegexOperator (left, right, shouldMatch, safe) {
  return context => {
    const l = left(context)
    const r = right(context)
    if (isit.a(RegExp, l) && isit.string(r)) return !l.test(r) === !shouldMatch
    if (isit.a(RegExp, r) && isit.string(l)) return !r.test(l) === !shouldMatch
    if (safe) return false
    throw new TypeError('To use the `matches` operator, one operand must be a regular expression and the other must be a string')
  }
}

function applyBooleanOperator (left, op, right) {
  switch (op) {
    case '&': return context => left(context) && right(context)
    case '|': return context => left(context) || right(context)
  }
  throw new SyntaxError('Unhandled boolean operator `' + op + '`')
}

function applyComparisonOperator (left, op, right, safe) {
  const [absOp, neg] = removePrefix(op, '!')
  const r = applyAbsoluteComparisonOperator(left, absOp, right, safe)
  return neg ? context => !r(context) : r
}

function applyAbsoluteComparisonOperator (left, op, right, safe) {
  switch (op) {
    case ' is ': return context => isit(right(context), left(context))
    case ' !is ': case ' is not ': return context => !isit(right(context), left(context))
    case ' in ': return context => applyInclusionOperator(left(context), right(context), false)
    case ' !in ': case ' not in ': return context => !applyInclusionOperator(left(context), right(context), false)
    case ' ~in ': return context => applyInclusionOperator(left(context), right(context), true)
    case ' !~in ': case ' not ~in ': return context => !applyInclusionOperator(left(context), right(context), true)
    case ' matches ': return getApplyRegexOperator(left, right, true, safe)
    case ' !matches ': return getApplyRegexOperator(left, right, false, safe)
    case '<': return context => left(context) < right(context)
    case '<=': return context => left(context) <= right(context)
    case '=': return context => equals(left(context), right(context))
    case '>=': return context => left(context) >= right(context)
    case '>': return context => left(context) > right(context)
    case '<>': return context => left(context) !== right(context)
    case '~=': return context => toString(left(context)).toLowerCase() === toString(right(context)).toLowerCase()
    case '^=': return context => toString(left(context)).startsWith(toString(right(context)))
    case '^~=': return context => toString(left(context)).toLowerCase().startsWith(toString(right(context)).toLowerCase())
    case '$=': return context => toString(left(context)).endsWith(toString(right(context)))
    case '$~=': return context => toString(left(context)).toLowerCase().endsWith(toString(right(context)).toLowerCase())
    case '*=': return context => applyInclusionOperator(right(context), left(context), false)
    case '*~=': return context => applyInclusionOperator(right(context), left(context), true)
  }
  throw new SyntaxError('Unhandled comparison operator `' + op + '`')
}

function applyMathOperator (left, op, right) {
  switch (op) {
    case '+': return context => left(context) + right(context)
    case '-': return context => left(context) - right(context)
    case '*': return context => left(context) * right(context)
    case '/': return context => left(context) / right(context)
    case '%': return context => left(context) % right(context)
    case '^': return context => left(context) ** right(context)
  }
  throw new SyntaxError('Unhandled math operator `' + op + '`')
}

function applyInclusionOperator (needle, haystack, ci) {
  if (!Array.isArray(haystack)) {
    haystack = toString(haystack)
    needle = toString(needle)
  }
  if (ci) haystack = caseInsensitive(haystack)
  return haystack.includes(needle)
}

function callFunction (identifier, func, args, maybe) {
  func = func()
  if (typeof func === 'function') {
    return nullify(func(...args))
  } else if (!maybe) {
    throw new TypeError('`' + identifier + '` is not a function')
  }
  return null
}

function accessArrayProp (arr, prop, maybe) {
  arr = arr()
  if (Array.isArray(arr)) {
    switch (prop) {
      case 'last': return arr[arr.length - 1]
      case 'length': case 'count': return arr.length
      default: return arr[toNumber(prop, {elseThrow: 'Array index `' + prop + '` is not a number'})]
    }
  } else if (!maybe) {
    throw new TypeError('Cannot retrieve property `' + prop + '` from a non-array')
  }
  return null
}

function accessObjectProp (obj, prop, maybe) {
  obj = obj()
  if (isObject(obj)) {
    if (Array.isArray(obj)) return accessArrayProp(() => obj, prop, maybe)
    return has(obj, prop) ? get(obj, prop) : null
  } else if (!maybe) {
    throw new TypeError('Cannot retrieve property `' + prop + '` from a non-object')
  }
  return null
}

function getVar ([vars], varName) {
  if (typeof vars === 'function') {
    const value = nullify(vars(varName, notAVar))
    if (value !== notAVar) return value
  } else if (isObject(vars) && has(vars, varName)) {
    return nullify(get(vars, varName))
  }
  return notAVar
}

function nullify (x) {
  return typeof x === 'undefined' ? null : x
}

module.exports = require('parser-factory')('start', {
  start ({call}) {
    const f = call('expression')
    return (...context) => f(context)
  },

  expression ({consume, is, sub, shift, until, untilEnd}, p, {inTernary} = {}) {
    const a2t = until('?', {ignore}).trim()
    if (!consume('?')) return sub('expression2', a2t, {inTernary})
    const a2 = sub('expression2', a2t, {inTernary: true})
    const a = context => {
      const {defaultLeft} = context[1] || {}
      let value
      if (a2) value = a2(context)
      return (u(value) && !u(defaultLeft)) ? defaultLeft : value
    }
    const b2 = sub('expression', untilEnd('?', ':', {ignore}).trim(), {inTernary: true})
    const b = context => {
      const value = b2(context)
      return u(value) ? a(context) : value
    }
    if (!consume(':')) throw new SyntaxError('Missing second half of ternary expression')
    const c = sub('expression', shift(Infinity), {inTernary: true})
    return context => a(context) ? b(context) : c(context)
  },

  expression2 ({call}, p, t) {
    return call('operator', {operators: boolOps, apply: applyBooleanOperator, next: 'expression3', t})
  },

  expression3 ({call}, p, {inTernary} = {}) {
    const cb = call('operator', {operators: compOps, apply: applyComparisonOperator, next: 'expression4'})
    return context => {
      const {defaultLeft} = context[1] || {}
      const value = cb(context)
      return (inTernary || u(defaultLeft) || typeof value === 'boolean') ? value : value === defaultLeft
    }
  },

  expression4 ({call}) {
    return call('operator', {operators: mathOps, apply: applyMathOperator, next: 'value'})
  },

  operator ({char, consume, is, sub, until}, {userArgs: [{safe} = {}]}, {operators, apply, next, t}) {
    const chunk = op => {
      const value = (is('- ') ? '' : consume('-')) + until(...operators, {ignore}).trim()
      if (op && !value) throw new SyntaxError('Expected to find an expression to the right of the ' + op + ' operator.')
      return sub(next, value, t)
    }
    const wordOps = operators.reduce((w, op) => { if (op.startsWith(' ')) w.push(op.substr(1)); return w }, [])
    let initialWord = is(...wordOps)
    let leftChunk
    if (!initialWord) leftChunk = chunk()
    let left = context => {
      const {defaultLeft} = context[1] || {}
      if (u(leftChunk) && !u(defaultLeft)) return defaultLeft
      if (leftChunk) return leftChunk(context)
    }
    while (char()) {
      const op = initialWord ? ' ' + consume(...wordOps) : consume(...operators)
      if (op) left = apply(left, op, chunk(op), safe); else break
      initialWord = false
    }
    return left
  },

  whitespace ({consumeWhile}) {
    consumeWhile(' \r\n\t')
  },

  value ({bracket, call, char, consume, is, until}) {
    while (char()) {
      call('whitespace')
      if (consume('(')) return bracket('expression', '(', ')', {ignore})
      else if (consume('!')) {
        const cb = call('value')
        return context => {
          const {defaultLeft} = context[1] || {}
          const value = cb(context)
          return (u(defaultLeft) || typeof value === 'boolean') ? !value : value !== defaultLeft
        }
      } else if (consume('$')) return call('valueAccess', {identifier: call('identifier')})
      else if (consume('[')) return call('valueAccess', {accessProp: accessArrayProp, value: bracket('list', '[', ']', {ignore})})
      else if (consume(regexDelimiter)) return call('regex')
      else if (is('"', "'")) return call('string')
      else if (is('.')) return call('valueAccess')
      else if (consume('true', {ci: true})) return () => true
      else if (consume('false', {ci: true})) return () => false
      else if (consume('null', {ci: true})) return () => null
      else if (number.test(char(3))) return call('number')
      else return call('fallback')
    }
  },

  identifier ({bracket, consume, consumeWhile, throughEnd}) {
    if (consume('(')) return bracket('expression', '(', ')', {ignore})

    if (consume('{')) {
      const literal = throughEnd('{', '}', {escape})
      return () => literal
    }

    const literal = consumeWhile(alphanumeric)
    return () => literal
  },

  fallback ({call, char, until}, {userArgs: [{unknownsAre} = {}]}) {
    const identifier = until('(', '.').trim()
    if (char()) return call('valueAccess', {identifier: () => identifier})
    if (/[^a-zA-Z0-9 ]/.test(identifier)) throw new SyntaxError('Unrecognized syntax: `' + identifier + '`')
    return context => {
      const varValue = getVar(context, identifier)
      if (varValue !== notAVar) return varValue
      switch (unknownsAre) {
        default:
        case 'strings':
        case 'str':
          return identifier
        case 'null':
        case null:
          return null
        case 'errors':
        case 'err':
          throw new ReferenceError('Unknown variable: `' + identifier + '`')
      }
    }
  },

  valueAccess ({bracket, call, char, consume}, {userArgs: [{safe, safeNav = safe, safeCall = safe} = {}]}, {accessProp = accessObjectProp, identifier, value} = {}) {
    let cb = value || (identifier ? context => {
      const val = getVar(context, identifier(context))
      return val === notAVar ? null : val
    } : ([, {defaultLeft} = {}]) => {
      if (u(defaultLeft)) throw new SyntaxError('Property access chains can only begin with a dot (.) if defaultLeft is specified')
      return defaultLeft
    })
    while (char()) {
      const last = cb
      if (consume('(')) {
        const args = bracket('list', '(', ')')
        cb = context => callFunction(identifier, () => last(context), args(context), safeCall)
      } else if (consume('.')) {
        const prop = call('identifier')
        cb = context => accessProp(() => last(context), prop(context), safeNav)
      } else {
        break
      }
    }
    return cb
  },

  list ({consume, char, sub, until}) {
    const arr = []
    while (char()) {
      arr.push(sub('expression', until(',', {ignore})))
      consume(',')
    }
    return context => arr.map(item => item(context))
  },

  regex ({consume, consumeWhile, char, until}) {
    const regex = until(regexDelimiter, {escape})
    consume(regexDelimiter)
    const flags = consumeWhile('gimsuy')
    return () => new RegExp(regex, flags)
  },

  string ({consume, until}) {
    const quote = consume('"', "'")
    if (!quote) throw new Error('string subroutine called without quote in queue')
    const value = until(quote, {escape})
    consume(quote)
    return () => value
  },

  number ({char, consume, consumeWhile}) {
    const neg = !!consume('-')
    let n = ''
    let dec = false
    while (char()) {
      if (consume('.')) {
        if (dec) throw new SyntaxError('Number cannot have more than one decimal point')
        dec = true
        n += '.'
      }
      const d = consumeWhile(digits)
      if (!d) break
      n += d
    }
    n = Number(n)
    if (neg) n = -n
    return () => n
  },
})
