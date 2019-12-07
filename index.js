'use strict'

const arrify = require('arrify')
const caseInsensitive = require('case-insensitive')
const clone = require('clone')
const filterObject = require('filter-obj')
const isObject = require('is-object')
const isNonArrayObject = require('isobject')
const isit = require('isit')
const {has, get} = require('m-o')
const objectEquals = require('equals')
const removePrefix = require('remove-prefix')
const replaceString = require('replace-string')
const toNumber = require('2/number')
const toStr = require('2/string')

const notAVar = Symbol('notAVar')
const u = x => typeof x === 'undefined'

const boolOps = ['&', '|']
const absCompOps = ['<', '<=', '=', '>=', '>', '<>', '~=', '^=', '^~=', '$=', '$~=', '*=', '*~=']
const compOps = [' is ', ' is not ', ' !is ', ' in ', ' ~in ', ' not in ', ' !in ', ' !~in ', ' not ~in ', ' matches ', ' !matches ', ...absCompOps, ...absCompOps.map(s => '!' + s)]
const mathOps = ['+', ' before ', ' then ', '-', '*', '/', '%', '^']
const regexDelimiter = '@'

const identifierName = /[a-zA-Z0-9_ ]/
const notIdentifierName = /[^a-zA-Z0-9_ ]/g
const digits = '0123456789'
const esc = '\\'
const ignore = [['(', ')'], ['[', ']'], ['{', '}'], ['"', '"', {esc}], ["'", "'", {esc}], ['@', '@', {esc}]]
const number = /^-?\.?[0-9]/

function accessArrayProp (x, prop, maybe) {
  x = x()
  if (Array.isArray(x) || typeof x === 'string') {
    switch (prop) {
      case 'empty': return x.length === 0
      case 'every': return cb => Array.from(x).every(cb)
      case 'last': return x[x.length - 1]
      case 'length': case 'count': return x.length
      case 'map': return cb => Array.from(x).map(cb)
      case 'multiple': return x.length > 1
      case 'pop': return (num, handler) => {
        num = Math.abs(toNumber(num))
        const arr = Array.from(x)
        if (typeof handler !== 'function') return arr.slice(arr.length - num)
        return handler(arr.slice(0, arr.length - num), ...arr.slice(arr.length - num))
      }
      case 'shift': return (num, handler) => {
        num = Math.abs(toNumber(num))
        const arr = Array.from(x)
        if (typeof handler !== 'function') return arr.slice(0, num)
        return handler(...arr.slice(0, num), arr.slice(num, arr.length))
      }
      case 'some': return cb => Array.from(x).some(cb)
      case 'slice': return (start, stop) => x.slice(start, stop)
      default: return x[toNumber(prop, {elseThrow: 'Array index `' + prop + '` is not a number'})]
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

function applyAbsoluteComparisonOperator (left, op, right, safeOp) {
  switch (op) {
    case ' is ': return args => isit(right(args), left(args))
    case ' !is ': case ' is not ': return args => !isit(right(args), left(args))
    case ' in ': return args => applyInclusionOperator(left(args), right(args), false)
    case ' !in ': case ' not in ': return args => !applyInclusionOperator(left(args), right(args), false)
    case ' ~in ': return args => applyInclusionOperator(left(args), right(args), true)
    case ' !~in ': case ' not ~in ': return args => !applyInclusionOperator(left(args), right(args), true)
    case ' matches ': return getApplyRegexOperator(left, right, true, safeOp)
    case ' !matches ': return getApplyRegexOperator(left, right, false, safeOp)
    case '<': return args => left(args) < right(args)
    case '<=': return args => left(args) <= right(args)
    case '=': return args => equals(left(args), right(args))
    case '>=': return args => left(args) >= right(args)
    case '>': return args => left(args) > right(args)
    case '<>': return args => left(args) !== right(args)
    case '~=': return args => toStr(left(args)).toLowerCase() === toStr(right(args)).toLowerCase()
    case '^=': return args => toStr(left(args)).startsWith(toStr(right(args)))
    case '^~=': return args => toStr(left(args)).toLowerCase().startsWith(toStr(right(args)).toLowerCase())
    case '$=': return args => toStr(left(args)).endsWith(toStr(right(args)))
    case '$~=': return args => toStr(left(args)).toLowerCase().endsWith(toStr(right(args)).toLowerCase())
    case '*=': return args => applyInclusionOperator(right(args), left(args), false)
    case '*~=': return args => applyInclusionOperator(right(args), left(args), true)
  }
  throw new SyntaxError('Unhandled comparison operator `' + op + '`')
}

function applyBooleanOperator (left, op, right) {
  switch (op) {
    case '&': return args => left(args) && right(args)
    case '|': return args => left(args) || right(args)
  }
  throw new SyntaxError('Unhandled boolean operator `' + op + '`')
}

function applyComparisonOperator (left, op, right, safeOp) {
  const [absOp, neg] = removePrefix(op, '!')
  const r = applyAbsoluteComparisonOperator(left, absOp, right, safeOp)
  return neg ? args => !r(args) : r
}

function applyInclusionOperator (needle, haystack, ci) {
  if (!Array.isArray(haystack)) {
    haystack = toStr(haystack)
    needle = toStr(needle)
  }
  if (ci) haystack = caseInsensitive(haystack)
  return haystack.includes(needle)
}

function applyMathOperator (left, op, right, safeOp) {
  function checkResult (result) {
    if (Number.isNaN(result)) {
      if (safeOp) return 0
      throw new TypeError('Cannot perform ' + op + ' operation on a non-number')
    }
    return result
  }

  function add (l, r) {
    const la = Array.isArray(l)
    const ra = Array.isArray(r)
    const ln = typeof l === 'number'
    const rn = typeof r === 'number'
    const ls = typeof l === 'string'
    const rs = typeof r === 'string'

    if (la) return l.concat(ra ? r : [r])
    if (ra) return (la ? l : [l]).concat(r)
    if (isNonArrayObject(l) && isNonArrayObject(r)) return {...l, ...r}

    if (ln & rs) r = toNumber(r)
    else if (ls & rn) l = toNumber(l)
    else if (ls & !rs) {
      if (!rn && !safeOp) throw new TypeError('Cannot concatenate a non-string to a string')
      r = toStr(r)
    } else if (!ls & rs) {
      if (!ln && !safeOp) throw new TypeError('Cannot concatenate a string to a non-string')
      l = toStr(l)
    } else if (ln & !rn) {
      if (!safeOp) throw new TypeError('Cannot add a non-number to a number')
      r = 0
    } else if (!ln & rn) {
      if (!safeOp) throw new TypeError('Cannot add a number to a non-number')
      l = 0
    }

    return l + r
  }

  switch (op) {
    case '+': return args => checkResult(add(left(args), right(args)))
    case '-': return args => {
      let l = left(args)
      let r = right(args)

      if (Array.isArray(l)) {
        r = arrify(r)
        return l.filter(x => !r.includes(x))
      }

      if (isObject(l)) {
        if (isObject(r) && !Array.isArray(r)) {
          const re = Object.entries(r)
          return filterObject(l, (lk, lv) => !re.some(([rk, rv]) => equals(lk, rk) && equals(lv, rv)))
        }

        r = arrify(r)
        return filterObject(l, lk => !r.some(rk => equals(lk, rk)))
      }

      const ln = typeof l === 'number'
      const rn = typeof r === 'number'
      const ls = typeof l === 'string'
      const rs = typeof r === 'string'

      if (ls && rs) return replaceString(l, r, '')

      if (ln & rs) r = toNumber(r)
      else if (ls & rn) l = toNumber(l)

      return checkResult(l - r)
    }
    case '*': return args => checkResult(left(args) * right(args))
    case '/': return args => {
      const l = left(args)
      const r = right(args)
      if (Object.is(r, 0)) return Infinity
      if (Object.is(r, -0)) return -Infinity
      return checkResult(l / r)
    }
    case '%': return args => checkResult(left(args) % right(args))
    case '^': return args => checkResult(left(args) ** right(args))
    case ' before ': return args => {
      const rightResult = toStr(right(args))
      return rightResult ? toStr(left(args)) + rightResult : rightResult
    }
    case ' then ': return args => {
      const leftResult = left(args)
      return leftResult ? checkResult(add(leftResult === true ? '' : leftResult, right(args))) : leftResult
    }
  }
  throw new SyntaxError('Unhandled math operator `' + op + '`')
}

function callFunction (identifier, func, funcArgs, maybe) {
  func = func()
  if (typeof func === 'function') {
    return nullify(func(...funcArgs))
  } else if (!maybe) {
    throw new TypeError('`' + (identifier || func) + '` is not a function')
  }
  return null
}

function equals (l, r) {
  l = zeroStringToNumber(l)
  r = zeroStringToNumber(r)
  if (l === 0 && r === 0) return Object.is(l, r)
  return objectEquals(l, r)
}

function getApplyRegexOperator (left, right, shouldMatch, safeOp) {
  return args => {
    const l = left(args)
    const r = right(args)
    if (isit.a(RegExp, l) && isit.string(r)) return !l.test(r) === !shouldMatch
    if (isit.a(RegExp, r) && isit.string(l)) return !r.test(l) === !shouldMatch
    if (safeOp) return false
    throw new TypeError('To use the `matches` operator, one operand must be a regular expression and the other must be a string')
  }
}

function getUserVar ([vars], varName) {
  if (typeof vars === 'function') {
    const value = nullify(vars(varName, notAVar))
    if (value !== notAVar) return value
  } else if (isObject(vars) && has(vars, varName)) {
    return nullify(get(vars, varName))
  }
  return notAVar
}

function nullify (x) {
  return (typeof x === 'undefined' || Number.isNaN(x)) ? null : x
}

function zeroStringToNumber (x) {
  if (x === '0') return 0
  if (x === '-0') return -0
  return x
}

const conscript = require('parser-factory')('start', {
  start ({call}) {
    const f = call('expression')
    return (...args) => f(args)
  },

  expression ({consume, is, sub, shift, until, untilEnd}, p, {getVar = getUserVar, inTernary} = {}) {
    const a2t = until('?', {ignore}).trim()
    if (!consume('?')) return sub('expression2', a2t, {getVar, inTernary})
    const a2 = sub('expression2', a2t, {getVar, inTernary: true})
    const a = args => {
      const {defaultLeft} = args[1] || {}
      let value
      if (a2) value = a2(args)
      return (u(value) && !u(defaultLeft)) ? defaultLeft : value
    }
    const b2 = sub('expression', untilEnd('?', ':', {ignore}).trim(), {getVar, inTernary: true})
    const b = args => {
      const value = b2(args)
      return u(value) ? a(args) : value
    }
    if (!consume(':')) throw new SyntaxError('Missing second half of ternary expression')
    const c = sub('expression', shift(Infinity), {getVar, inTernary: true})
    return args => a(args) ? b(args) : c(args)
  },

  expression2 ({call}, p, t) {
    return call('operator', {operators: boolOps, apply: applyBooleanOperator, next: 'expression3', t})
  },

  expression3 ({call}, p, t = {}) {
    const {inTernary} = t
    const cb = call('operator', {operators: compOps, apply: applyComparisonOperator, next: 'expression4', t})
    return args => {
      const {defaultLeft} = args[1] || {}
      const value = cb(args)
      return (inTernary || u(defaultLeft) || typeof value === 'boolean') ? value : value === defaultLeft
    }
  },

  expression4 ({call}, p, t) {
    return call('operator', {operators: mathOps, apply: applyMathOperator, next: 'value', t})
  },

  operator ({call, char, consume, is, sub, until}, {userArgs: [{safe, safeOp = safe} = {}]}, {operators, apply, next, t}) {
    const chunk = op => {
      const value = (is('- ') ? '' : consume('-')) + until(...operators, {ignore}).trim()
      if (op && !value) throw new SyntaxError('Expected to find an expression to the right of the ' + op + ' operator.')
      return sub(next, value, t)
    }
    const wordOps = operators.reduce((w, op) => { if (op.startsWith(' ')) w.push(op.substr(1)); return w }, [])
    let initialWord = is(...wordOps)
    let leftChunk
    if (!initialWord) leftChunk = chunk()
    let left = args => {
      const {defaultLeft} = args[1] || {}
      if (u(leftChunk) && !u(defaultLeft)) return defaultLeft
      if (leftChunk) return leftChunk(args)
    }
    while (char()) {
      const op = initialWord ? ' ' + consume(...wordOps) : consume(...operators)
      call('whitespace')
      if (op) left = apply(left, op, chunk(op), safeOp); else break
      initialWord = false
    }
    return left
  },

  whitespace ({consumeWhile}) {
    consumeWhile(' \r\n\t')
  },

  value ({bracket, call, char, consume, is, until}, {userArgs: [{allowRegexLiterals, debugOutput} = {}]}, {getVar} = {}) {
    while (char()) {
      call('whitespace')
      if (consume('(')) return call('valueAccess', {getVar, value: call('parens', {getVar})})
      else if (consume('!')) {
        const cb = call('value', {getVar})
        return args => {
          const {defaultLeft} = args[1] || {}
          const value = cb(args)
          return (u(defaultLeft) || typeof value === 'boolean') ? !value : value !== defaultLeft
        }
      } else if (consume('debug ')) {
        const syntax = char(Infinity)
        const cb = call('value', {getVar})
        return args => {
          const value = cb(args)
          if (typeof debugOutput === 'function') debugOutput(syntax, value)
          return value
        }
      } else if (consume('$')) return call('valueAccess', {getVar, identifier: call('identifier')})
      else if (consume('[')) return call('valueAccess', {accessProp: accessArrayProp, getVar, value: bracket('list', '[', ']', {ignore})})
      else if (allowRegexLiterals && consume(regexDelimiter)) return call('regex')
      else if (is('"', "'")) return call('valueAccess', {accessProp: accessArrayProp, getVar, value: call('string')})
      else if (is('.')) return call('valueAccess', {getVar})
      else if (consume('true', {ci: true})) return () => true
      else if (consume('false', {ci: true})) return () => false
      else if (consume('null', {ci: true})) return () => null
      else if (consume('-∞') || consume('-infinity', {ci: true})) return () => -Infinity
      else if (consume('∞') || consume('infinity', {ci: true})) return () => Infinity
      else if (number.test(char(3))) return call('number')
      return call('fallback', {getVar})
    }
  },

  identifier ({bracket, consume, consumeWhile, throughEnd}) {
    if (consume('(')) return bracket('expression', '(', ')', {ignore})

    if (consume('{')) {
      const literal = throughEnd('{', '}', {esc})
      return () => literal
    }

    const literal = consumeWhile(identifierName).trim()
    return () => literal
  },

  fallback ({call, char, until}, {userArgs: [{unknownsAre} = {}]}, {getVar} = {}) {
    const identifier = until('(', '.').trim()
    if (char()) return call('valueAccess', {identifier: () => identifier, getVar})
    if (notIdentifierName.test(identifier)) throw new SyntaxError('Unrecognized syntax: `' + identifier + '`')
    return args => {
      const varValue = getVar(args, identifier)
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

  valueAccess ({bracket, call, char, consume}, {userArgs: [{safe, safeNav = safe, safeCall = safe} = {}]}, {accessProp = accessObjectProp, getVar, identifier, value} = {}) {
    let cb = value || (identifier ? args => {
      const varName = identifier(args)
      if (varName === '') return isNonArrayObject(args[0]) ? clone(args[0]) : {}
      const val = getVar(args, varName)
      return val === notAVar ? null : val
    } : ([, {defaultLeft} = {}]) => {
      if (u(defaultLeft)) throw new SyntaxError('Property access chains can only begin with a dot (.) if defaultLeft is specified')
      return defaultLeft
    })
    while (char()) {
      call('whitespace')
      const last = cb
      if (consume('(')) {
        const funcArgs = bracket('list', '(', ')')
        cb = args => callFunction(identifier, () => last(args), funcArgs(args), safeCall)
      } else if (consume('.')) {
        const prop = call('identifier')
        cb = args => accessProp(() => last(args), prop(args), safeNav)
      } else {
        break
      }
    }
    return cb
  },

  parens ({call, char, consume, sub, throughEnd, until}, p, {getVar}) {
    const first = throughEnd('(', ')', {ignore})
    call('whitespace')
    const second = consume('{') ? throughEnd('{', '}', {ignore}) : null
    if (second === null) return sub('expression', first)

    // We're dealing with a function
    const varNames = sub('list', first, {evaluate: false})
      .map(varName => varName.replace(notIdentifierName, ''))
    return userArgs => (...funcArgs) => {
      const argVars = new Map()
      for (let i = 0; i < varNames.length; i++) {
        const varName = varNames[i]
        if (!varName) continue
        argVars.set(varName, i >= funcArgs.length ? null : funcArgs[i])
      }
      return sub('expression', second, {
        getVar: ([vars], varName) => argVars.has(varName) ? argVars.get(varName) : getVar([vars], varName),
      })(userArgs)
    }
  },

  list ({consume, char, sub, until}, p, {evaluate = true} = {}) {
    const arr = []
    while (char()) {
      arr.push(evaluate ? sub('expression', until(',', {ignore})) : until(','))
      consume(',')
    }
    return evaluate ? args => arr.map(item => item(args)) : arr.map(item => item.trim())
  },

  regex ({consume, consumeWhile, char, until}) {
    const regex = until(regexDelimiter, {esc})
    consume(regexDelimiter)
    const flags = consumeWhile('gimsuy')
    return () => new RegExp(regex, flags)
  },

  string ({consume, until}) {
    const quote = consume('"', "'")
    if (!quote) throw new Error('string subroutine called without quote in queue')
    const value = until(quote, {esc})
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

module.exports = (defaultOptions = {}) => (conscription, options = {}) => conscript(conscription, {...defaultOptions, ...options})
