"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.base64Decode = base64Decode;
exports.base64Encode = base64Encode;
exports.continuationEncode = continuationEncode;
Object.defineProperty(exports, "convert", {
  enumerable: true,
  get: function get() {
    return _charset.convert;
  }
});
Object.defineProperty(exports, "decode", {
  enumerable: true,
  get: function get() {
    return _charset.decode;
  }
});
Object.defineProperty(exports, "encode", {
  enumerable: true,
  get: function get() {
    return _charset.encode;
  }
});
exports.foldLines = foldLines;
exports.headerLineDecode = headerLineDecode;
exports.headerLineEncode = headerLineEncode;
exports.headerLinesDecode = headerLinesDecode;
exports.mimeDecode = mimeDecode;
exports.mimeEncode = mimeEncode;
exports.mimeWordDecode = mimeWordDecode;
exports.mimeWordEncode = mimeWordEncode;
exports.mimeWordsDecode = mimeWordsDecode;
exports.mimeWordsEncode = mimeWordsEncode;
exports.parseHeaderValue = parseHeaderValue;
exports.quotedPrintableDecode = quotedPrintableDecode;
exports.quotedPrintableEncode = quotedPrintableEncode;
var _emailjsBase = require("emailjs-base64");
var _charset = require("./charset");
function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); enumerableOnly && (symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; })), keys.push.apply(keys, symbols); } return keys; }
function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; i % 2 ? ownKeys(Object(source), !0).forEach(function (key) { _defineProperty(target, key, source[key]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } return target; }
function _defineProperty(obj, key, value) { key = _toPropertyKey(key); if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
function _toPropertyKey(arg) { var key = _toPrimitive(arg, "string"); return _typeof(key) === "symbol" ? key : String(key); }
function _toPrimitive(input, hint) { if (_typeof(input) !== "object" || input === null) return input; var prim = input[Symbol.toPrimitive]; if (prim !== undefined) { var res = prim.call(input, hint || "default"); if (_typeof(res) !== "object") return res; throw new TypeError("@@toPrimitive must return a primitive value."); } return (hint === "string" ? String : Number)(input); }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _iterableToArrayLimit(arr, i) { var _i = null == arr ? null : "undefined" != typeof Symbol && arr[Symbol.iterator] || arr["@@iterator"]; if (null != _i) { var _s, _e, _x, _r, _arr = [], _n = !0, _d = !1; try { if (_x = (_i = _i.call(arr)).next, 0 === i) { if (Object(_i) !== _i) return; _n = !1; } else for (; !(_n = (_s = _x.call(_i)).done) && (_arr.push(_s.value), _arr.length !== i); _n = !0); } catch (err) { _d = !0, _e = err; } finally { try { if (!_n && null != _i["return"] && (_r = _i["return"](), Object(_r) !== _r)) return; } finally { if (_d) throw _e; } } return _arr; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
// Lines can't be longer than 76 + <CR><LF> = 78 bytes
// http://tools.ietf.org/html/rfc2045#section-6.7
var MAX_LINE_LENGTH = 76;
var MAX_MIME_WORD_LENGTH = 52;
var MAX_B64_MIME_WORD_BYTE_LENGTH = 39;

/**
 * Encodes all non printable and non ascii bytes to =XX form, where XX is the
 * byte value in hex. This function does not convert linebreaks etc. it
 * only escapes character sequences
 *
 * @param {String|Uint8Array} data Either a string or an Uint8Array
 * @param {String} [fromCharset='UTF-8'] Source encoding
 * @return {String} Mime encoded string
 */
function mimeEncode() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'UTF-8';
  var buffer = (0, _charset.convert)(data, fromCharset);
  return buffer.reduce(function (aggregate, ord, index) {
    return _checkRanges(ord) && !((ord === 0x20 || ord === 0x09) && (index === buffer.length - 1 || buffer[index + 1] === 0x0a || buffer[index + 1] === 0x0d)) ? aggregate + String.fromCharCode(ord) // if the char is in allowed range, then keep as is, unless it is a ws in the end of a line
    : aggregate + '=' + (ord < 0x10 ? '0' : '') + ord.toString(16).toUpperCase();
  }, '');
  function _checkRanges(nr) {
    var ranges = [
    // https://tools.ietf.org/html/rfc2045#section-6.7
    [0x09],
    // <TAB>
    [0x0a],
    // <LF>
    [0x0d],
    // <CR>
    [0x20, 0x3c],
    // <SP>!"#$%&'()*+,-./0123456789:;
    [0x3e, 0x7e] // >?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}
    ];

    return ranges.reduce(function (val, range) {
      return val || range.length === 1 && nr === range[0] || range.length === 2 && nr >= range[0] && nr <= range[1];
    }, false);
  }
}

/**
 * Decodes mime encoded string to an unicode string
 *
 * @param {String} str Mime encoded string
 * @param {String} [fromCharset='UTF-8'] Source encoding
 * @return {String} Decoded unicode string
 */
function mimeDecode() {
  var _str$match;
  var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'UTF-8';
  var encodedBytesCount = ((_str$match = str.match(/=[\da-fA-F]{2}/g)) !== null && _str$match !== void 0 ? _str$match : []).length;
  var buffer = new Uint8Array(str.length - encodedBytesCount * 2);
  for (var i = 0, len = str.length, bufferPos = 0; i < len; i++) {
    var hex = str.substr(i + 1, 2);
    var chr = str.charAt(i);
    if (chr === '=' && hex && /[\da-fA-F]{2}/.test(hex)) {
      buffer[bufferPos++] = parseInt(hex, 16);
      i += 2;
    } else {
      buffer[bufferPos++] = chr.charCodeAt(0);
    }
  }
  return (0, _charset.decode)(buffer, fromCharset);
}

/**
 * Encodes a string or an typed array of given charset into unicode
 * base64 string. Also adds line breaks
 *
 * @param {String|Uint8Array} data String or typed array to be base64 encoded
 * @param {String} Initial charset, e.g. 'binary'. Defaults to 'UTF-8'
 * @return {String} Base64 encoded string
 */
function base64Encode(data) {
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'UTF-8';
  var buf = typeof data !== 'string' && fromCharset === 'binary' ? data : (0, _charset.convert)(data, fromCharset);
  var b64 = (0, _emailjsBase.encode)(buf);
  return _addBase64SoftLinebreaks(b64);
}

/**
 * Decodes a base64 string of any charset into an unicode string
 *
 * @param {String} str Base64 encoded string
 * @param {String} [fromCharset='UTF-8'] Original charset of the base64 encoded string
 * @return {String} Decoded unicode string
 */
function base64Decode(str, fromCharset) {
  var buf = (0, _emailjsBase.decode)(str, _emailjsBase.OUTPUT_TYPED_ARRAY);
  return fromCharset === 'binary' ? (0, _charset.arr2str)(buf) : (0, _charset.decode)(buf, fromCharset);
}

/**
 * Encodes a string or an Uint8Array into a quoted printable encoding
 * This is almost the same as mimeEncode, except line breaks will be changed
 * as well to ensure that the lines are never longer than allowed length
 *
 * @param {String|Uint8Array} data String or an Uint8Array to mime encode
 * @param {String} [fromCharset='UTF-8'] Original charset of the string
 * @return {String} Mime encoded string
 */
function quotedPrintableEncode() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'UTF-8';
  var mimeEncodedStr = mimeEncode(data, fromCharset).replace(/\r?\n|\r/g, '\r\n') // fix line breaks, ensure <CR><LF>
  .replace(/[\t ]+$/gm, function (spaces) {
    return spaces.replace(/ /g, '=20').replace(/\t/g, '=09');
  }); // replace spaces in the end of lines

  return _addQPSoftLinebreaks(mimeEncodedStr); // add soft line breaks to ensure line lengths sjorter than 76 bytes
}

/**
 * Decodes a string from a quoted printable encoding. This is almost the
 * same as mimeDecode, except line breaks will be changed as well
 *
 * @param {String} str Mime encoded string to decode
 * @param {String} [fromCharset='UTF-8'] Original charset of the string
 * @return {String} Mime decoded string
 */
function quotedPrintableDecode() {
  var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'UTF-8';
  var rawString = str.replace(/[\t ]+$/gm, '') // remove invalid whitespace from the end of lines
  .replace(/=(?:\r?\n|$)/g, ''); // remove soft line breaks

  return mimeDecode(rawString, fromCharset);
}

/**
 * Encodes a string or an Uint8Array to an UTF-8 MIME Word
 *   https://tools.ietf.org/html/rfc2047
 *
 * @param {String|Uint8Array} data String to be encoded
 * @param {String} mimeWordEncoding='Q' Encoding for the mime word, either Q or B
 * @param {String} [fromCharset='UTF-8'] Source sharacter set
 * @return {String} Single or several mime words joined together
 */
function mimeWordEncode(data) {
  var mimeWordEncoding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'Q';
  var fromCharset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'UTF-8';
  var parts = [];
  var str = typeof data === 'string' ? data : (0, _charset.decode)(data, fromCharset);
  if (mimeWordEncoding === 'Q') {
    var _str = typeof data === 'string' ? data : (0, _charset.decode)(data, fromCharset);
    var encodedStr = qEncodeForbiddenHeaderChars(mimeEncode(_str));
    parts = encodedStr.length < MAX_MIME_WORD_LENGTH ? [encodedStr] : _splitMimeEncodedString(encodedStr, MAX_MIME_WORD_LENGTH);
  } else {
    // Fits as much as possible into every line without breaking utf-8 multibyte characters' octets up across lines
    var j = 0;
    var i = 0;
    while (i < str.length) {
      if ((0, _charset.encode)(str.substring(j, i)).length > MAX_B64_MIME_WORD_BYTE_LENGTH) {
        // we went one character too far, substring at the char before
        parts.push(str.substring(j, i - 1));
        j = i - 1;
      } else {
        i++;
      }
    }
    // add the remainder of the string
    str.substring(j) && parts.push(str.substring(j));
    parts = parts.map(_charset.encode).map(_emailjsBase.encode);
  }
  var prefix = '=?UTF-8?' + mimeWordEncoding + '?';
  var suffix = '?= ';
  return parts.map(function (p) {
    return prefix + p + suffix;
  }).join('').trim();
}

/**
 * Q-Encodes remaining forbidden header chars
 *   https://tools.ietf.org/html/rfc2047#section-5
 */
var qEncodeForbiddenHeaderChars = function qEncodeForbiddenHeaderChars(str) {
  var qEncode = function qEncode(chr) {
    return chr === ' ' ? '_' : '=' + (chr.charCodeAt(0) < 0x10 ? '0' : '') + chr.charCodeAt(0).toString(16).toUpperCase();
  };
  return str.replace(/[^a-z0-9!*+\-/=]/gi, qEncode);
};

/**
 * Finds word sequences with non ascii text and converts these to mime words
 *
 * @param {String|Uint8Array} data String to be encoded
 * @param {String} mimeWordEncoding='Q' Encoding for the mime word, either Q or B
 * @param {String} [fromCharset='UTF-8'] Source sharacter set
 * @return {String} String with possible mime words
 */
function mimeWordsEncode() {
  var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var mimeWordEncoding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'Q';
  var fromCharset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'UTF-8';
  var regex = /([^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*(?:\s+[^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*\s*)?)+(?=\s|$)/g;
  return (0, _charset.decode)((0, _charset.convert)(data, fromCharset)).replace(regex, function (match) {
    return match.length ? mimeWordEncode(match, mimeWordEncoding, fromCharset) : '';
  });
}

/**
 * Decode a complete mime word encoded string
 *
 * @param {String} str Mime word encoded string
 * @return {String} Decoded unicode string
 */
function mimeWordDecode() {
  var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var match = str.match(/^=\?([\w_\-*]+)\?([QqBb])\?([^?]*)\?=$/i);
  if (!match) return str;

  // RFC2231 added language tag to the encoding
  // see: https://tools.ietf.org/html/rfc2231#section-5
  // this implementation silently ignores this tag
  var fromCharset = match[1].split('*').shift();
  var encoding = (match[2] || 'Q').toString().toUpperCase();
  var rawString = (match[3] || '').replace(/_/g, ' ');
  if (encoding === 'B') {
    return base64Decode(rawString, fromCharset);
  } else if (encoding === 'Q') {
    return mimeDecode(rawString, fromCharset);
  } else {
    return str;
  }
}

/**
 * Decode a string that might include one or several mime words
 *
 * @param {String} str String including some mime words that will be encoded
 * @return {String} Decoded unicode string
 */
function mimeWordsDecode() {
  var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  str = str.toString().replace(/(=\?[^?]+\?[QqBb]\?[^?]+\?=)\s+(?==\?[^?]+\?[QqBb]\?[^?]*\?=)/g, '$1');
  // join bytes of multi-byte UTF-8
  var prevEncoding;
  str = str.replace(/(\?=)?=\?[uU][tT][fF]-8\?([QqBb])\?/g, function (match, endOfPrevWord, encoding) {
    var result = endOfPrevWord && encoding === prevEncoding ? '' : match;
    prevEncoding = encoding;
    return result;
  });
  str = str.replace(/=\?[\w_\-*]+\?[QqBb]\?[^?]*\?=/g, function (mimeWord) {
    return mimeWordDecode(mimeWord.replace(/\s+/g, ''));
  });
  return str;
}

/**
 * Folds long lines, useful for folding header lines (afterSpace=false) and
 * flowed text (afterSpace=true)
 *
 * @param {String} str String to be folded
 * @param {Boolean} afterSpace If true, leave a space in th end of a line
 * @return {String} String with folded lines
 */
function foldLines() {
  var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var afterSpace = arguments.length > 1 ? arguments[1] : undefined;
  var pos = 0;
  var len = str.length;
  var result = '';
  var line, match;
  while (pos < len) {
    line = str.substr(pos, MAX_LINE_LENGTH);
    if (line.length < MAX_LINE_LENGTH) {
      result += line;
      break;
    }
    if (match = line.match(/^[^\n\r]*(\r?\n|\r)/)) {
      line = match[0];
      result += line;
      pos += line.length;
      continue;
    } else if ((match = line.match(/(\s+)[^\s]*$/)) && match[0].length - (afterSpace ? (match[1] || '').length : 0) < line.length) {
      line = line.substr(0, line.length - (match[0].length - (afterSpace ? (match[1] || '').length : 0)));
    } else if (match = str.substr(pos + line.length).match(/^[^\s]+(\s*)/)) {
      line = line + match[0].substr(0, match[0].length - (!afterSpace ? (match[1] || '').length : 0));
    }
    result += line;
    pos += line.length;
    if (pos < len) {
      result += '\r\n';
    }
  }
  return result;
}

/**
 * Encodes and folds a header line for a MIME message header.
 * Shorthand for mimeWordsEncode + foldLines
 *
 * @param {String} key Key name, will not be encoded
 * @param {String|Uint8Array} value Value to be encoded
 * @param {String} [fromCharset='UTF-8'] Character set of the value
 * @return {String} encoded and folded header line
 */
function headerLineEncode(key, value, fromCharset) {
  var encodedValue = mimeWordsEncode(value, 'Q', fromCharset);
  return foldLines(key + ': ' + encodedValue);
}

/**
 * The result is not mime word decoded, you need to do your own decoding based
 * on the rules for the specific header key
 *
 * @param {String} headerLine Single header line, might include linebreaks as well if folded
 * @return {Object} And object of {key, value}
 */
function headerLineDecode() {
  var _match$, _match$2;
  var headerLine = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var line = headerLine.toString().replace(/(?:\r?\n|\r)[ \t]*/g, ' ').trim();
  var match = line.match(/^\s*([^:]+):(.*)$/);
  return {
    key: ((_match$ = match === null || match === void 0 ? void 0 : match[1]) !== null && _match$ !== void 0 ? _match$ : '').trim(),
    value: ((_match$2 = match === null || match === void 0 ? void 0 : match[2]) !== null && _match$2 !== void 0 ? _match$2 : '').trim()
  };
}

/**
 * Parses a block of header lines. Does not decode mime words as every
 * header might have its own rules (eg. formatted email addresses and such)
 *
 * @param {String} headers Headers string
 * @return {Object} An object of headers, where header keys are object keys. NB! Several values with the same key make up an Array
 */
function headerLinesDecode(headers) {
  var lines = headers.split(/\r?\n|\r/);
  var headersObjArr = {};
  for (var i = lines.length - 1; i >= 0; i--) {
    if (i && lines[i].match(/^\s/)) {
      lines[i - 1] += '\r\n' + lines[i];
      lines.splice(i, 1);
    }
  }
  for (var _i = 0, len = lines.length; _i < len; _i++) {
    var header = headerLineDecode(lines[_i]);
    var key = header.key.toLowerCase();
    var value = header.value;
    if (!headersObjArr[key]) {
      headersObjArr[key] = [value];
    } else {
      headersObjArr[key].push(value);
    }
  }

  // convert single value arrays to single values
  var headersObj = Object.fromEntries(Object.entries(headersObjArr).map(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
      key = _ref2[0],
      value = _ref2[1];
    return value.length === 1 ? [key, value[0]] : [key, value];
  }));
  return headersObj;
}

/**
 * Parses a header value with key=value arguments into a structured
 * object.
 *
 *   parseHeaderValue('content-type: text/plain; CHARSET='UTF-8'') ->
 *   {
 *     'value': 'text/plain',
 *     'params': {
 *       'charset': 'UTF-8'
 *     }
 *   }
 *
 * @param {String} str Header value
 * @return {Object} Header value as a parsed structure
 */
function parseHeaderValue(str) {
  var key = false;
  var value = '';
  var type = 'value';
  var quote = false;
  var escaped = false;
  var chr;
  var responseValue = false;
  var initialParams = {};
  for (var i = 0, len = str.length; i < len; i++) {
    chr = str.charAt(i);
    if (type === 'key') {
      if (chr === '=') {
        key = value.trim().toLowerCase();
        type = 'value';
        value = '';
        continue;
      }
      value += chr;
    } else {
      if (escaped) {
        value += chr;
      } else if (chr === '\\') {
        escaped = true;
        continue;
      } else if (quote && chr === quote) {
        quote = false;
      } else if (!quote && chr === '"') {
        quote = chr;
      } else if (!quote && chr === ';') {
        if (!key) {
          responseValue = value.trim();
        } else {
          initialParams[key] = value.trim();
        }
        type = 'key';
        value = '';
      } else {
        value += chr;
      }
      escaped = false;
    }
  }
  if (type === 'value') {
    if (!key) {
      responseValue = value.trim();
    } else {
      initialParams[key] = value.trim();
    }
  } else if (value.trim()) {
    initialParams[value.trim().toLowerCase()] = '';
  }

  // handle parameter value continuations
  // https://tools.ietf.org/html/rfc2231#section-3

  var processedParams = {};

  // preprocess values
  Object.keys(initialParams).forEach(function (key) {
    var actualKey, nr, match, value;
    if (match = key.match(/(\*(\d+)|\*(\d+)\*|\*)$/)) {
      actualKey = key.substr(0, match.index);
      nr = Number(match[2] || match[3]) || 0;
      if (!processedParams[actualKey]) {
        processedParams[actualKey] = {
          charset: false,
          values: []
        };
      }
      value = initialParams[key];
      if (nr === 0 && match[0].substr(-1) === '*' && (match = value.match(/^([^']*)'[^']*'(.*)$/))) {
        processedParams[actualKey].charset = match[1] || 'iso-8859-1';
        value = match[2];
      }
      processedParams[actualKey].values[nr] = value;

      // remove the old reference
      delete initialParams[key];
    }
  });
  var concatenatedParams = {};

  // concatenate split rfc2231 strings and convert encoded strings to mime encoded words
  Object.keys(processedParams).forEach(function (key) {
    var value;
    if (processedParams[key] && Array.isArray(processedParams[key].values)) {
      value = processedParams[key].values.map(function (val) {
        return val || '';
      }).join('');
      if (processedParams[key].charset) {
        // convert "%AB" to "=?charset?Q?=AB?="
        concatenatedParams[key] = '=?' + processedParams[key].charset + '?Q?' + value.replace(/[=?_\s]/g, function (s) {
          // fix invalidly encoded chars
          var c = s.charCodeAt(0).toString(16);
          return s === ' ' ? '_' : '%' + (c.length < 2 ? '0' : '') + c;
        }).replace(/%/g, '=') + '?='; // change from urlencoding to percent encoding
      } else {
        concatenatedParams[key] = value;
      }
    }
  });
  var responseParams = _objectSpread(_objectSpread({}, initialParams), concatenatedParams);
  return {
    value: responseValue,
    params: responseParams
  };
}

/**
 * Encodes a string or an Uint8Array to an UTF-8 Parameter Value Continuation encoding (rfc2231)
 * Useful for splitting long parameter values.
 *
 * For example
 *      title="unicode string"
 * becomes
 *     title*0*="utf-8''unicode"
 *     title*1*="%20string"
 *
 * @param {String|Uint8Array} data String to be encoded
 * @param {Number} [maxLength=50] Max length for generated chunks
 * @param {String} [fromCharset='UTF-8'] Source sharacter set
 * @return {Array} A list of encoded keys and headers
 */
function continuationEncode(key, data, maxLength, fromCharset) {
  var list = [];
  var encodedStr = typeof data === 'string' ? data : (0, _charset.decode)(data, fromCharset);
  var line;
  maxLength = maxLength || 50;

  // process ascii only text
  if (/^[\w.\- ]*$/.test(data)) {
    // check if conversion is even needed
    if (encodedStr.length <= maxLength) {
      return [{
        key: key,
        value: /[\s";=]/.test(encodedStr) ? '"' + encodedStr + '"' : encodedStr
      }];
    }
    encodedStr = encodedStr.replace(new RegExp('.{' + maxLength.toString() + '}', 'g'), function (str) {
      list.push({
        line: str
      });
      return '';
    });
    if (encodedStr) {
      list.push({
        line: encodedStr
      });
    }
  } else {
    // process text with unicode or special chars
    var uriEncoded = encodeURIComponent("utf-8''" + encodedStr);
    var i = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      var len = maxLength;
      // must not split hex encoded byte between lines
      if (uriEncoded[i + maxLength - 1] === '%') {
        len -= 1;
      } else if (uriEncoded[i + maxLength - 2] === '%') {
        len -= 2;
      }
      line = uriEncoded.substr(i, len);
      if (!line) {
        break;
      }
      list.push({
        line: line,
        encoded: true
      });
      i += line.length;
    }
  }
  return list.map(function (item, i) {
    return {
      // encoded lines: {name}*{part}*
      // unencoded lines: {name}*{part}
      // if any line needs to be encoded then the first line (part==0) is always encoded
      key: key.toString() + '*' + i.toString() + (item.encoded ? '*' : ''),
      value: /[\s";=]/.test(item.line) ? '"' + item.line + '"' : item.line
    };
  });
}

/**
 * Splits a mime encoded string. Needed for dividing mime words into smaller chunks
 *
 * @param {String} str Mime encoded string to be split up
 * @param {Number} maxlen Maximum length of characters for one part (minimum 12)
 * @return {Array} Split string
 */
function _splitMimeEncodedString(str) {
  var maxlen = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 12;
  var minWordLength = 12; // require at least 12 symbols to fit possible 4 octet UTF-8 sequences
  var maxWordLength = Math.max(maxlen, minWordLength);
  var lines = [];
  while (str.length) {
    var curLine = str.substr(0, maxWordLength);
    var match = curLine.match(/=[0-9A-F]?$/i); // skip incomplete escaped char
    if (match) {
      curLine = curLine.substr(0, match.index);
    }
    var done = false;
    while (!done) {
      var chr = void 0;
      done = true;
      var _match = str.substr(curLine.length).match(/^=([0-9A-F]{2})/i); // check if not middle of a unicode char sequence
      if (_match) {
        chr = parseInt(_match[1], 16);
        // invalid sequence, move one char back anc recheck
        if (chr < 0xc2 && chr > 0x7f) {
          curLine = curLine.substr(0, curLine.length - 3);
          done = false;
        }
      }
    }
    if (curLine.length) {
      lines.push(curLine);
    }
    str = str.substr(curLine.length);
  }
  return lines;
}
function _addBase64SoftLinebreaks() {
  var base64EncodedStr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  return base64EncodedStr.trim().replace(new RegExp('.{' + MAX_LINE_LENGTH.toString() + '}', 'g'), '$&\r\n').trim();
}

/**
 * Adds soft line breaks(the ones that will be stripped out when decoding QP)
 *
 * @param {String} qpEncodedStr String in Quoted-Printable encoding
 * @return {String} String with forced line breaks
 */
function _addQPSoftLinebreaks() {
  var qpEncodedStr = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var pos = 0;
  var len = qpEncodedStr.length;
  var lineMargin = Math.floor(MAX_LINE_LENGTH / 3);
  var result = '';
  var match, line;

  // insert soft linebreaks where needed
  while (pos < len) {
    line = qpEncodedStr.substr(pos, MAX_LINE_LENGTH);
    if ((match = line.match(/\r\n/)) && match.index !== undefined) {
      line = line.substr(0, match.index + match[0].length);
      result += line;
      pos += line.length;
      continue;
    }
    if (line.substr(-1) === '\n') {
      // nothing to change here
      result += line;
      pos += line.length;
      continue;
    } else if (match = line.substr(-lineMargin).match(/\n.*?$/)) {
      // truncate to nearest line break
      line = line.substr(0, line.length - (match[0].length - 1));
      result += line;
      pos += line.length;
      continue;
    } else if (line.length > MAX_LINE_LENGTH - lineMargin && (match = line.substr(-lineMargin).match(/[ \t.,!?][^ \t.,!?]*$/))) {
      // truncate to nearest space
      line = line.substr(0, line.length - (match[0].length - 1));
    } else if (line.substr(-1) === '\r') {
      line = line.substr(0, line.length - 1);
    } else {
      if (line.match(/=[\da-f]{0,2}$/i)) {
        // push incomplete encoding sequences to the next line
        if (match = line.match(/=[\da-f]{0,1}$/i)) {
          line = line.substr(0, line.length - match[0].length);
        }

        // ensure that utf-8 sequences are not split
        while (line.length > 3 && line.length < len - pos && !line.match(/^(?:=[\da-f]{2}){1,4}$/i) && (match = line.match(/=[\da-f]{2}$/gi))) {
          var code = parseInt(match[0].substr(1, 2), 16);
          if (code < 128) {
            break;
          }
          line = line.substr(0, line.length - 3);
          if (code >= 0xc0) {
            break;
          }
        }
      }
    }
    if (pos + line.length < len && line.substr(-1) !== '\n') {
      if (line.length === MAX_LINE_LENGTH && line.match(/=[\da-f]{2}$/i)) {
        line = line.substr(0, line.length - 3);
      } else if (line.length === MAX_LINE_LENGTH) {
        line = line.substr(0, line.length - 1);
      }
      pos += line.length;
      line += '=\r\n';
    } else {
      pos += line.length;
    }
    result += line;
  }
  return result;
}