"use strict";

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
function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }
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
  var headersObj = {};
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
    if (!headersObj[key]) {
      headersObj[key] = value;
    } else {
      headersObj[key] = [].concat(headersObj[key], value);
    }
  }
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
  var response = {
    value: false,
    params: {}
  };
  var key = false;
  var value = '';
  var type = 'value';
  var quote = false;
  var escaped = false;
  var chr;
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
          response.value = value.trim();
        } else {
          response.params[key] = value.trim();
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
      response.value = value.trim();
    } else {
      response.params[key] = value.trim();
    }
  } else if (value.trim()) {
    response.params[value.trim().toLowerCase()] = '';
  }

  // handle parameter value continuations
  // https://tools.ietf.org/html/rfc2231#section-3

  // preprocess values
  Object.keys(response.params).forEach(function (key) {
    var actualKey, nr, match, value;
    if (match = key.match(/(\*(\d+)|\*(\d+)\*|\*)$/)) {
      actualKey = key.substr(0, match.index);
      nr = Number(match[2] || match[3]) || 0;
      if (!response.params[actualKey] || _typeof(response.params[actualKey]) !== 'object') {
        response.params[actualKey] = {
          charset: false,
          values: []
        };
      }
      value = response.params[key];
      if (nr === 0 && match[0].substr(-1) === '*' && (match = value.match(/^([^']*)'[^']*'(.*)$/))) {
        response.params[actualKey].charset = match[1] || 'iso-8859-1';
        value = match[2];
      }
      response.params[actualKey].values[nr] = value;

      // remove the old reference
      delete response.params[key];
    }
  });

  // concatenate split rfc2231 strings and convert encoded strings to mime encoded words
  Object.keys(response.params).forEach(function (key) {
    var value;
    if (response.params[key] && Array.isArray(response.params[key].values)) {
      value = response.params[key].values.map(function (val) {
        return val || '';
      }).join('');
      if (response.params[key].charset) {
        // convert "%AB" to "=?charset?Q?=AB?="
        response.params[key] = '=?' + response.params[key].charset + '?Q?' + value.replace(/[=?_\s]/g, function (s) {
          // fix invalidly encoded chars
          var c = s.charCodeAt(0).toString(16);
          return s === ' ' ? '_' : '%' + (c.length < 2 ? '0' : '') + c;
        }).replace(/%/g, '=') + '?='; // change from urlencoding to percent encoding
      } else {
        response.params[key] = value;
      }
    }
  });
  return response;
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
    if (match = line.match(/\r\n/)) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsIk1BWF9CNjRfTUlNRV9XT1JEX0JZVEVfTEVOR1RIIiwibWltZUVuY29kZSIsImRhdGEiLCJmcm9tQ2hhcnNldCIsImJ1ZmZlciIsImNvbnZlcnQiLCJyZWR1Y2UiLCJhZ2dyZWdhdGUiLCJvcmQiLCJpbmRleCIsIl9jaGVja1JhbmdlcyIsImxlbmd0aCIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsInRvU3RyaW5nIiwidG9VcHBlckNhc2UiLCJuciIsInJhbmdlcyIsInZhbCIsInJhbmdlIiwibWltZURlY29kZSIsInN0ciIsImVuY29kZWRCeXRlc0NvdW50IiwibWF0Y2giLCJVaW50OEFycmF5IiwiaSIsImxlbiIsImJ1ZmZlclBvcyIsImhleCIsInN1YnN0ciIsImNociIsImNoYXJBdCIsInRlc3QiLCJwYXJzZUludCIsImNoYXJDb2RlQXQiLCJkZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJidWYiLCJiNjQiLCJlbmNvZGVCYXNlNjQiLCJfYWRkQmFzZTY0U29mdExpbmVicmVha3MiLCJiYXNlNjREZWNvZGUiLCJkZWNvZGVCYXNlNjQiLCJPVVRQVVRfVFlQRURfQVJSQVkiLCJhcnIyc3RyIiwicXVvdGVkUHJpbnRhYmxlRW5jb2RlIiwibWltZUVuY29kZWRTdHIiLCJyZXBsYWNlIiwic3BhY2VzIiwiX2FkZFFQU29mdExpbmVicmVha3MiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJyYXdTdHJpbmciLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3JkRW5jb2RpbmciLCJwYXJ0cyIsImVuY29kZWRTdHIiLCJxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMiLCJfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyIsImoiLCJlbmNvZGUiLCJzdWJzdHJpbmciLCJwdXNoIiwibWFwIiwicHJlZml4Iiwic3VmZml4IiwicCIsImpvaW4iLCJ0cmltIiwicUVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsInJlZ2V4IiwibWltZVdvcmREZWNvZGUiLCJzcGxpdCIsInNoaWZ0IiwiZW5jb2RpbmciLCJtaW1lV29yZHNEZWNvZGUiLCJwcmV2RW5jb2RpbmciLCJlbmRPZlByZXZXb3JkIiwicmVzdWx0IiwibWltZVdvcmQiLCJmb2xkTGluZXMiLCJhZnRlclNwYWNlIiwicG9zIiwibGluZSIsImhlYWRlckxpbmVFbmNvZGUiLCJrZXkiLCJ2YWx1ZSIsImVuY29kZWRWYWx1ZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lIiwiaGVhZGVyTGluZXNEZWNvZGUiLCJoZWFkZXJzIiwibGluZXMiLCJoZWFkZXJzT2JqIiwic3BsaWNlIiwiaGVhZGVyIiwidG9Mb3dlckNhc2UiLCJjb25jYXQiLCJwYXJzZUhlYWRlclZhbHVlIiwicmVzcG9uc2UiLCJwYXJhbXMiLCJ0eXBlIiwicXVvdGUiLCJlc2NhcGVkIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJhY3R1YWxLZXkiLCJOdW1iZXIiLCJjaGFyc2V0IiwidmFsdWVzIiwiQXJyYXkiLCJpc0FycmF5IiwicyIsImMiLCJjb250aW51YXRpb25FbmNvZGUiLCJtYXhMZW5ndGgiLCJsaXN0IiwiUmVnRXhwIiwidXJpRW5jb2RlZCIsImVuY29kZVVSSUNvbXBvbmVudCIsImVuY29kZWQiLCJpdGVtIiwibWF4bGVuIiwibWluV29yZExlbmd0aCIsIm1heFdvcmRMZW5ndGgiLCJNYXRoIiwibWF4IiwiY3VyTGluZSIsImRvbmUiLCJiYXNlNjRFbmNvZGVkU3RyIiwicXBFbmNvZGVkU3RyIiwibGluZU1hcmdpbiIsImZsb29yIiwiY29kZSJdLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L3NwYWNlLWJlZm9yZS1mdW5jdGlvbi1wYXJlbiwgQHR5cGVzY3JpcHQtZXNsaW50L3N0cmljdC1ib29sZWFuLWV4cHJlc3Npb25zLCBAdHlwZXNjcmlwdC1lc2xpbnQvbWVtYmVyLWRlbGltaXRlci1zdHlsZSAqL1xuaW1wb3J0IHsgZW5jb2RlIGFzIGVuY29kZUJhc2U2NCwgZGVjb2RlIGFzIGRlY29kZUJhc2U2NCwgT1VUUFVUX1RZUEVEX0FSUkFZIH0gZnJvbSAnZW1haWxqcy1iYXNlNjQnXG5pbXBvcnQgeyBlbmNvZGUsIGRlY29kZSwgY29udmVydCwgYXJyMnN0ciB9IGZyb20gJy4vY2hhcnNldCdcblxuLy8gTGluZXMgY2FuJ3QgYmUgbG9uZ2VyIHRoYW4gNzYgKyA8Q1I+PExGPiA9IDc4IGJ5dGVzXG4vLyBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ1I3NlY3Rpb24tNi43XG5jb25zdCBNQVhfTElORV9MRU5HVEggPSA3NlxuY29uc3QgTUFYX01JTUVfV09SRF9MRU5HVEggPSA1MlxuY29uc3QgTUFYX0I2NF9NSU1FX1dPUkRfQllURV9MRU5HVEggPSAzOVxuXG4vKipcbiAqIEVuY29kZXMgYWxsIG5vbiBwcmludGFibGUgYW5kIG5vbiBhc2NpaSBieXRlcyB0byA9WFggZm9ybSwgd2hlcmUgWFggaXMgdGhlXG4gKiBieXRlIHZhbHVlIGluIGhleC4gVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBjb252ZXJ0IGxpbmVicmVha3MgZXRjLiBpdFxuICogb25seSBlc2NhcGVzIGNoYXJhY3RlciBzZXF1ZW5jZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIEVpdGhlciBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5XG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lRW5jb2RlKGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXkgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKTogc3RyaW5nIHtcbiAgY29uc3QgYnVmZmVyID0gY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcbiAgcmV0dXJuIGJ1ZmZlci5yZWR1Y2UoXG4gICAgKGFnZ3JlZ2F0ZSwgb3JkLCBpbmRleCkgPT5cbiAgICAgIF9jaGVja1JhbmdlcyhvcmQpICYmXG4gICAgICAhKFxuICAgICAgICAob3JkID09PSAweDIwIHx8IG9yZCA9PT0gMHgwOSkgJiZcbiAgICAgICAgKGluZGV4ID09PSBidWZmZXIubGVuZ3RoIC0gMSB8fCBidWZmZXJbaW5kZXggKyAxXSA9PT0gMHgwYSB8fCBidWZmZXJbaW5kZXggKyAxXSA9PT0gMHgwZClcbiAgICAgIClcbiAgICAgICAgPyBhZ2dyZWdhdGUgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKG9yZCkgLy8gaWYgdGhlIGNoYXIgaXMgaW4gYWxsb3dlZCByYW5nZSwgdGhlbiBrZWVwIGFzIGlzLCB1bmxlc3MgaXQgaXMgYSB3cyBpbiB0aGUgZW5kIG9mIGEgbGluZVxuICAgICAgICA6IGFnZ3JlZ2F0ZSArICc9JyArIChvcmQgPCAweDEwID8gJzAnIDogJycpICsgb3JkLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpLFxuICAgICcnXG4gIClcblxuICBmdW5jdGlvbiBfY2hlY2tSYW5nZXMobnI6IG51bWJlcik6IGJvb2xlYW4ge1xuICAgIGNvbnN0IHJhbmdlcyA9IFtcbiAgICAgIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ1I3NlY3Rpb24tNi43XG4gICAgICBbMHgwOV0sIC8vIDxUQUI+XG4gICAgICBbMHgwYV0sIC8vIDxMRj5cbiAgICAgIFsweDBkXSwgLy8gPENSPlxuICAgICAgWzB4MjAsIDB4M2NdLCAvLyA8U1A+IVwiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6O1xuICAgICAgWzB4M2UsIDB4N2VdIC8vID4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9XG4gICAgXVxuICAgIHJldHVybiByYW5nZXMucmVkdWNlKFxuICAgICAgKHZhbCwgcmFuZ2UpID0+XG4gICAgICAgIHZhbCB8fCAocmFuZ2UubGVuZ3RoID09PSAxICYmIG5yID09PSByYW5nZVswXSkgfHwgKHJhbmdlLmxlbmd0aCA9PT0gMiAmJiBuciA+PSByYW5nZVswXSAmJiBuciA8PSByYW5nZVsxXSksXG4gICAgICBmYWxzZVxuICAgIClcbiAgfVxufVxuXG4vKipcbiAqIERlY29kZXMgbWltZSBlbmNvZGVkIHN0cmluZyB0byBhbiB1bmljb2RlIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZ1xuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2UgZW5jb2RpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZURlY29kZShzdHIgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKTogc3RyaW5nIHtcbiAgY29uc3QgZW5jb2RlZEJ5dGVzQ291bnQgPSAoc3RyLm1hdGNoKC89W1xcZGEtZkEtRl17Mn0vZykgPz8gW10pLmxlbmd0aFxuICBjb25zdCBidWZmZXIgPSBuZXcgVWludDhBcnJheShzdHIubGVuZ3RoIC0gZW5jb2RlZEJ5dGVzQ291bnQgKiAyKVxuXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzdHIubGVuZ3RoLCBidWZmZXJQb3MgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBoZXggPSBzdHIuc3Vic3RyKGkgKyAxLCAyKVxuICAgIGNvbnN0IGNociA9IHN0ci5jaGFyQXQoaSlcbiAgICBpZiAoY2hyID09PSAnPScgJiYgaGV4ICYmIC9bXFxkYS1mQS1GXXsyfS8udGVzdChoZXgpKSB7XG4gICAgICBidWZmZXJbYnVmZmVyUG9zKytdID0gcGFyc2VJbnQoaGV4LCAxNilcbiAgICAgIGkgKz0gMlxuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXJbYnVmZmVyUG9zKytdID0gY2hyLmNoYXJDb2RlQXQoMClcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVjb2RlKGJ1ZmZlciwgZnJvbUNoYXJzZXQpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiB0eXBlZCBhcnJheSBvZiBnaXZlbiBjaGFyc2V0IGludG8gdW5pY29kZVxuICogYmFzZTY0IHN0cmluZy4gQWxzbyBhZGRzIGxpbmUgYnJlYWtzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgb3IgdHlwZWQgYXJyYXkgdG8gYmUgYmFzZTY0IGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBJbml0aWFsIGNoYXJzZXQsIGUuZy4gJ2JpbmFyeScuIERlZmF1bHRzIHRvICdVVEYtOCdcbiAqIEByZXR1cm4ge1N0cmluZ30gQmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjRFbmNvZGUoZGF0YTogc3RyaW5nIHwgVWludDhBcnJheSwgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKTogc3RyaW5nIHtcbiAgY29uc3QgYnVmID0gdHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnICYmIGZyb21DaGFyc2V0ID09PSAnYmluYXJ5JyA/IGRhdGEgOiBjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KVxuICBjb25zdCBiNjQgPSBlbmNvZGVCYXNlNjQoYnVmKVxuICByZXR1cm4gX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzKGI2NClcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgYmFzZTY0IHN0cmluZyBvZiBhbnkgY2hhcnNldCBpbnRvIGFuIHVuaWNvZGUgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBCYXNlNjQgZW5jb2RlZCBzdHJpbmdcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgYmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NERlY29kZShzdHI6IHN0cmluZywgZnJvbUNoYXJzZXQ/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBidWYgPSBkZWNvZGVCYXNlNjQoc3RyLCBPVVRQVVRfVFlQRURfQVJSQVkpXG4gIHJldHVybiBmcm9tQ2hhcnNldCA9PT0gJ2JpbmFyeScgPyBhcnIyc3RyKGJ1ZikgOiBkZWNvZGUoYnVmLCBmcm9tQ2hhcnNldClcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgaW50byBhIHF1b3RlZCBwcmludGFibGUgZW5jb2RpbmdcbiAqIFRoaXMgaXMgYWxtb3N0IHRoZSBzYW1lIGFzIG1pbWVFbmNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWRcbiAqIGFzIHdlbGwgdG8gZW5zdXJlIHRoYXQgdGhlIGxpbmVzIGFyZSBuZXZlciBsb25nZXIgdGhhbiBhbGxvd2VkIGxlbmd0aFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gbWltZSBlbmNvZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlZFByaW50YWJsZUVuY29kZShkYXRhOiBzdHJpbmcgfCBVaW50OEFycmF5ID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jyk6IHN0cmluZyB7XG4gIGNvbnN0IG1pbWVFbmNvZGVkU3RyID0gbWltZUVuY29kZShkYXRhLCBmcm9tQ2hhcnNldClcbiAgICAucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJ1xcclxcbicpIC8vIGZpeCBsaW5lIGJyZWFrcywgZW5zdXJlIDxDUj48TEY+XG4gICAgLnJlcGxhY2UoL1tcXHQgXSskL2dtLCAoc3BhY2VzKSA9PiBzcGFjZXMucmVwbGFjZSgvIC9nLCAnPTIwJykucmVwbGFjZSgvXFx0L2csICc9MDknKSkgLy8gcmVwbGFjZSBzcGFjZXMgaW4gdGhlIGVuZCBvZiBsaW5lc1xuXG4gIHJldHVybiBfYWRkUVBTb2Z0TGluZWJyZWFrcyhtaW1lRW5jb2RlZFN0cikgLy8gYWRkIHNvZnQgbGluZSBicmVha3MgdG8gZW5zdXJlIGxpbmUgbGVuZ3RocyBzam9ydGVyIHRoYW4gNzYgYnl0ZXNcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgc3RyaW5nIGZyb20gYSBxdW90ZWQgcHJpbnRhYmxlIGVuY29kaW5nLiBUaGlzIGlzIGFsbW9zdCB0aGVcbiAqIHNhbWUgYXMgbWltZURlY29kZSwgZXhjZXB0IGxpbmUgYnJlYWtzIHdpbGwgYmUgY2hhbmdlZCBhcyB3ZWxsXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nIHRvIGRlY29kZVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBkZWNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVkUHJpbnRhYmxlRGVjb2RlKHN0ciA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpOiBzdHJpbmcge1xuICBjb25zdCByYXdTdHJpbmcgPSBzdHJcbiAgICAucmVwbGFjZSgvW1xcdCBdKyQvZ20sICcnKSAvLyByZW1vdmUgaW52YWxpZCB3aGl0ZXNwYWNlIGZyb20gdGhlIGVuZCBvZiBsaW5lc1xuICAgIC5yZXBsYWNlKC89KD86XFxyP1xcbnwkKS9nLCAnJykgLy8gcmVtb3ZlIHNvZnQgbGluZSBicmVha3NcblxuICByZXR1cm4gbWltZURlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBNSU1FIFdvcmRcbiAqICAgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gbWltZVdvcmRFbmNvZGluZz0nUScgRW5jb2RpbmcgZm9yIHRoZSBtaW1lIHdvcmQsIGVpdGhlciBRIG9yIEJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIHNoYXJhY3RlciBzZXRcbiAqIEByZXR1cm4ge1N0cmluZ30gU2luZ2xlIG9yIHNldmVyYWwgbWltZSB3b3JkcyBqb2luZWQgdG9nZXRoZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3JkRW5jb2RlKGRhdGE6IHN0cmluZyB8IFVpbnQ4QXJyYXksIG1pbWVXb3JkRW5jb2RpbmcgPSAnUScsIGZyb21DaGFyc2V0ID0gJ1VURi04Jyk6IHN0cmluZyB7XG4gIGxldCBwYXJ0cyA9IFtdXG4gIGNvbnN0IHN0ciA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG5cbiAgaWYgKG1pbWVXb3JkRW5jb2RpbmcgPT09ICdRJykge1xuICAgIGNvbnN0IHN0ciA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gICAgY29uc3QgZW5jb2RlZFN0ciA9IHFFbmNvZGVGb3JiaWRkZW5IZWFkZXJDaGFycyhtaW1lRW5jb2RlKHN0cikpXG4gICAgcGFydHMgPVxuICAgICAgZW5jb2RlZFN0ci5sZW5ndGggPCBNQVhfTUlNRV9XT1JEX0xFTkdUSFxuICAgICAgICA/IFtlbmNvZGVkU3RyXVxuICAgICAgICA6IF9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nKGVuY29kZWRTdHIsIE1BWF9NSU1FX1dPUkRfTEVOR1RIKVxuICB9IGVsc2Uge1xuICAgIC8vIEZpdHMgYXMgbXVjaCBhcyBwb3NzaWJsZSBpbnRvIGV2ZXJ5IGxpbmUgd2l0aG91dCBicmVha2luZyB1dGYtOCBtdWx0aWJ5dGUgY2hhcmFjdGVycycgb2N0ZXRzIHVwIGFjcm9zcyBsaW5lc1xuICAgIGxldCBqID0gMFxuICAgIGxldCBpID0gMFxuICAgIHdoaWxlIChpIDwgc3RyLmxlbmd0aCkge1xuICAgICAgaWYgKGVuY29kZShzdHIuc3Vic3RyaW5nKGosIGkpKS5sZW5ndGggPiBNQVhfQjY0X01JTUVfV09SRF9CWVRFX0xFTkdUSCkge1xuICAgICAgICAvLyB3ZSB3ZW50IG9uZSBjaGFyYWN0ZXIgdG9vIGZhciwgc3Vic3RyaW5nIGF0IHRoZSBjaGFyIGJlZm9yZVxuICAgICAgICBwYXJ0cy5wdXNoKHN0ci5zdWJzdHJpbmcoaiwgaSAtIDEpKVxuICAgICAgICBqID0gaSAtIDFcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGkrK1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBhZGQgdGhlIHJlbWFpbmRlciBvZiB0aGUgc3RyaW5nXG4gICAgc3RyLnN1YnN0cmluZyhqKSAmJiBwYXJ0cy5wdXNoKHN0ci5zdWJzdHJpbmcoaikpXG4gICAgcGFydHMgPSBwYXJ0cy5tYXAoZW5jb2RlKS5tYXAoZW5jb2RlQmFzZTY0KVxuICB9XG5cbiAgY29uc3QgcHJlZml4ID0gJz0/VVRGLTg/JyArIG1pbWVXb3JkRW5jb2RpbmcgKyAnPydcbiAgY29uc3Qgc3VmZml4ID0gJz89ICdcbiAgcmV0dXJuIHBhcnRzXG4gICAgLm1hcCgocCkgPT4gcHJlZml4ICsgcCArIHN1ZmZpeClcbiAgICAuam9pbignJylcbiAgICAudHJpbSgpXG59XG5cbi8qKlxuICogUS1FbmNvZGVzIHJlbWFpbmluZyBmb3JiaWRkZW4gaGVhZGVyIGNoYXJzXG4gKiAgIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ3I3NlY3Rpb24tNVxuICovXG5jb25zdCBxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMgPSBmdW5jdGlvbiAoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCBxRW5jb2RlID0gKGNocjogc3RyaW5nKTogc3RyaW5nID0+XG4gICAgY2hyID09PSAnICcgPyAnXycgOiAnPScgKyAoY2hyLmNoYXJDb2RlQXQoMCkgPCAweDEwID8gJzAnIDogJycpICsgY2hyLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9bXmEtejAtOSEqK1xcLS89XS9naSwgcUVuY29kZSlcbn1cblxuLyoqXG4gKiBGaW5kcyB3b3JkIHNlcXVlbmNlcyB3aXRoIG5vbiBhc2NpaSB0ZXh0IGFuZCBjb252ZXJ0cyB0aGVzZSB0byBtaW1lIHdvcmRzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IG1pbWVXb3JkRW5jb2Rpbmc9J1EnIEVuY29kaW5nIGZvciB0aGUgbWltZSB3b3JkLCBlaXRoZXIgUSBvciBCXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBzaGFyYWN0ZXIgc2V0XG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIHBvc3NpYmxlIG1pbWUgd29yZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3Jkc0VuY29kZShkYXRhOiBzdHJpbmcgfCBVaW50OEFycmF5ID0gJycsIG1pbWVXb3JkRW5jb2RpbmcgPSAnUScsIGZyb21DaGFyc2V0ID0gJ1VURi04Jyk6IHN0cmluZyB7XG4gIGNvbnN0IHJlZ2V4ID1cbiAgICAvKFteXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qKD86XFxzK1teXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qXFxzKik/KSsoPz1cXHN8JCkvZ1xuICByZXR1cm4gZGVjb2RlKGNvbnZlcnQoZGF0YSwgZnJvbUNoYXJzZXQpKS5yZXBsYWNlKHJlZ2V4LCAobWF0Y2gpID0+XG4gICAgbWF0Y2gubGVuZ3RoID8gbWltZVdvcmRFbmNvZGUobWF0Y2gsIG1pbWVXb3JkRW5jb2RpbmcsIGZyb21DaGFyc2V0KSA6ICcnXG4gIClcbn1cblxuLyoqXG4gKiBEZWNvZGUgYSBjb21wbGV0ZSBtaW1lIHdvcmQgZW5jb2RlZCBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZERlY29kZShzdHIgPSAnJyk6IHN0cmluZyB7XG4gIGNvbnN0IG1hdGNoID0gc3RyLm1hdGNoKC9ePVxcPyhbXFx3X1xcLSpdKylcXD8oW1FxQmJdKVxcPyhbXj9dKilcXD89JC9pKVxuICBpZiAoIW1hdGNoKSByZXR1cm4gc3RyXG5cbiAgLy8gUkZDMjIzMSBhZGRlZCBsYW5ndWFnZSB0YWcgdG8gdGhlIGVuY29kaW5nXG4gIC8vIHNlZTogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIyMzEjc2VjdGlvbi01XG4gIC8vIHRoaXMgaW1wbGVtZW50YXRpb24gc2lsZW50bHkgaWdub3JlcyB0aGlzIHRhZ1xuICBjb25zdCBmcm9tQ2hhcnNldCA9IG1hdGNoWzFdLnNwbGl0KCcqJykuc2hpZnQoKVxuICBjb25zdCBlbmNvZGluZyA9IChtYXRjaFsyXSB8fCAnUScpLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKVxuICBjb25zdCByYXdTdHJpbmcgPSAobWF0Y2hbM10gfHwgJycpLnJlcGxhY2UoL18vZywgJyAnKVxuXG4gIGlmIChlbmNvZGluZyA9PT0gJ0InKSB7XG4gICAgcmV0dXJuIGJhc2U2NERlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxuICB9IGVsc2UgaWYgKGVuY29kaW5nID09PSAnUScpIHtcbiAgICByZXR1cm4gbWltZURlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHJcbiAgfVxufVxuXG4vKipcbiAqIERlY29kZSBhIHN0cmluZyB0aGF0IG1pZ2h0IGluY2x1ZGUgb25lIG9yIHNldmVyYWwgbWltZSB3b3Jkc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIGluY2x1ZGluZyBzb21lIG1pbWUgd29yZHMgdGhhdCB3aWxsIGJlIGVuY29kZWRcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRzRGVjb2RlKHN0ciA9ICcnKTogc3RyaW5nIHtcbiAgc3RyID0gc3RyLnRvU3RyaW5nKCkucmVwbGFjZSgvKD1cXD9bXj9dK1xcP1tRcUJiXVxcP1teP10rXFw/PSlcXHMrKD89PVxcP1teP10rXFw/W1FxQmJdXFw/W14/XSpcXD89KS9nLCAnJDEnKVxuICAvLyBqb2luIGJ5dGVzIG9mIG11bHRpLWJ5dGUgVVRGLThcbiAgbGV0IHByZXZFbmNvZGluZzogc3RyaW5nXG4gIHN0ciA9IHN0ci5yZXBsYWNlKC8oXFw/PSk/PVxcP1t1VV1bdFRdW2ZGXS04XFw/KFtRcUJiXSlcXD8vZywgKG1hdGNoLCBlbmRPZlByZXZXb3JkLCBlbmNvZGluZykgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGVuZE9mUHJldldvcmQgJiYgZW5jb2RpbmcgPT09IHByZXZFbmNvZGluZyA/ICcnIDogbWF0Y2hcbiAgICBwcmV2RW5jb2RpbmcgPSBlbmNvZGluZ1xuICAgIHJldHVybiByZXN1bHRcbiAgfSlcbiAgc3RyID0gc3RyLnJlcGxhY2UoLz1cXD9bXFx3X1xcLSpdK1xcP1tRcUJiXVxcP1teP10qXFw/PS9nLCAobWltZVdvcmQpID0+IG1pbWVXb3JkRGVjb2RlKG1pbWVXb3JkLnJlcGxhY2UoL1xccysvZywgJycpKSlcblxuICByZXR1cm4gc3RyXG59XG5cbi8qKlxuICogRm9sZHMgbG9uZyBsaW5lcywgdXNlZnVsIGZvciBmb2xkaW5nIGhlYWRlciBsaW5lcyAoYWZ0ZXJTcGFjZT1mYWxzZSkgYW5kXG4gKiBmbG93ZWQgdGV4dCAoYWZ0ZXJTcGFjZT10cnVlKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIGJlIGZvbGRlZFxuICogQHBhcmFtIHtCb29sZWFufSBhZnRlclNwYWNlIElmIHRydWUsIGxlYXZlIGEgc3BhY2UgaW4gdGggZW5kIG9mIGEgbGluZVxuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBmb2xkZWQgbGluZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvbGRMaW5lcyhzdHIgPSAnJywgYWZ0ZXJTcGFjZT86IGJvb2xlYW4pOiBzdHJpbmcge1xuICBsZXQgcG9zID0gMFxuICBjb25zdCBsZW4gPSBzdHIubGVuZ3RoXG4gIGxldCByZXN1bHQgPSAnJ1xuICBsZXQgbGluZSwgbWF0Y2hcblxuICB3aGlsZSAocG9zIDwgbGVuKSB7XG4gICAgbGluZSA9IHN0ci5zdWJzdHIocG9zLCBNQVhfTElORV9MRU5HVEgpXG4gICAgaWYgKGxpbmUubGVuZ3RoIDwgTUFYX0xJTkVfTEVOR1RIKSB7XG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goL15bXlxcblxccl0qKFxccj9cXG58XFxyKS8pKSkge1xuICAgICAgbGluZSA9IG1hdGNoWzBdXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAoXG4gICAgICAobWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxzKylbXlxcc10qJC8pKSAmJlxuICAgICAgbWF0Y2hbMF0ubGVuZ3RoIC0gKGFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApIDwgbGluZS5sZW5ndGhcbiAgICApIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpKVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gc3RyLnN1YnN0cihwb3MgKyBsaW5lLmxlbmd0aCkubWF0Y2goL15bXlxcc10rKFxccyopLykpKSB7XG4gICAgICBsaW5lID0gbGluZSArIG1hdGNoWzBdLnN1YnN0cigwLCBtYXRjaFswXS5sZW5ndGggLSAoIWFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApKVxuICAgIH1cblxuICAgIHJlc3VsdCArPSBsaW5lXG4gICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgaWYgKHBvcyA8IGxlbikge1xuICAgICAgcmVzdWx0ICs9ICdcXHJcXG4nXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4vKipcbiAqIEVuY29kZXMgYW5kIGZvbGRzIGEgaGVhZGVyIGxpbmUgZm9yIGEgTUlNRSBtZXNzYWdlIGhlYWRlci5cbiAqIFNob3J0aGFuZCBmb3IgbWltZVdvcmRzRW5jb2RlICsgZm9sZExpbmVzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBLZXkgbmFtZSwgd2lsbCBub3QgYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gdmFsdWUgVmFsdWUgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBDaGFyYWN0ZXIgc2V0IG9mIHRoZSB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBlbmNvZGVkIGFuZCBmb2xkZWQgaGVhZGVyIGxpbmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVFbmNvZGUoa2V5OiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcgfCBVaW50OEFycmF5LCBmcm9tQ2hhcnNldDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgZW5jb2RlZFZhbHVlID0gbWltZVdvcmRzRW5jb2RlKHZhbHVlLCAnUScsIGZyb21DaGFyc2V0KVxuICByZXR1cm4gZm9sZExpbmVzKGtleSArICc6ICcgKyBlbmNvZGVkVmFsdWUpXG59XG5cbi8qKlxuICogVGhlIHJlc3VsdCBpcyBub3QgbWltZSB3b3JkIGRlY29kZWQsIHlvdSBuZWVkIHRvIGRvIHlvdXIgb3duIGRlY29kaW5nIGJhc2VkXG4gKiBvbiB0aGUgcnVsZXMgZm9yIHRoZSBzcGVjaWZpYyBoZWFkZXIga2V5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlckxpbmUgU2luZ2xlIGhlYWRlciBsaW5lLCBtaWdodCBpbmNsdWRlIGxpbmVicmVha3MgYXMgd2VsbCBpZiBmb2xkZWRcbiAqIEByZXR1cm4ge09iamVjdH0gQW5kIG9iamVjdCBvZiB7a2V5LCB2YWx1ZX1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVEZWNvZGUoaGVhZGVyTGluZSA9ICcnKTogeyBrZXk6IHN0cmluZzsgdmFsdWU6IHN0cmluZyB9IHtcbiAgY29uc3QgbGluZSA9IGhlYWRlckxpbmVcbiAgICAudG9TdHJpbmcoKVxuICAgIC5yZXBsYWNlKC8oPzpcXHI/XFxufFxccilbIFxcdF0qL2csICcgJylcbiAgICAudHJpbSgpXG4gIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyooW146XSspOiguKikkLylcblxuICByZXR1cm4ge1xuICAgIGtleTogKG1hdGNoPy5bMV0gPz8gJycpLnRyaW0oKSxcbiAgICB2YWx1ZTogKG1hdGNoPy5bMl0gPz8gJycpLnRyaW0oKVxuICB9XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgb2YgaGVhZGVyIGxpbmVzLiBEb2VzIG5vdCBkZWNvZGUgbWltZSB3b3JkcyBhcyBldmVyeVxuICogaGVhZGVyIG1pZ2h0IGhhdmUgaXRzIG93biBydWxlcyAoZWcuIGZvcm1hdHRlZCBlbWFpbCBhZGRyZXNzZXMgYW5kIHN1Y2gpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlcnMgSGVhZGVycyBzdHJpbmdcbiAqIEByZXR1cm4ge09iamVjdH0gQW4gb2JqZWN0IG9mIGhlYWRlcnMsIHdoZXJlIGhlYWRlciBrZXlzIGFyZSBvYmplY3Qga2V5cy4gTkIhIFNldmVyYWwgdmFsdWVzIHdpdGggdGhlIHNhbWUga2V5IG1ha2UgdXAgYW4gQXJyYXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVzRGVjb2RlKGhlYWRlcnM6IHN0cmluZyk6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IHN0cmluZ1tdPiB7XG4gIGNvbnN0IGxpbmVzID0gaGVhZGVycy5zcGxpdCgvXFxyP1xcbnxcXHIvKVxuICBjb25zdCBoZWFkZXJzT2JqOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBzdHJpbmdbXT4gPSB7fVxuXG4gIGZvciAobGV0IGkgPSBsaW5lcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChpICYmIGxpbmVzW2ldLm1hdGNoKC9eXFxzLykpIHtcbiAgICAgIGxpbmVzW2kgLSAxXSArPSAnXFxyXFxuJyArIGxpbmVzW2ldXG4gICAgICBsaW5lcy5zcGxpY2UoaSwgMSlcbiAgICB9XG4gIH1cblxuICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBoZWFkZXIgPSBoZWFkZXJMaW5lRGVjb2RlKGxpbmVzW2ldKVxuICAgIGNvbnN0IGtleSA9IGhlYWRlci5rZXkudG9Mb3dlckNhc2UoKVxuICAgIGNvbnN0IHZhbHVlID0gaGVhZGVyLnZhbHVlXG5cbiAgICBpZiAoIWhlYWRlcnNPYmpba2V5XSkge1xuICAgICAgaGVhZGVyc09ialtrZXldID0gdmFsdWVcbiAgICB9IGVsc2Uge1xuICAgICAgaGVhZGVyc09ialtrZXldID0gW10uY29uY2F0KGhlYWRlcnNPYmpba2V5XSwgdmFsdWUpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGhlYWRlcnNPYmpcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBoZWFkZXIgdmFsdWUgd2l0aCBrZXk9dmFsdWUgYXJndW1lbnRzIGludG8gYSBzdHJ1Y3R1cmVkXG4gKiBvYmplY3QuXG4gKlxuICogICBwYXJzZUhlYWRlclZhbHVlKCdjb250ZW50LXR5cGU6IHRleHQvcGxhaW47IENIQVJTRVQ9J1VURi04JycpIC0+XG4gKiAgIHtcbiAqICAgICAndmFsdWUnOiAndGV4dC9wbGFpbicsXG4gKiAgICAgJ3BhcmFtcyc6IHtcbiAqICAgICAgICdjaGFyc2V0JzogJ1VURi04J1xuICogICAgIH1cbiAqICAgfVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgSGVhZGVyIHZhbHVlXG4gKiBAcmV0dXJuIHtPYmplY3R9IEhlYWRlciB2YWx1ZSBhcyBhIHBhcnNlZCBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSGVhZGVyVmFsdWUoc3RyOiBzdHJpbmcpOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiB7XG4gIGNvbnN0IHJlc3BvbnNlOiB7XG4gICAgdmFsdWU6IHN0cmluZyB8IGJvb2xlYW5cbiAgICBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIFVpbnQ4QXJyYXk+XG4gIH0gPSB7XG4gICAgdmFsdWU6IGZhbHNlLFxuICAgIHBhcmFtczoge31cbiAgfVxuICBsZXQga2V5ID0gZmFsc2VcbiAgbGV0IHZhbHVlID0gJydcbiAgbGV0IHR5cGUgPSAndmFsdWUnXG4gIGxldCBxdW90ZSA9IGZhbHNlXG4gIGxldCBlc2NhcGVkID0gZmFsc2VcbiAgbGV0IGNoclxuXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzdHIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjaHIgPSBzdHIuY2hhckF0KGkpXG4gICAgaWYgKHR5cGUgPT09ICdrZXknKSB7XG4gICAgICBpZiAoY2hyID09PSAnPScpIHtcbiAgICAgICAga2V5ID0gdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgdHlwZSA9ICd2YWx1ZSdcbiAgICAgICAgdmFsdWUgPSAnJ1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgdmFsdWUgKz0gY2hyXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChlc2NhcGVkKSB7XG4gICAgICAgIHZhbHVlICs9IGNoclxuICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICdcXFxcJykge1xuICAgICAgICBlc2NhcGVkID0gdHJ1ZVxuICAgICAgICBjb250aW51ZVxuICAgICAgfSBlbHNlIGlmIChxdW90ZSAmJiBjaHIgPT09IHF1b3RlKSB7XG4gICAgICAgIHF1b3RlID0gZmFsc2VcbiAgICAgIH0gZWxzZSBpZiAoIXF1b3RlICYmIGNociA9PT0gJ1wiJykge1xuICAgICAgICBxdW90ZSA9IGNoclxuICAgICAgfSBlbHNlIGlmICghcXVvdGUgJiYgY2hyID09PSAnOycpIHtcbiAgICAgICAgaWYgKCFrZXkpIHtcbiAgICAgICAgICByZXNwb25zZS52YWx1ZSA9IHZhbHVlLnRyaW0oKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gdmFsdWUudHJpbSgpXG4gICAgICAgIH1cbiAgICAgICAgdHlwZSA9ICdrZXknXG4gICAgICAgIHZhbHVlID0gJydcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlICs9IGNoclxuICAgICAgfVxuICAgICAgZXNjYXBlZCA9IGZhbHNlXG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGUgPT09ICd2YWx1ZScpIHtcbiAgICBpZiAoIWtleSkge1xuICAgICAgcmVzcG9uc2UudmFsdWUgPSB2YWx1ZS50cmltKClcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZS50cmltKClcbiAgICB9XG4gIH0gZWxzZSBpZiAodmFsdWUudHJpbSgpKSB7XG4gICAgcmVzcG9uc2UucGFyYW1zW3ZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpXSA9ICcnXG4gIH1cblxuICAvLyBoYW5kbGUgcGFyYW1ldGVyIHZhbHVlIGNvbnRpbnVhdGlvbnNcbiAgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIyMzEjc2VjdGlvbi0zXG5cbiAgLy8gcHJlcHJvY2VzcyB2YWx1ZXNcbiAgT2JqZWN0LmtleXMocmVzcG9uc2UucGFyYW1zKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBsZXQgYWN0dWFsS2V5LCBuciwgbWF0Y2gsIHZhbHVlXG4gICAgaWYgKChtYXRjaCA9IGtleS5tYXRjaCgvKFxcKihcXGQrKXxcXCooXFxkKylcXCp8XFwqKSQvKSkpIHtcbiAgICAgIGFjdHVhbEtleSA9IGtleS5zdWJzdHIoMCwgbWF0Y2guaW5kZXgpXG4gICAgICBuciA9IE51bWJlcihtYXRjaFsyXSB8fCBtYXRjaFszXSkgfHwgMFxuXG4gICAgICBpZiAoIXJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldIHx8IHR5cGVvZiByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gPSB7XG4gICAgICAgICAgY2hhcnNldDogZmFsc2UsXG4gICAgICAgICAgdmFsdWVzOiBbXVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhbHVlID0gcmVzcG9uc2UucGFyYW1zW2tleV1cblxuICAgICAgaWYgKG5yID09PSAwICYmIG1hdGNoWzBdLnN1YnN0cigtMSkgPT09ICcqJyAmJiAobWF0Y2ggPSB2YWx1ZS5tYXRjaCgvXihbXiddKiknW14nXSonKC4qKSQvKSkpIHtcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0uY2hhcnNldCA9IG1hdGNoWzFdIHx8ICdpc28tODg1OS0xJ1xuICAgICAgICB2YWx1ZSA9IG1hdGNoWzJdXG4gICAgICB9XG5cbiAgICAgIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldLnZhbHVlc1tucl0gPSB2YWx1ZVxuXG4gICAgICAvLyByZW1vdmUgdGhlIG9sZCByZWZlcmVuY2VcbiAgICAgIGRlbGV0ZSByZXNwb25zZS5wYXJhbXNba2V5XVxuICAgIH1cbiAgfSlcblxuICAvLyBjb25jYXRlbmF0ZSBzcGxpdCByZmMyMjMxIHN0cmluZ3MgYW5kIGNvbnZlcnQgZW5jb2RlZCBzdHJpbmdzIHRvIG1pbWUgZW5jb2RlZCB3b3Jkc1xuICBPYmplY3Qua2V5cyhyZXNwb25zZS5wYXJhbXMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIGxldCB2YWx1ZVxuICAgIGlmIChyZXNwb25zZS5wYXJhbXNba2V5XSAmJiBBcnJheS5pc0FycmF5KHJlc3BvbnNlLnBhcmFtc1trZXldLnZhbHVlcykpIHtcbiAgICAgIHZhbHVlID0gcmVzcG9uc2UucGFyYW1zW2tleV0udmFsdWVzXG4gICAgICAgIC5tYXAoZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICAgIHJldHVybiB2YWwgfHwgJydcbiAgICAgICAgfSlcbiAgICAgICAgLmpvaW4oJycpXG5cbiAgICAgIGlmIChyZXNwb25zZS5wYXJhbXNba2V5XS5jaGFyc2V0KSB7XG4gICAgICAgIC8vIGNvbnZlcnQgXCIlQUJcIiB0byBcIj0/Y2hhcnNldD9RPz1BQj89XCJcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPVxuICAgICAgICAgICc9PycgK1xuICAgICAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldLmNoYXJzZXQgK1xuICAgICAgICAgICc/UT8nICtcbiAgICAgICAgICB2YWx1ZVxuICAgICAgICAgICAgLnJlcGxhY2UoL1s9P19cXHNdL2csIGZ1bmN0aW9uIChzOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICAgICAgICAvLyBmaXggaW52YWxpZGx5IGVuY29kZWQgY2hhcnNcbiAgICAgICAgICAgICAgY29uc3QgYyA9IHMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNilcbiAgICAgICAgICAgICAgcmV0dXJuIHMgPT09ICcgJyA/ICdfJyA6ICclJyArIChjLmxlbmd0aCA8IDIgPyAnMCcgOiAnJykgKyBjXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoLyUvZywgJz0nKSArXG4gICAgICAgICAgJz89JyAvLyBjaGFuZ2UgZnJvbSB1cmxlbmNvZGluZyB0byBwZXJjZW50IGVuY29kaW5nXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBQYXJhbWV0ZXIgVmFsdWUgQ29udGludWF0aW9uIGVuY29kaW5nIChyZmMyMjMxKVxuICogVXNlZnVsIGZvciBzcGxpdHRpbmcgbG9uZyBwYXJhbWV0ZXIgdmFsdWVzLlxuICpcbiAqIEZvciBleGFtcGxlXG4gKiAgICAgIHRpdGxlPVwidW5pY29kZSBzdHJpbmdcIlxuICogYmVjb21lc1xuICogICAgIHRpdGxlKjAqPVwidXRmLTgnJ3VuaWNvZGVcIlxuICogICAgIHRpdGxlKjEqPVwiJTIwc3RyaW5nXCJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge051bWJlcn0gW21heExlbmd0aD01MF0gTWF4IGxlbmd0aCBmb3IgZ2VuZXJhdGVkIGNodW5rc1xuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7QXJyYXl9IEEgbGlzdCBvZiBlbmNvZGVkIGtleXMgYW5kIGhlYWRlcnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnRpbnVhdGlvbkVuY29kZShcbiAga2V5OiBzdHJpbmcgfCBVaW50OEFycmF5LFxuICBkYXRhOiBzdHJpbmcsXG4gIG1heExlbmd0aDogbnVtYmVyLFxuICBmcm9tQ2hhcnNldDogc3RyaW5nXG4pOiBBcnJheTxSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4ge1xuICBjb25zdCBsaXN0ID0gW11cbiAgbGV0IGVuY29kZWRTdHIgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICBsZXQgbGluZVxuXG4gIG1heExlbmd0aCA9IG1heExlbmd0aCB8fCA1MFxuXG4gIC8vIHByb2Nlc3MgYXNjaWkgb25seSB0ZXh0XG4gIGlmICgvXltcXHcuXFwtIF0qJC8udGVzdChkYXRhKSkge1xuICAgIC8vIGNoZWNrIGlmIGNvbnZlcnNpb24gaXMgZXZlbiBuZWVkZWRcbiAgICBpZiAoZW5jb2RlZFN0ci5sZW5ndGggPD0gbWF4TGVuZ3RoKSB7XG4gICAgICByZXR1cm4gW1xuICAgICAgICB7XG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGVuY29kZWRTdHIpID8gJ1wiJyArIGVuY29kZWRTdHIgKyAnXCInIDogZW5jb2RlZFN0clxuICAgICAgICB9XG4gICAgICBdXG4gICAgfVxuXG4gICAgZW5jb2RlZFN0ciA9IGVuY29kZWRTdHIucmVwbGFjZShuZXcgUmVnRXhwKCcueycgKyBtYXhMZW5ndGgudG9TdHJpbmcoKSArICd9JywgJ2cnKSwgZnVuY3Rpb24gKHN0cikge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogc3RyXG4gICAgICB9KVxuICAgICAgcmV0dXJuICcnXG4gICAgfSlcblxuICAgIGlmIChlbmNvZGVkU3RyKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBlbmNvZGVkU3RyXG4gICAgICB9KVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBwcm9jZXNzIHRleHQgd2l0aCB1bmljb2RlIG9yIHNwZWNpYWwgY2hhcnNcbiAgICBjb25zdCB1cmlFbmNvZGVkID0gZW5jb2RlVVJJQ29tcG9uZW50KFwidXRmLTgnJ1wiICsgZW5jb2RlZFN0cilcbiAgICBsZXQgaSA9IDBcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1jb25zdGFudC1jb25kaXRpb25cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgbGV0IGxlbiA9IG1heExlbmd0aFxuICAgICAgLy8gbXVzdCBub3Qgc3BsaXQgaGV4IGVuY29kZWQgYnl0ZSBiZXR3ZWVuIGxpbmVzXG4gICAgICBpZiAodXJpRW5jb2RlZFtpICsgbWF4TGVuZ3RoIC0gMV0gPT09ICclJykge1xuICAgICAgICBsZW4gLT0gMVxuICAgICAgfSBlbHNlIGlmICh1cmlFbmNvZGVkW2kgKyBtYXhMZW5ndGggLSAyXSA9PT0gJyUnKSB7XG4gICAgICAgIGxlbiAtPSAyXG4gICAgICB9XG4gICAgICBsaW5lID0gdXJpRW5jb2RlZC5zdWJzdHIoaSwgbGVuKVxuICAgICAgaWYgKCFsaW5lKSB7XG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lLFxuICAgICAgICBlbmNvZGVkOiB0cnVlXG4gICAgICB9KVxuICAgICAgaSArPSBsaW5lLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaXN0Lm1hcChmdW5jdGlvbiAoaXRlbSwgaSkge1xuICAgIHJldHVybiB7XG4gICAgICAvLyBlbmNvZGVkIGxpbmVzOiB7bmFtZX0qe3BhcnR9KlxuICAgICAgLy8gdW5lbmNvZGVkIGxpbmVzOiB7bmFtZX0qe3BhcnR9XG4gICAgICAvLyBpZiBhbnkgbGluZSBuZWVkcyB0byBiZSBlbmNvZGVkIHRoZW4gdGhlIGZpcnN0IGxpbmUgKHBhcnQ9PTApIGlzIGFsd2F5cyBlbmNvZGVkXG4gICAgICBrZXk6IGtleS50b1N0cmluZygpICsgJyonICsgaS50b1N0cmluZygpICsgKGl0ZW0uZW5jb2RlZCA/ICcqJyA6ICcnKSxcbiAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGl0ZW0ubGluZSkgPyAnXCInICsgaXRlbS5saW5lICsgJ1wiJyA6IGl0ZW0ubGluZVxuICAgIH1cbiAgfSlcbn1cblxuLyoqXG4gKiBTcGxpdHMgYSBtaW1lIGVuY29kZWQgc3RyaW5nLiBOZWVkZWQgZm9yIGRpdmlkaW5nIG1pbWUgd29yZHMgaW50byBzbWFsbGVyIGNodW5rc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZyB0byBiZSBzcGxpdCB1cFxuICogQHBhcmFtIHtOdW1iZXJ9IG1heGxlbiBNYXhpbXVtIGxlbmd0aCBvZiBjaGFyYWN0ZXJzIGZvciBvbmUgcGFydCAobWluaW11bSAxMilcbiAqIEByZXR1cm4ge0FycmF5fSBTcGxpdCBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gX3NwbGl0TWltZUVuY29kZWRTdHJpbmcoc3RyOiBzdHJpbmcsIG1heGxlbiA9IDEyKTogc3RyaW5nW10ge1xuICBjb25zdCBtaW5Xb3JkTGVuZ3RoID0gMTIgLy8gcmVxdWlyZSBhdCBsZWFzdCAxMiBzeW1ib2xzIHRvIGZpdCBwb3NzaWJsZSA0IG9jdGV0IFVURi04IHNlcXVlbmNlc1xuICBjb25zdCBtYXhXb3JkTGVuZ3RoID0gTWF0aC5tYXgobWF4bGVuLCBtaW5Xb3JkTGVuZ3RoKVxuICBjb25zdCBsaW5lcyA9IFtdXG5cbiAgd2hpbGUgKHN0ci5sZW5ndGgpIHtcbiAgICBsZXQgY3VyTGluZSA9IHN0ci5zdWJzdHIoMCwgbWF4V29yZExlbmd0aClcblxuICAgIGNvbnN0IG1hdGNoID0gY3VyTGluZS5tYXRjaCgvPVswLTlBLUZdPyQvaSkgLy8gc2tpcCBpbmNvbXBsZXRlIGVzY2FwZWQgY2hhclxuICAgIGlmIChtYXRjaCkge1xuICAgICAgY3VyTGluZSA9IGN1ckxpbmUuc3Vic3RyKDAsIG1hdGNoLmluZGV4KVxuICAgIH1cblxuICAgIGxldCBkb25lID0gZmFsc2VcbiAgICB3aGlsZSAoIWRvbmUpIHtcbiAgICAgIGxldCBjaHJcbiAgICAgIGRvbmUgPSB0cnVlXG4gICAgICBjb25zdCBtYXRjaCA9IHN0ci5zdWJzdHIoY3VyTGluZS5sZW5ndGgpLm1hdGNoKC9ePShbMC05QS1GXXsyfSkvaSkgLy8gY2hlY2sgaWYgbm90IG1pZGRsZSBvZiBhIHVuaWNvZGUgY2hhciBzZXF1ZW5jZVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNociA9IHBhcnNlSW50KG1hdGNoWzFdLCAxNilcbiAgICAgICAgLy8gaW52YWxpZCBzZXF1ZW5jZSwgbW92ZSBvbmUgY2hhciBiYWNrIGFuYyByZWNoZWNrXG4gICAgICAgIGlmIChjaHIgPCAweGMyICYmIGNociA+IDB4N2YpIHtcbiAgICAgICAgICBjdXJMaW5lID0gY3VyTGluZS5zdWJzdHIoMCwgY3VyTGluZS5sZW5ndGggLSAzKVxuICAgICAgICAgIGRvbmUgPSBmYWxzZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGN1ckxpbmUubGVuZ3RoKSB7XG4gICAgICBsaW5lcy5wdXNoKGN1ckxpbmUpXG4gICAgfVxuICAgIHN0ciA9IHN0ci5zdWJzdHIoY3VyTGluZS5sZW5ndGgpXG4gIH1cblxuICByZXR1cm4gbGluZXNcbn1cblxuZnVuY3Rpb24gX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzKGJhc2U2NEVuY29kZWRTdHIgPSAnJyk6IHN0cmluZyB7XG4gIHJldHVybiBiYXNlNjRFbmNvZGVkU3RyXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIE1BWF9MSU5FX0xFTkdUSC50b1N0cmluZygpICsgJ30nLCAnZycpLCAnJCZcXHJcXG4nKVxuICAgIC50cmltKClcbn1cblxuLyoqXG4gKiBBZGRzIHNvZnQgbGluZSBicmVha3ModGhlIG9uZXMgdGhhdCB3aWxsIGJlIHN0cmlwcGVkIG91dCB3aGVuIGRlY29kaW5nIFFQKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBxcEVuY29kZWRTdHIgU3RyaW5nIGluIFF1b3RlZC1QcmludGFibGUgZW5jb2RpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggZm9yY2VkIGxpbmUgYnJlYWtzXG4gKi9cbmZ1bmN0aW9uIF9hZGRRUFNvZnRMaW5lYnJlYWtzKHFwRW5jb2RlZFN0ciA9ICcnKTogc3RyaW5nIHtcbiAgbGV0IHBvcyA9IDBcbiAgY29uc3QgbGVuID0gcXBFbmNvZGVkU3RyLmxlbmd0aFxuICBjb25zdCBsaW5lTWFyZ2luID0gTWF0aC5mbG9vcihNQVhfTElORV9MRU5HVEggLyAzKVxuICBsZXQgcmVzdWx0ID0gJydcbiAgbGV0IG1hdGNoLCBsaW5lXG5cbiAgLy8gaW5zZXJ0IHNvZnQgbGluZWJyZWFrcyB3aGVyZSBuZWVkZWRcbiAgd2hpbGUgKHBvcyA8IGxlbikge1xuICAgIGxpbmUgPSBxcEVuY29kZWRTdHIuc3Vic3RyKHBvcywgTUFYX0xJTkVfTEVOR1RIKVxuICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC9cXHJcXG4vKSkpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGxpbmUuc3Vic3RyKC0xKSA9PT0gJ1xcbicpIHtcbiAgICAgIC8vIG5vdGhpbmcgdG8gY2hhbmdlIGhlcmVcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1xcbi4qPyQvKSkpIHtcbiAgICAgIC8vIHRydW5jYXRlIHRvIG5lYXJlc3QgbGluZSBicmVha1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIDEpKVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9IGVsc2UgaWYgKFxuICAgICAgbGluZS5sZW5ndGggPiBNQVhfTElORV9MRU5HVEggLSBsaW5lTWFyZ2luICYmXG4gICAgICAobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1sgXFx0LiwhP11bXiBcXHQuLCE/XSokLykpXG4gICAgKSB7XG4gICAgICAvLyB0cnVuY2F0ZSB0byBuZWFyZXN0IHNwYWNlXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gMSkpXG4gICAgfSBlbHNlIGlmIChsaW5lLnN1YnN0cigtMSkgPT09ICdcXHInKSB7XG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMn0kL2kpKSB7XG4gICAgICAgIC8vIHB1c2ggaW5jb21wbGV0ZSBlbmNvZGluZyBzZXF1ZW5jZXMgdG8gdGhlIG5leHQgbGluZVxuICAgICAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMX0kL2kpKSkge1xuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVuc3VyZSB0aGF0IHV0Zi04IHNlcXVlbmNlcyBhcmUgbm90IHNwbGl0XG4gICAgICAgIHdoaWxlIChcbiAgICAgICAgICBsaW5lLmxlbmd0aCA+IDMgJiZcbiAgICAgICAgICBsaW5lLmxlbmd0aCA8IGxlbiAtIHBvcyAmJlxuICAgICAgICAgICFsaW5lLm1hdGNoKC9eKD86PVtcXGRhLWZdezJ9KXsxLDR9JC9pKSAmJlxuICAgICAgICAgIChtYXRjaCA9IGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvZ2kpKVxuICAgICAgICApIHtcbiAgICAgICAgICBjb25zdCBjb2RlID0gcGFyc2VJbnQobWF0Y2hbMF0uc3Vic3RyKDEsIDIpLCAxNilcbiAgICAgICAgICBpZiAoY29kZSA8IDEyOCkge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAzKVxuXG4gICAgICAgICAgaWYgKGNvZGUgPj0gMHhjMCkge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zICsgbGluZS5sZW5ndGggPCBsZW4gJiYgbGluZS5zdWJzdHIoLTEpICE9PSAnXFxuJykge1xuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSBNQVhfTElORV9MRU5HVEggJiYgbGluZS5tYXRjaCgvPVtcXGRhLWZdezJ9JC9pKSkge1xuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAzKVxuICAgICAgfSBlbHNlIGlmIChsaW5lLmxlbmd0aCA9PT0gTUFYX0xJTkVfTEVOR1RIKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDEpXG4gICAgICB9XG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGxpbmUgKz0gJz1cXHJcXG4nXG4gICAgfSBlbHNlIHtcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgIH1cblxuICAgIHJlc3VsdCArPSBsaW5lXG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbmV4cG9ydCB7IGRlY29kZSwgZW5jb2RlLCBjb252ZXJ0IH1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0E7QUFDQTtBQUE0RDtBQUU1RDtBQUNBO0FBQ0EsSUFBTUEsZUFBZSxHQUFHLEVBQUU7QUFDMUIsSUFBTUMsb0JBQW9CLEdBQUcsRUFBRTtBQUMvQixJQUFNQyw2QkFBNkIsR0FBRyxFQUFFOztBQUV4QztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxTQUFTQyxVQUFVLEdBQWdFO0VBQUEsSUFBL0RDLElBQXlCLHVFQUFHLEVBQUU7RUFBQSxJQUFFQyxXQUFXLHVFQUFHLE9BQU87RUFDOUUsSUFBTUMsTUFBTSxHQUFHLElBQUFDLGdCQUFPLEVBQUNILElBQUksRUFBRUMsV0FBVyxDQUFDO0VBQ3pDLE9BQU9DLE1BQU0sQ0FBQ0UsTUFBTSxDQUNsQixVQUFDQyxTQUFTLEVBQUVDLEdBQUcsRUFBRUMsS0FBSztJQUFBLE9BQ3BCQyxZQUFZLENBQUNGLEdBQUcsQ0FBQyxJQUNqQixFQUNFLENBQUNBLEdBQUcsS0FBSyxJQUFJLElBQUlBLEdBQUcsS0FBSyxJQUFJLE1BQzVCQyxLQUFLLEtBQUtMLE1BQU0sQ0FBQ08sTUFBTSxHQUFHLENBQUMsSUFBSVAsTUFBTSxDQUFDSyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEtBQUssSUFBSSxJQUFJTCxNQUFNLENBQUNLLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsQ0FDMUYsR0FDR0YsU0FBUyxHQUFHSyxNQUFNLENBQUNDLFlBQVksQ0FBQ0wsR0FBRyxDQUFDLENBQUM7SUFBQSxFQUNyQ0QsU0FBUyxHQUFHLEdBQUcsSUFBSUMsR0FBRyxHQUFHLElBQUksR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDLEdBQUdBLEdBQUcsQ0FBQ00sUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDQyxXQUFXLEVBQUU7RUFBQSxHQUNoRixFQUFFLENBQ0g7RUFFRCxTQUFTTCxZQUFZLENBQUNNLEVBQVUsRUFBVztJQUN6QyxJQUFNQyxNQUFNLEdBQUc7SUFDYjtJQUNBLENBQUMsSUFBSSxDQUFDO0lBQUU7SUFDUixDQUFDLElBQUksQ0FBQztJQUFFO0lBQ1IsQ0FBQyxJQUFJLENBQUM7SUFBRTtJQUNSLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQztJQUFFO0lBQ2QsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFBQSxDQUNkOztJQUNELE9BQU9BLE1BQU0sQ0FBQ1gsTUFBTSxDQUNsQixVQUFDWSxHQUFHLEVBQUVDLEtBQUs7TUFBQSxPQUNURCxHQUFHLElBQUtDLEtBQUssQ0FBQ1IsTUFBTSxLQUFLLENBQUMsSUFBSUssRUFBRSxLQUFLRyxLQUFLLENBQUMsQ0FBQyxDQUFFLElBQUtBLEtBQUssQ0FBQ1IsTUFBTSxLQUFLLENBQUMsSUFBSUssRUFBRSxJQUFJRyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUlILEVBQUUsSUFBSUcsS0FBSyxDQUFDLENBQUMsQ0FBRTtJQUFBLEdBQzVHLEtBQUssQ0FDTjtFQUNIO0FBQ0Y7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxTQUFTQyxVQUFVLEdBQTBDO0VBQUE7RUFBQSxJQUF6Q0MsR0FBRyx1RUFBRyxFQUFFO0VBQUEsSUFBRWxCLFdBQVcsdUVBQUcsT0FBTztFQUN4RCxJQUFNbUIsaUJBQWlCLEdBQUcsZUFBQ0QsR0FBRyxDQUFDRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsbURBQUksRUFBRSxFQUFFWixNQUFNO0VBQ3JFLElBQU1QLE1BQU0sR0FBRyxJQUFJb0IsVUFBVSxDQUFDSCxHQUFHLENBQUNWLE1BQU0sR0FBR1csaUJBQWlCLEdBQUcsQ0FBQyxDQUFDO0VBRWpFLEtBQUssSUFBSUcsQ0FBQyxHQUFHLENBQUMsRUFBRUMsR0FBRyxHQUFHTCxHQUFHLENBQUNWLE1BQU0sRUFBRWdCLFNBQVMsR0FBRyxDQUFDLEVBQUVGLENBQUMsR0FBR0MsR0FBRyxFQUFFRCxDQUFDLEVBQUUsRUFBRTtJQUM3RCxJQUFNRyxHQUFHLEdBQUdQLEdBQUcsQ0FBQ1EsTUFBTSxDQUFDSixDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUNoQyxJQUFNSyxHQUFHLEdBQUdULEdBQUcsQ0FBQ1UsTUFBTSxDQUFDTixDQUFDLENBQUM7SUFDekIsSUFBSUssR0FBRyxLQUFLLEdBQUcsSUFBSUYsR0FBRyxJQUFJLGVBQWUsQ0FBQ0ksSUFBSSxDQUFDSixHQUFHLENBQUMsRUFBRTtNQUNuRHhCLE1BQU0sQ0FBQ3VCLFNBQVMsRUFBRSxDQUFDLEdBQUdNLFFBQVEsQ0FBQ0wsR0FBRyxFQUFFLEVBQUUsQ0FBQztNQUN2Q0gsQ0FBQyxJQUFJLENBQUM7SUFDUixDQUFDLE1BQU07TUFDTHJCLE1BQU0sQ0FBQ3VCLFNBQVMsRUFBRSxDQUFDLEdBQUdHLEdBQUcsQ0FBQ0ksVUFBVSxDQUFDLENBQUMsQ0FBQztJQUN6QztFQUNGO0VBRUEsT0FBTyxJQUFBQyxlQUFNLEVBQUMvQixNQUFNLEVBQUVELFdBQVcsQ0FBQztBQUNwQzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sU0FBU2lDLFlBQVksQ0FBQ2xDLElBQXlCLEVBQWlDO0VBQUEsSUFBL0JDLFdBQVcsdUVBQUcsT0FBTztFQUMzRSxJQUFNa0MsR0FBRyxHQUFHLE9BQU9uQyxJQUFJLEtBQUssUUFBUSxJQUFJQyxXQUFXLEtBQUssUUFBUSxHQUFHRCxJQUFJLEdBQUcsSUFBQUcsZ0JBQU8sRUFBQ0gsSUFBSSxFQUFFQyxXQUFXLENBQUM7RUFDcEcsSUFBTW1DLEdBQUcsR0FBRyxJQUFBQyxtQkFBWSxFQUFDRixHQUFHLENBQUM7RUFDN0IsT0FBT0csd0JBQXdCLENBQUNGLEdBQUcsQ0FBQztBQUN0Qzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNHLFlBQVksQ0FBQ3BCLEdBQVcsRUFBRWxCLFdBQW9CLEVBQVU7RUFDdEUsSUFBTWtDLEdBQUcsR0FBRyxJQUFBSyxtQkFBWSxFQUFDckIsR0FBRyxFQUFFc0IsK0JBQWtCLENBQUM7RUFDakQsT0FBT3hDLFdBQVcsS0FBSyxRQUFRLEdBQUcsSUFBQXlDLGdCQUFPLEVBQUNQLEdBQUcsQ0FBQyxHQUFHLElBQUFGLGVBQU0sRUFBQ0UsR0FBRyxFQUFFbEMsV0FBVyxDQUFDO0FBQzNFOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVMwQyxxQkFBcUIsR0FBZ0U7RUFBQSxJQUEvRDNDLElBQXlCLHVFQUFHLEVBQUU7RUFBQSxJQUFFQyxXQUFXLHVFQUFHLE9BQU87RUFDekYsSUFBTTJDLGNBQWMsR0FBRzdDLFVBQVUsQ0FBQ0MsSUFBSSxFQUFFQyxXQUFXLENBQUMsQ0FDakQ0QyxPQUFPLENBQUMsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0VBQUEsQ0FDN0JBLE9BQU8sQ0FBQyxXQUFXLEVBQUUsVUFBQ0MsTUFBTTtJQUFBLE9BQUtBLE1BQU0sQ0FBQ0QsT0FBTyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQ0EsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7RUFBQSxFQUFDLEVBQUM7O0VBRXZGLE9BQU9FLG9CQUFvQixDQUFDSCxjQUFjLENBQUMsRUFBQztBQUM5Qzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sU0FBU0kscUJBQXFCLEdBQTBDO0VBQUEsSUFBekM3QixHQUFHLHVFQUFHLEVBQUU7RUFBQSxJQUFFbEIsV0FBVyx1RUFBRyxPQUFPO0VBQ25FLElBQU1nRCxTQUFTLEdBQUc5QixHQUFHLENBQ2xCMEIsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztFQUFBLENBQ3pCQSxPQUFPLENBQUMsZUFBZSxFQUFFLEVBQUUsQ0FBQyxFQUFDOztFQUVoQyxPQUFPM0IsVUFBVSxDQUFDK0IsU0FBUyxFQUFFaEQsV0FBVyxDQUFDO0FBQzNDOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNpRCxjQUFjLENBQUNsRCxJQUF5QixFQUF5RDtFQUFBLElBQXZEbUQsZ0JBQWdCLHVFQUFHLEdBQUc7RUFBQSxJQUFFbEQsV0FBVyx1RUFBRyxPQUFPO0VBQ3JHLElBQUltRCxLQUFLLEdBQUcsRUFBRTtFQUNkLElBQU1qQyxHQUFHLEdBQUcsT0FBT25CLElBQUksS0FBSyxRQUFRLEdBQUdBLElBQUksR0FBRyxJQUFBaUMsZUFBTSxFQUFDakMsSUFBSSxFQUFFQyxXQUFXLENBQUM7RUFFdkUsSUFBSWtELGdCQUFnQixLQUFLLEdBQUcsRUFBRTtJQUM1QixJQUFNaEMsSUFBRyxHQUFHLE9BQU9uQixJQUFJLEtBQUssUUFBUSxHQUFHQSxJQUFJLEdBQUcsSUFBQWlDLGVBQU0sRUFBQ2pDLElBQUksRUFBRUMsV0FBVyxDQUFDO0lBQ3ZFLElBQU1vRCxVQUFVLEdBQUdDLDJCQUEyQixDQUFDdkQsVUFBVSxDQUFDb0IsSUFBRyxDQUFDLENBQUM7SUFDL0RpQyxLQUFLLEdBQ0hDLFVBQVUsQ0FBQzVDLE1BQU0sR0FBR1osb0JBQW9CLEdBQ3BDLENBQUN3RCxVQUFVLENBQUMsR0FDWkUsdUJBQXVCLENBQUNGLFVBQVUsRUFBRXhELG9CQUFvQixDQUFDO0VBQ2pFLENBQUMsTUFBTTtJQUNMO0lBQ0EsSUFBSTJELENBQUMsR0FBRyxDQUFDO0lBQ1QsSUFBSWpDLENBQUMsR0FBRyxDQUFDO0lBQ1QsT0FBT0EsQ0FBQyxHQUFHSixHQUFHLENBQUNWLE1BQU0sRUFBRTtNQUNyQixJQUFJLElBQUFnRCxlQUFNLEVBQUN0QyxHQUFHLENBQUN1QyxTQUFTLENBQUNGLENBQUMsRUFBRWpDLENBQUMsQ0FBQyxDQUFDLENBQUNkLE1BQU0sR0FBR1gsNkJBQTZCLEVBQUU7UUFDdEU7UUFDQXNELEtBQUssQ0FBQ08sSUFBSSxDQUFDeEMsR0FBRyxDQUFDdUMsU0FBUyxDQUFDRixDQUFDLEVBQUVqQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDbkNpQyxDQUFDLEdBQUdqQyxDQUFDLEdBQUcsQ0FBQztNQUNYLENBQUMsTUFBTTtRQUNMQSxDQUFDLEVBQUU7TUFDTDtJQUNGO0lBQ0E7SUFDQUosR0FBRyxDQUFDdUMsU0FBUyxDQUFDRixDQUFDLENBQUMsSUFBSUosS0FBSyxDQUFDTyxJQUFJLENBQUN4QyxHQUFHLENBQUN1QyxTQUFTLENBQUNGLENBQUMsQ0FBQyxDQUFDO0lBQ2hESixLQUFLLEdBQUdBLEtBQUssQ0FBQ1EsR0FBRyxDQUFDSCxlQUFNLENBQUMsQ0FBQ0csR0FBRyxDQUFDdkIsbUJBQVksQ0FBQztFQUM3QztFQUVBLElBQU13QixNQUFNLEdBQUcsVUFBVSxHQUFHVixnQkFBZ0IsR0FBRyxHQUFHO0VBQ2xELElBQU1XLE1BQU0sR0FBRyxLQUFLO0VBQ3BCLE9BQU9WLEtBQUssQ0FDVFEsR0FBRyxDQUFDLFVBQUNHLENBQUM7SUFBQSxPQUFLRixNQUFNLEdBQUdFLENBQUMsR0FBR0QsTUFBTTtFQUFBLEVBQUMsQ0FDL0JFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FDUkMsSUFBSSxFQUFFO0FBQ1g7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFNWCwyQkFBMkIsR0FBRyxTQUE5QkEsMkJBQTJCLENBQWFuQyxHQUFXLEVBQVU7RUFDakUsSUFBTStDLE9BQU8sR0FBRyxTQUFWQSxPQUFPLENBQUl0QyxHQUFXO0lBQUEsT0FDMUJBLEdBQUcsS0FBSyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsSUFBSUEsR0FBRyxDQUFDSSxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUMsR0FBR0osR0FBRyxDQUFDSSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUNwQixRQUFRLENBQUMsRUFBRSxDQUFDLENBQUNDLFdBQVcsRUFBRTtFQUFBO0VBQ2hILE9BQU9NLEdBQUcsQ0FBQzBCLE9BQU8sQ0FBQyxvQkFBb0IsRUFBRXFCLE9BQU8sQ0FBQztBQUNuRCxDQUFDOztBQUVEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDTyxTQUFTQyxlQUFlLEdBQXdGO0VBQUEsSUFBdkZuRSxJQUF5Qix1RUFBRyxFQUFFO0VBQUEsSUFBRW1ELGdCQUFnQix1RUFBRyxHQUFHO0VBQUEsSUFBRWxELFdBQVcsdUVBQUcsT0FBTztFQUMzRyxJQUFNbUUsS0FBSyxHQUNULHFJQUFxSTtFQUN2SSxPQUFPLElBQUFuQyxlQUFNLEVBQUMsSUFBQTlCLGdCQUFPLEVBQUNILElBQUksRUFBRUMsV0FBVyxDQUFDLENBQUMsQ0FBQzRDLE9BQU8sQ0FBQ3VCLEtBQUssRUFBRSxVQUFDL0MsS0FBSztJQUFBLE9BQzdEQSxLQUFLLENBQUNaLE1BQU0sR0FBR3lDLGNBQWMsQ0FBQzdCLEtBQUssRUFBRThCLGdCQUFnQixFQUFFbEQsV0FBVyxDQUFDLEdBQUcsRUFBRTtFQUFBLEVBQ3pFO0FBQ0g7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sU0FBU29FLGNBQWMsR0FBbUI7RUFBQSxJQUFsQmxELEdBQUcsdUVBQUcsRUFBRTtFQUNyQyxJQUFNRSxLQUFLLEdBQUdGLEdBQUcsQ0FBQ0UsS0FBSyxDQUFDLHlDQUF5QyxDQUFDO0VBQ2xFLElBQUksQ0FBQ0EsS0FBSyxFQUFFLE9BQU9GLEdBQUc7O0VBRXRCO0VBQ0E7RUFDQTtFQUNBLElBQU1sQixXQUFXLEdBQUdvQixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUNpRCxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUNDLEtBQUssRUFBRTtFQUMvQyxJQUFNQyxRQUFRLEdBQUcsQ0FBQ25ELEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxHQUFHLEVBQUVULFFBQVEsRUFBRSxDQUFDQyxXQUFXLEVBQUU7RUFDM0QsSUFBTW9DLFNBQVMsR0FBRyxDQUFDNUIsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRXdCLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0VBRXJELElBQUkyQixRQUFRLEtBQUssR0FBRyxFQUFFO0lBQ3BCLE9BQU9qQyxZQUFZLENBQUNVLFNBQVMsRUFBRWhELFdBQVcsQ0FBQztFQUM3QyxDQUFDLE1BQU0sSUFBSXVFLFFBQVEsS0FBSyxHQUFHLEVBQUU7SUFDM0IsT0FBT3RELFVBQVUsQ0FBQytCLFNBQVMsRUFBRWhELFdBQVcsQ0FBQztFQUMzQyxDQUFDLE1BQU07SUFDTCxPQUFPa0IsR0FBRztFQUNaO0FBQ0Y7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sU0FBU3NELGVBQWUsR0FBbUI7RUFBQSxJQUFsQnRELEdBQUcsdUVBQUcsRUFBRTtFQUN0Q0EsR0FBRyxHQUFHQSxHQUFHLENBQUNQLFFBQVEsRUFBRSxDQUFDaUMsT0FBTyxDQUFDLGdFQUFnRSxFQUFFLElBQUksQ0FBQztFQUNwRztFQUNBLElBQUk2QixZQUFvQjtFQUN4QnZELEdBQUcsR0FBR0EsR0FBRyxDQUFDMEIsT0FBTyxDQUFDLHNDQUFzQyxFQUFFLFVBQUN4QixLQUFLLEVBQUVzRCxhQUFhLEVBQUVILFFBQVEsRUFBSztJQUM1RixJQUFNSSxNQUFNLEdBQUdELGFBQWEsSUFBSUgsUUFBUSxLQUFLRSxZQUFZLEdBQUcsRUFBRSxHQUFHckQsS0FBSztJQUN0RXFELFlBQVksR0FBR0YsUUFBUTtJQUN2QixPQUFPSSxNQUFNO0VBQ2YsQ0FBQyxDQUFDO0VBQ0Z6RCxHQUFHLEdBQUdBLEdBQUcsQ0FBQzBCLE9BQU8sQ0FBQyxpQ0FBaUMsRUFBRSxVQUFDZ0MsUUFBUTtJQUFBLE9BQUtSLGNBQWMsQ0FBQ1EsUUFBUSxDQUFDaEMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQztFQUFBLEVBQUM7RUFFaEgsT0FBTzFCLEdBQUc7QUFDWjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sU0FBUzJELFNBQVMsR0FBeUM7RUFBQSxJQUF4QzNELEdBQUcsdUVBQUcsRUFBRTtFQUFBLElBQUU0RCxVQUFvQjtFQUN0RCxJQUFJQyxHQUFHLEdBQUcsQ0FBQztFQUNYLElBQU14RCxHQUFHLEdBQUdMLEdBQUcsQ0FBQ1YsTUFBTTtFQUN0QixJQUFJbUUsTUFBTSxHQUFHLEVBQUU7RUFDZixJQUFJSyxJQUFJLEVBQUU1RCxLQUFLO0VBRWYsT0FBTzJELEdBQUcsR0FBR3hELEdBQUcsRUFBRTtJQUNoQnlELElBQUksR0FBRzlELEdBQUcsQ0FBQ1EsTUFBTSxDQUFDcUQsR0FBRyxFQUFFcEYsZUFBZSxDQUFDO0lBQ3ZDLElBQUlxRixJQUFJLENBQUN4RSxNQUFNLEdBQUdiLGVBQWUsRUFBRTtNQUNqQ2dGLE1BQU0sSUFBSUssSUFBSTtNQUNkO0lBQ0Y7SUFDQSxJQUFLNUQsS0FBSyxHQUFHNEQsSUFBSSxDQUFDNUQsS0FBSyxDQUFDLHFCQUFxQixDQUFDLEVBQUc7TUFDL0M0RCxJQUFJLEdBQUc1RCxLQUFLLENBQUMsQ0FBQyxDQUFDO01BQ2Z1RCxNQUFNLElBQUlLLElBQUk7TUFDZEQsR0FBRyxJQUFJQyxJQUFJLENBQUN4RSxNQUFNO01BQ2xCO0lBQ0YsQ0FBQyxNQUFNLElBQ0wsQ0FBQ1ksS0FBSyxHQUFHNEQsSUFBSSxDQUFDNUQsS0FBSyxDQUFDLGNBQWMsQ0FBQyxLQUNuQ0EsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDWixNQUFNLElBQUlzRSxVQUFVLEdBQUcsQ0FBQzFELEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUVaLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBR3dFLElBQUksQ0FBQ3hFLE1BQU0sRUFDMUU7TUFDQXdFLElBQUksR0FBR0EsSUFBSSxDQUFDdEQsTUFBTSxDQUFDLENBQUMsRUFBRXNELElBQUksQ0FBQ3hFLE1BQU0sSUFBSVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDWixNQUFNLElBQUlzRSxVQUFVLEdBQUcsQ0FBQzFELEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUVaLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3JHLENBQUMsTUFBTSxJQUFLWSxLQUFLLEdBQUdGLEdBQUcsQ0FBQ1EsTUFBTSxDQUFDcUQsR0FBRyxHQUFHQyxJQUFJLENBQUN4RSxNQUFNLENBQUMsQ0FBQ1ksS0FBSyxDQUFDLGNBQWMsQ0FBQyxFQUFHO01BQ3hFNEQsSUFBSSxHQUFHQSxJQUFJLEdBQUc1RCxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUNNLE1BQU0sQ0FBQyxDQUFDLEVBQUVOLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQ1osTUFBTSxJQUFJLENBQUNzRSxVQUFVLEdBQUcsQ0FBQzFELEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxFQUFFLEVBQUVaLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNqRztJQUVBbUUsTUFBTSxJQUFJSyxJQUFJO0lBQ2RELEdBQUcsSUFBSUMsSUFBSSxDQUFDeEUsTUFBTTtJQUNsQixJQUFJdUUsR0FBRyxHQUFHeEQsR0FBRyxFQUFFO01BQ2JvRCxNQUFNLElBQUksTUFBTTtJQUNsQjtFQUNGO0VBRUEsT0FBT0EsTUFBTTtBQUNmOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNNLGdCQUFnQixDQUFDQyxHQUFXLEVBQUVDLEtBQTBCLEVBQUVuRixXQUFtQixFQUFVO0VBQ3JHLElBQU1vRixZQUFZLEdBQUdsQixlQUFlLENBQUNpQixLQUFLLEVBQUUsR0FBRyxFQUFFbkYsV0FBVyxDQUFDO0VBQzdELE9BQU82RSxTQUFTLENBQUNLLEdBQUcsR0FBRyxJQUFJLEdBQUdFLFlBQVksQ0FBQztBQUM3Qzs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNDLGdCQUFnQixHQUFrRDtFQUFBO0VBQUEsSUFBakRDLFVBQVUsdUVBQUcsRUFBRTtFQUM5QyxJQUFNTixJQUFJLEdBQUdNLFVBQVUsQ0FDcEIzRSxRQUFRLEVBQUUsQ0FDVmlDLE9BQU8sQ0FBQyxxQkFBcUIsRUFBRSxHQUFHLENBQUMsQ0FDbkNvQixJQUFJLEVBQUU7RUFDVCxJQUFNNUMsS0FBSyxHQUFHNEQsSUFBSSxDQUFDNUQsS0FBSyxDQUFDLG1CQUFtQixDQUFDO0VBRTdDLE9BQU87SUFDTDhELEdBQUcsRUFBRSxZQUFDOUQsS0FBSyxhQUFMQSxLQUFLLHVCQUFMQSxLQUFLLENBQUcsQ0FBQyxDQUFDLDZDQUFJLEVBQUUsRUFBRTRDLElBQUksRUFBRTtJQUM5Qm1CLEtBQUssRUFBRSxhQUFDL0QsS0FBSyxhQUFMQSxLQUFLLHVCQUFMQSxLQUFLLENBQUcsQ0FBQyxDQUFDLCtDQUFJLEVBQUUsRUFBRTRDLElBQUk7RUFDaEMsQ0FBQztBQUNIOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sU0FBU3VCLGlCQUFpQixDQUFDQyxPQUFlLEVBQXFDO0VBQ3BGLElBQU1DLEtBQUssR0FBR0QsT0FBTyxDQUFDbkIsS0FBSyxDQUFDLFVBQVUsQ0FBQztFQUN2QyxJQUFNcUIsVUFBNkMsR0FBRyxDQUFDLENBQUM7RUFFeEQsS0FBSyxJQUFJcEUsQ0FBQyxHQUFHbUUsS0FBSyxDQUFDakYsTUFBTSxHQUFHLENBQUMsRUFBRWMsQ0FBQyxJQUFJLENBQUMsRUFBRUEsQ0FBQyxFQUFFLEVBQUU7SUFDMUMsSUFBSUEsQ0FBQyxJQUFJbUUsS0FBSyxDQUFDbkUsQ0FBQyxDQUFDLENBQUNGLEtBQUssQ0FBQyxLQUFLLENBQUMsRUFBRTtNQUM5QnFFLEtBQUssQ0FBQ25FLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxNQUFNLEdBQUdtRSxLQUFLLENBQUNuRSxDQUFDLENBQUM7TUFDakNtRSxLQUFLLENBQUNFLE1BQU0sQ0FBQ3JFLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDcEI7RUFDRjtFQUVBLEtBQUssSUFBSUEsRUFBQyxHQUFHLENBQUMsRUFBRUMsR0FBRyxHQUFHa0UsS0FBSyxDQUFDakYsTUFBTSxFQUFFYyxFQUFDLEdBQUdDLEdBQUcsRUFBRUQsRUFBQyxFQUFFLEVBQUU7SUFDaEQsSUFBTXNFLE1BQU0sR0FBR1AsZ0JBQWdCLENBQUNJLEtBQUssQ0FBQ25FLEVBQUMsQ0FBQyxDQUFDO0lBQ3pDLElBQU00RCxHQUFHLEdBQUdVLE1BQU0sQ0FBQ1YsR0FBRyxDQUFDVyxXQUFXLEVBQUU7SUFDcEMsSUFBTVYsS0FBSyxHQUFHUyxNQUFNLENBQUNULEtBQUs7SUFFMUIsSUFBSSxDQUFDTyxVQUFVLENBQUNSLEdBQUcsQ0FBQyxFQUFFO01BQ3BCUSxVQUFVLENBQUNSLEdBQUcsQ0FBQyxHQUFHQyxLQUFLO0lBQ3pCLENBQUMsTUFBTTtNQUNMTyxVQUFVLENBQUNSLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQ1ksTUFBTSxDQUFDSixVQUFVLENBQUNSLEdBQUcsQ0FBQyxFQUFFQyxLQUFLLENBQUM7SUFDckQ7RUFDRjtFQUVBLE9BQU9PLFVBQVU7QUFDbkI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sU0FBU0ssZ0JBQWdCLENBQUM3RSxHQUFXLEVBQTJCO0VBQ3JFLElBQU04RSxRQUdMLEdBQUc7SUFDRmIsS0FBSyxFQUFFLEtBQUs7SUFDWmMsTUFBTSxFQUFFLENBQUM7RUFDWCxDQUFDO0VBQ0QsSUFBSWYsR0FBRyxHQUFHLEtBQUs7RUFDZixJQUFJQyxLQUFLLEdBQUcsRUFBRTtFQUNkLElBQUllLElBQUksR0FBRyxPQUFPO0VBQ2xCLElBQUlDLEtBQUssR0FBRyxLQUFLO0VBQ2pCLElBQUlDLE9BQU8sR0FBRyxLQUFLO0VBQ25CLElBQUl6RSxHQUFHO0VBRVAsS0FBSyxJQUFJTCxDQUFDLEdBQUcsQ0FBQyxFQUFFQyxHQUFHLEdBQUdMLEdBQUcsQ0FBQ1YsTUFBTSxFQUFFYyxDQUFDLEdBQUdDLEdBQUcsRUFBRUQsQ0FBQyxFQUFFLEVBQUU7SUFDOUNLLEdBQUcsR0FBR1QsR0FBRyxDQUFDVSxNQUFNLENBQUNOLENBQUMsQ0FBQztJQUNuQixJQUFJNEUsSUFBSSxLQUFLLEtBQUssRUFBRTtNQUNsQixJQUFJdkUsR0FBRyxLQUFLLEdBQUcsRUFBRTtRQUNmdUQsR0FBRyxHQUFHQyxLQUFLLENBQUNuQixJQUFJLEVBQUUsQ0FBQzZCLFdBQVcsRUFBRTtRQUNoQ0ssSUFBSSxHQUFHLE9BQU87UUFDZGYsS0FBSyxHQUFHLEVBQUU7UUFDVjtNQUNGO01BQ0FBLEtBQUssSUFBSXhELEdBQUc7SUFDZCxDQUFDLE1BQU07TUFDTCxJQUFJeUUsT0FBTyxFQUFFO1FBQ1hqQixLQUFLLElBQUl4RCxHQUFHO01BQ2QsQ0FBQyxNQUFNLElBQUlBLEdBQUcsS0FBSyxJQUFJLEVBQUU7UUFDdkJ5RSxPQUFPLEdBQUcsSUFBSTtRQUNkO01BQ0YsQ0FBQyxNQUFNLElBQUlELEtBQUssSUFBSXhFLEdBQUcsS0FBS3dFLEtBQUssRUFBRTtRQUNqQ0EsS0FBSyxHQUFHLEtBQUs7TUFDZixDQUFDLE1BQU0sSUFBSSxDQUFDQSxLQUFLLElBQUl4RSxHQUFHLEtBQUssR0FBRyxFQUFFO1FBQ2hDd0UsS0FBSyxHQUFHeEUsR0FBRztNQUNiLENBQUMsTUFBTSxJQUFJLENBQUN3RSxLQUFLLElBQUl4RSxHQUFHLEtBQUssR0FBRyxFQUFFO1FBQ2hDLElBQUksQ0FBQ3VELEdBQUcsRUFBRTtVQUNSYyxRQUFRLENBQUNiLEtBQUssR0FBR0EsS0FBSyxDQUFDbkIsSUFBSSxFQUFFO1FBQy9CLENBQUMsTUFBTTtVQUNMZ0MsUUFBUSxDQUFDQyxNQUFNLENBQUNmLEdBQUcsQ0FBQyxHQUFHQyxLQUFLLENBQUNuQixJQUFJLEVBQUU7UUFDckM7UUFDQWtDLElBQUksR0FBRyxLQUFLO1FBQ1pmLEtBQUssR0FBRyxFQUFFO01BQ1osQ0FBQyxNQUFNO1FBQ0xBLEtBQUssSUFBSXhELEdBQUc7TUFDZDtNQUNBeUUsT0FBTyxHQUFHLEtBQUs7SUFDakI7RUFDRjtFQUVBLElBQUlGLElBQUksS0FBSyxPQUFPLEVBQUU7SUFDcEIsSUFBSSxDQUFDaEIsR0FBRyxFQUFFO01BQ1JjLFFBQVEsQ0FBQ2IsS0FBSyxHQUFHQSxLQUFLLENBQUNuQixJQUFJLEVBQUU7SUFDL0IsQ0FBQyxNQUFNO01BQ0xnQyxRQUFRLENBQUNDLE1BQU0sQ0FBQ2YsR0FBRyxDQUFDLEdBQUdDLEtBQUssQ0FBQ25CLElBQUksRUFBRTtJQUNyQztFQUNGLENBQUMsTUFBTSxJQUFJbUIsS0FBSyxDQUFDbkIsSUFBSSxFQUFFLEVBQUU7SUFDdkJnQyxRQUFRLENBQUNDLE1BQU0sQ0FBQ2QsS0FBSyxDQUFDbkIsSUFBSSxFQUFFLENBQUM2QixXQUFXLEVBQUUsQ0FBQyxHQUFHLEVBQUU7RUFDbEQ7O0VBRUE7RUFDQTs7RUFFQTtFQUNBUSxNQUFNLENBQUNDLElBQUksQ0FBQ04sUUFBUSxDQUFDQyxNQUFNLENBQUMsQ0FBQ00sT0FBTyxDQUFDLFVBQVVyQixHQUFHLEVBQUU7SUFDbEQsSUFBSXNCLFNBQVMsRUFBRTNGLEVBQUUsRUFBRU8sS0FBSyxFQUFFK0QsS0FBSztJQUMvQixJQUFLL0QsS0FBSyxHQUFHOEQsR0FBRyxDQUFDOUQsS0FBSyxDQUFDLHlCQUF5QixDQUFDLEVBQUc7TUFDbERvRixTQUFTLEdBQUd0QixHQUFHLENBQUN4RCxNQUFNLENBQUMsQ0FBQyxFQUFFTixLQUFLLENBQUNkLEtBQUssQ0FBQztNQUN0Q08sRUFBRSxHQUFHNEYsTUFBTSxDQUFDckYsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJQSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO01BRXRDLElBQUksQ0FBQzRFLFFBQVEsQ0FBQ0MsTUFBTSxDQUFDTyxTQUFTLENBQUMsSUFBSSxRQUFPUixRQUFRLENBQUNDLE1BQU0sQ0FBQ08sU0FBUyxDQUFDLE1BQUssUUFBUSxFQUFFO1FBQ2pGUixRQUFRLENBQUNDLE1BQU0sQ0FBQ08sU0FBUyxDQUFDLEdBQUc7VUFDM0JFLE9BQU8sRUFBRSxLQUFLO1VBQ2RDLE1BQU0sRUFBRTtRQUNWLENBQUM7TUFDSDtNQUVBeEIsS0FBSyxHQUFHYSxRQUFRLENBQUNDLE1BQU0sQ0FBQ2YsR0FBRyxDQUFDO01BRTVCLElBQUlyRSxFQUFFLEtBQUssQ0FBQyxJQUFJTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUNNLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBS04sS0FBSyxHQUFHK0QsS0FBSyxDQUFDL0QsS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUMsRUFBRTtRQUM1RjRFLFFBQVEsQ0FBQ0MsTUFBTSxDQUFDTyxTQUFTLENBQUMsQ0FBQ0UsT0FBTyxHQUFHdEYsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLFlBQVk7UUFDN0QrRCxLQUFLLEdBQUcvRCxLQUFLLENBQUMsQ0FBQyxDQUFDO01BQ2xCO01BRUE0RSxRQUFRLENBQUNDLE1BQU0sQ0FBQ08sU0FBUyxDQUFDLENBQUNHLE1BQU0sQ0FBQzlGLEVBQUUsQ0FBQyxHQUFHc0UsS0FBSzs7TUFFN0M7TUFDQSxPQUFPYSxRQUFRLENBQUNDLE1BQU0sQ0FBQ2YsR0FBRyxDQUFDO0lBQzdCO0VBQ0YsQ0FBQyxDQUFDOztFQUVGO0VBQ0FtQixNQUFNLENBQUNDLElBQUksQ0FBQ04sUUFBUSxDQUFDQyxNQUFNLENBQUMsQ0FBQ00sT0FBTyxDQUFDLFVBQVVyQixHQUFHLEVBQUU7SUFDbEQsSUFBSUMsS0FBSztJQUNULElBQUlhLFFBQVEsQ0FBQ0MsTUFBTSxDQUFDZixHQUFHLENBQUMsSUFBSTBCLEtBQUssQ0FBQ0MsT0FBTyxDQUFDYixRQUFRLENBQUNDLE1BQU0sQ0FBQ2YsR0FBRyxDQUFDLENBQUN5QixNQUFNLENBQUMsRUFBRTtNQUN0RXhCLEtBQUssR0FBR2EsUUFBUSxDQUFDQyxNQUFNLENBQUNmLEdBQUcsQ0FBQyxDQUFDeUIsTUFBTSxDQUNoQ2hELEdBQUcsQ0FBQyxVQUFVNUMsR0FBRyxFQUFFO1FBQ2xCLE9BQU9BLEdBQUcsSUFBSSxFQUFFO01BQ2xCLENBQUMsQ0FBQyxDQUNEZ0QsSUFBSSxDQUFDLEVBQUUsQ0FBQztNQUVYLElBQUlpQyxRQUFRLENBQUNDLE1BQU0sQ0FBQ2YsR0FBRyxDQUFDLENBQUN3QixPQUFPLEVBQUU7UUFDaEM7UUFDQVYsUUFBUSxDQUFDQyxNQUFNLENBQUNmLEdBQUcsQ0FBQyxHQUNsQixJQUFJLEdBQ0pjLFFBQVEsQ0FBQ0MsTUFBTSxDQUFDZixHQUFHLENBQUMsQ0FBQ3dCLE9BQU8sR0FDNUIsS0FBSyxHQUNMdkIsS0FBSyxDQUNGdkMsT0FBTyxDQUFDLFVBQVUsRUFBRSxVQUFVa0UsQ0FBUyxFQUFVO1VBQ2hEO1VBQ0EsSUFBTUMsQ0FBQyxHQUFHRCxDQUFDLENBQUMvRSxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUNwQixRQUFRLENBQUMsRUFBRSxDQUFDO1VBQ3RDLE9BQU9tRyxDQUFDLEtBQUssR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUlDLENBQUMsQ0FBQ3ZHLE1BQU0sR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLEVBQUUsQ0FBQyxHQUFHdUcsQ0FBQztRQUM5RCxDQUFDLENBQUMsQ0FDRG5FLE9BQU8sQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQ3JCLElBQUksRUFBQztNQUNULENBQUMsTUFBTTtRQUNMb0QsUUFBUSxDQUFDQyxNQUFNLENBQUNmLEdBQUcsQ0FBQyxHQUFHQyxLQUFLO01BQzlCO0lBQ0Y7RUFDRixDQUFDLENBQUM7RUFFRixPQUFPYSxRQUFRO0FBQ2pCOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNnQixrQkFBa0IsQ0FDaEM5QixHQUF3QixFQUN4Qm5GLElBQVksRUFDWmtILFNBQWlCLEVBQ2pCakgsV0FBbUIsRUFDYTtFQUNoQyxJQUFNa0gsSUFBSSxHQUFHLEVBQUU7RUFDZixJQUFJOUQsVUFBVSxHQUFHLE9BQU9yRCxJQUFJLEtBQUssUUFBUSxHQUFHQSxJQUFJLEdBQUcsSUFBQWlDLGVBQU0sRUFBQ2pDLElBQUksRUFBRUMsV0FBVyxDQUFDO0VBQzVFLElBQUlnRixJQUFJO0VBRVJpQyxTQUFTLEdBQUdBLFNBQVMsSUFBSSxFQUFFOztFQUUzQjtFQUNBLElBQUksYUFBYSxDQUFDcEYsSUFBSSxDQUFDOUIsSUFBSSxDQUFDLEVBQUU7SUFDNUI7SUFDQSxJQUFJcUQsVUFBVSxDQUFDNUMsTUFBTSxJQUFJeUcsU0FBUyxFQUFFO01BQ2xDLE9BQU8sQ0FDTDtRQUNFL0IsR0FBRyxFQUFIQSxHQUFHO1FBQ0hDLEtBQUssRUFBRSxTQUFTLENBQUN0RCxJQUFJLENBQUN1QixVQUFVLENBQUMsR0FBRyxHQUFHLEdBQUdBLFVBQVUsR0FBRyxHQUFHLEdBQUdBO01BQy9ELENBQUMsQ0FDRjtJQUNIO0lBRUFBLFVBQVUsR0FBR0EsVUFBVSxDQUFDUixPQUFPLENBQUMsSUFBSXVFLE1BQU0sQ0FBQyxJQUFJLEdBQUdGLFNBQVMsQ0FBQ3RHLFFBQVEsRUFBRSxHQUFHLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxVQUFVTyxHQUFHLEVBQUU7TUFDakdnRyxJQUFJLENBQUN4RCxJQUFJLENBQUM7UUFDUnNCLElBQUksRUFBRTlEO01BQ1IsQ0FBQyxDQUFDO01BQ0YsT0FBTyxFQUFFO0lBQ1gsQ0FBQyxDQUFDO0lBRUYsSUFBSWtDLFVBQVUsRUFBRTtNQUNkOEQsSUFBSSxDQUFDeEQsSUFBSSxDQUFDO1FBQ1JzQixJQUFJLEVBQUU1QjtNQUNSLENBQUMsQ0FBQztJQUNKO0VBQ0YsQ0FBQyxNQUFNO0lBQ0w7SUFDQSxJQUFNZ0UsVUFBVSxHQUFHQyxrQkFBa0IsQ0FBQyxTQUFTLEdBQUdqRSxVQUFVLENBQUM7SUFDN0QsSUFBSTlCLENBQUMsR0FBRyxDQUFDOztJQUVUO0lBQ0EsT0FBTyxJQUFJLEVBQUU7TUFDWCxJQUFJQyxHQUFHLEdBQUcwRixTQUFTO01BQ25CO01BQ0EsSUFBSUcsVUFBVSxDQUFDOUYsQ0FBQyxHQUFHMkYsU0FBUyxHQUFHLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtRQUN6QzFGLEdBQUcsSUFBSSxDQUFDO01BQ1YsQ0FBQyxNQUFNLElBQUk2RixVQUFVLENBQUM5RixDQUFDLEdBQUcyRixTQUFTLEdBQUcsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1FBQ2hEMUYsR0FBRyxJQUFJLENBQUM7TUFDVjtNQUNBeUQsSUFBSSxHQUFHb0MsVUFBVSxDQUFDMUYsTUFBTSxDQUFDSixDQUFDLEVBQUVDLEdBQUcsQ0FBQztNQUNoQyxJQUFJLENBQUN5RCxJQUFJLEVBQUU7UUFDVDtNQUNGO01BQ0FrQyxJQUFJLENBQUN4RCxJQUFJLENBQUM7UUFDUnNCLElBQUksRUFBSkEsSUFBSTtRQUNKc0MsT0FBTyxFQUFFO01BQ1gsQ0FBQyxDQUFDO01BQ0ZoRyxDQUFDLElBQUkwRCxJQUFJLENBQUN4RSxNQUFNO0lBQ2xCO0VBQ0Y7RUFFQSxPQUFPMEcsSUFBSSxDQUFDdkQsR0FBRyxDQUFDLFVBQVU0RCxJQUFJLEVBQUVqRyxDQUFDLEVBQUU7SUFDakMsT0FBTztNQUNMO01BQ0E7TUFDQTtNQUNBNEQsR0FBRyxFQUFFQSxHQUFHLENBQUN2RSxRQUFRLEVBQUUsR0FBRyxHQUFHLEdBQUdXLENBQUMsQ0FBQ1gsUUFBUSxFQUFFLElBQUk0RyxJQUFJLENBQUNELE9BQU8sR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDO01BQ3BFbkMsS0FBSyxFQUFFLFNBQVMsQ0FBQ3RELElBQUksQ0FBQzBGLElBQUksQ0FBQ3ZDLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBR3VDLElBQUksQ0FBQ3ZDLElBQUksR0FBRyxHQUFHLEdBQUd1QyxJQUFJLENBQUN2QztJQUNsRSxDQUFDO0VBQ0gsQ0FBQyxDQUFDO0FBQ0o7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTMUIsdUJBQXVCLENBQUNwQyxHQUFXLEVBQXlCO0VBQUEsSUFBdkJzRyxNQUFNLHVFQUFHLEVBQUU7RUFDdkQsSUFBTUMsYUFBYSxHQUFHLEVBQUUsRUFBQztFQUN6QixJQUFNQyxhQUFhLEdBQUdDLElBQUksQ0FBQ0MsR0FBRyxDQUFDSixNQUFNLEVBQUVDLGFBQWEsQ0FBQztFQUNyRCxJQUFNaEMsS0FBSyxHQUFHLEVBQUU7RUFFaEIsT0FBT3ZFLEdBQUcsQ0FBQ1YsTUFBTSxFQUFFO0lBQ2pCLElBQUlxSCxPQUFPLEdBQUczRyxHQUFHLENBQUNRLE1BQU0sQ0FBQyxDQUFDLEVBQUVnRyxhQUFhLENBQUM7SUFFMUMsSUFBTXRHLEtBQUssR0FBR3lHLE9BQU8sQ0FBQ3pHLEtBQUssQ0FBQyxjQUFjLENBQUMsRUFBQztJQUM1QyxJQUFJQSxLQUFLLEVBQUU7TUFDVHlHLE9BQU8sR0FBR0EsT0FBTyxDQUFDbkcsTUFBTSxDQUFDLENBQUMsRUFBRU4sS0FBSyxDQUFDZCxLQUFLLENBQUM7SUFDMUM7SUFFQSxJQUFJd0gsSUFBSSxHQUFHLEtBQUs7SUFDaEIsT0FBTyxDQUFDQSxJQUFJLEVBQUU7TUFDWixJQUFJbkcsR0FBRztNQUNQbUcsSUFBSSxHQUFHLElBQUk7TUFDWCxJQUFNMUcsTUFBSyxHQUFHRixHQUFHLENBQUNRLE1BQU0sQ0FBQ21HLE9BQU8sQ0FBQ3JILE1BQU0sQ0FBQyxDQUFDWSxLQUFLLENBQUMsa0JBQWtCLENBQUMsRUFBQztNQUNuRSxJQUFJQSxNQUFLLEVBQUU7UUFDVE8sR0FBRyxHQUFHRyxRQUFRLENBQUNWLE1BQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDNUI7UUFDQSxJQUFJTyxHQUFHLEdBQUcsSUFBSSxJQUFJQSxHQUFHLEdBQUcsSUFBSSxFQUFFO1VBQzVCa0csT0FBTyxHQUFHQSxPQUFPLENBQUNuRyxNQUFNLENBQUMsQ0FBQyxFQUFFbUcsT0FBTyxDQUFDckgsTUFBTSxHQUFHLENBQUMsQ0FBQztVQUMvQ3NILElBQUksR0FBRyxLQUFLO1FBQ2Q7TUFDRjtJQUNGO0lBRUEsSUFBSUQsT0FBTyxDQUFDckgsTUFBTSxFQUFFO01BQ2xCaUYsS0FBSyxDQUFDL0IsSUFBSSxDQUFDbUUsT0FBTyxDQUFDO0lBQ3JCO0lBQ0EzRyxHQUFHLEdBQUdBLEdBQUcsQ0FBQ1EsTUFBTSxDQUFDbUcsT0FBTyxDQUFDckgsTUFBTSxDQUFDO0VBQ2xDO0VBRUEsT0FBT2lGLEtBQUs7QUFDZDtBQUVBLFNBQVNwRCx3QkFBd0IsR0FBZ0M7RUFBQSxJQUEvQjBGLGdCQUFnQix1RUFBRyxFQUFFO0VBQ3JELE9BQU9BLGdCQUFnQixDQUNwQi9ELElBQUksRUFBRSxDQUNOcEIsT0FBTyxDQUFDLElBQUl1RSxNQUFNLENBQUMsSUFBSSxHQUFHeEgsZUFBZSxDQUFDZ0IsUUFBUSxFQUFFLEdBQUcsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUMzRXFELElBQUksRUFBRTtBQUNYOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVNsQixvQkFBb0IsR0FBNEI7RUFBQSxJQUEzQmtGLFlBQVksdUVBQUcsRUFBRTtFQUM3QyxJQUFJakQsR0FBRyxHQUFHLENBQUM7RUFDWCxJQUFNeEQsR0FBRyxHQUFHeUcsWUFBWSxDQUFDeEgsTUFBTTtFQUMvQixJQUFNeUgsVUFBVSxHQUFHTixJQUFJLENBQUNPLEtBQUssQ0FBQ3ZJLGVBQWUsR0FBRyxDQUFDLENBQUM7RUFDbEQsSUFBSWdGLE1BQU0sR0FBRyxFQUFFO0VBQ2YsSUFBSXZELEtBQUssRUFBRTRELElBQUk7O0VBRWY7RUFDQSxPQUFPRCxHQUFHLEdBQUd4RCxHQUFHLEVBQUU7SUFDaEJ5RCxJQUFJLEdBQUdnRCxZQUFZLENBQUN0RyxNQUFNLENBQUNxRCxHQUFHLEVBQUVwRixlQUFlLENBQUM7SUFDaEQsSUFBS3lCLEtBQUssR0FBRzRELElBQUksQ0FBQzVELEtBQUssQ0FBQyxNQUFNLENBQUMsRUFBRztNQUNoQzRELElBQUksR0FBR0EsSUFBSSxDQUFDdEQsTUFBTSxDQUFDLENBQUMsRUFBRU4sS0FBSyxDQUFDZCxLQUFLLEdBQUdjLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQ1osTUFBTSxDQUFDO01BQ3BEbUUsTUFBTSxJQUFJSyxJQUFJO01BQ2RELEdBQUcsSUFBSUMsSUFBSSxDQUFDeEUsTUFBTTtNQUNsQjtJQUNGO0lBRUEsSUFBSXdFLElBQUksQ0FBQ3RELE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksRUFBRTtNQUM1QjtNQUNBaUQsTUFBTSxJQUFJSyxJQUFJO01BQ2RELEdBQUcsSUFBSUMsSUFBSSxDQUFDeEUsTUFBTTtNQUNsQjtJQUNGLENBQUMsTUFBTSxJQUFLWSxLQUFLLEdBQUc0RCxJQUFJLENBQUN0RCxNQUFNLENBQUMsQ0FBQ3VHLFVBQVUsQ0FBQyxDQUFDN0csS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFHO01BQzdEO01BQ0E0RCxJQUFJLEdBQUdBLElBQUksQ0FBQ3RELE1BQU0sQ0FBQyxDQUFDLEVBQUVzRCxJQUFJLENBQUN4RSxNQUFNLElBQUlZLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQ1osTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO01BQzFEbUUsTUFBTSxJQUFJSyxJQUFJO01BQ2RELEdBQUcsSUFBSUMsSUFBSSxDQUFDeEUsTUFBTTtNQUNsQjtJQUNGLENBQUMsTUFBTSxJQUNMd0UsSUFBSSxDQUFDeEUsTUFBTSxHQUFHYixlQUFlLEdBQUdzSSxVQUFVLEtBQ3pDN0csS0FBSyxHQUFHNEQsSUFBSSxDQUFDdEQsTUFBTSxDQUFDLENBQUN1RyxVQUFVLENBQUMsQ0FBQzdHLEtBQUssQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDLEVBQ2pFO01BQ0E7TUFDQTRELElBQUksR0FBR0EsSUFBSSxDQUFDdEQsTUFBTSxDQUFDLENBQUMsRUFBRXNELElBQUksQ0FBQ3hFLE1BQU0sSUFBSVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDWixNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDNUQsQ0FBQyxNQUFNLElBQUl3RSxJQUFJLENBQUN0RCxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7TUFDbkNzRCxJQUFJLEdBQUdBLElBQUksQ0FBQ3RELE1BQU0sQ0FBQyxDQUFDLEVBQUVzRCxJQUFJLENBQUN4RSxNQUFNLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLENBQUMsTUFBTTtNQUNMLElBQUl3RSxJQUFJLENBQUM1RCxLQUFLLENBQUMsaUJBQWlCLENBQUMsRUFBRTtRQUNqQztRQUNBLElBQUtBLEtBQUssR0FBRzRELElBQUksQ0FBQzVELEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxFQUFHO1VBQzNDNEQsSUFBSSxHQUFHQSxJQUFJLENBQUN0RCxNQUFNLENBQUMsQ0FBQyxFQUFFc0QsSUFBSSxDQUFDeEUsTUFBTSxHQUFHWSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUNaLE1BQU0sQ0FBQztRQUN0RDs7UUFFQTtRQUNBLE9BQ0V3RSxJQUFJLENBQUN4RSxNQUFNLEdBQUcsQ0FBQyxJQUNmd0UsSUFBSSxDQUFDeEUsTUFBTSxHQUFHZSxHQUFHLEdBQUd3RCxHQUFHLElBQ3ZCLENBQUNDLElBQUksQ0FBQzVELEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxLQUNyQ0EsS0FBSyxHQUFHNEQsSUFBSSxDQUFDNUQsS0FBSyxDQUFDLGdCQUFnQixDQUFDLENBQUMsRUFDdEM7VUFDQSxJQUFNK0csSUFBSSxHQUFHckcsUUFBUSxDQUFDVixLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUNNLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDO1VBQ2hELElBQUl5RyxJQUFJLEdBQUcsR0FBRyxFQUFFO1lBQ2Q7VUFDRjtVQUVBbkQsSUFBSSxHQUFHQSxJQUFJLENBQUN0RCxNQUFNLENBQUMsQ0FBQyxFQUFFc0QsSUFBSSxDQUFDeEUsTUFBTSxHQUFHLENBQUMsQ0FBQztVQUV0QyxJQUFJMkgsSUFBSSxJQUFJLElBQUksRUFBRTtZQUNoQjtVQUNGO1FBQ0Y7TUFDRjtJQUNGO0lBRUEsSUFBSXBELEdBQUcsR0FBR0MsSUFBSSxDQUFDeEUsTUFBTSxHQUFHZSxHQUFHLElBQUl5RCxJQUFJLENBQUN0RCxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLEVBQUU7TUFDdkQsSUFBSXNELElBQUksQ0FBQ3hFLE1BQU0sS0FBS2IsZUFBZSxJQUFJcUYsSUFBSSxDQUFDNUQsS0FBSyxDQUFDLGVBQWUsQ0FBQyxFQUFFO1FBQ2xFNEQsSUFBSSxHQUFHQSxJQUFJLENBQUN0RCxNQUFNLENBQUMsQ0FBQyxFQUFFc0QsSUFBSSxDQUFDeEUsTUFBTSxHQUFHLENBQUMsQ0FBQztNQUN4QyxDQUFDLE1BQU0sSUFBSXdFLElBQUksQ0FBQ3hFLE1BQU0sS0FBS2IsZUFBZSxFQUFFO1FBQzFDcUYsSUFBSSxHQUFHQSxJQUFJLENBQUN0RCxNQUFNLENBQUMsQ0FBQyxFQUFFc0QsSUFBSSxDQUFDeEUsTUFBTSxHQUFHLENBQUMsQ0FBQztNQUN4QztNQUNBdUUsR0FBRyxJQUFJQyxJQUFJLENBQUN4RSxNQUFNO01BQ2xCd0UsSUFBSSxJQUFJLE9BQU87SUFDakIsQ0FBQyxNQUFNO01BQ0xELEdBQUcsSUFBSUMsSUFBSSxDQUFDeEUsTUFBTTtJQUNwQjtJQUVBbUUsTUFBTSxJQUFJSyxJQUFJO0VBQ2hCO0VBRUEsT0FBT0wsTUFBTTtBQUNmIn0=