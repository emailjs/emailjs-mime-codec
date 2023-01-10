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
var _ramda = require("ramda");
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
    [0x0A],
    // <LF>
    [0x0D],
    // <CR>
    [0x20, 0x3C],
    // <SP>!"#$%&'()*+,-./0123456789:;
    [0x3E, 0x7E] // >?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwxyz{|}
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
  var str = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'UTF-8';
  var encodedBytesCount = (str.match(/=[\da-fA-F]{2}/g) || []).length;
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
    var encodedStr = (0, _ramda.pipe)(mimeEncode, qEncodeForbiddenHeaderChars)(_str);
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
  return str.replace(/[^a-z0-9!*+\-/=]/ig, qEncode);
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
  var headerLine = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
  var line = headerLine.toString().replace(/(?:\r?\n|\r)[ \t]*/g, ' ').trim();
  var match = line.match(/^\s*([^:]+):(.*)$/);
  return {
    key: (match && match[1] || '').trim(),
    value: (match && match[2] || '').trim()
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
        if (key === false) {
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
    if (key === false) {
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
    encodedStr = encodedStr.replace(new RegExp('.{' + maxLength + '}', 'g'), function (str) {
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
    var uriEncoded = encodeURIComponent('utf-8\'\'' + encodedStr);
    var i = 0;
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
      key: key + '*' + i + (item.encoded ? '*' : ''),
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
        if (chr < 0xC2 && chr > 0x7F) {
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
  return base64EncodedStr.trim().replace(new RegExp('.{' + MAX_LINE_LENGTH + '}', 'g'), '$&\r\n').trim();
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
        while (line.length > 3 && line.length < len - pos && !line.match(/^(?:=[\da-f]{2}){1,4}$/i) && (match = line.match(/=[\da-f]{2}$/ig))) {
          var code = parseInt(match[0].substr(1, 2), 16);
          if (code < 128) {
            break;
          }
          line = line.substr(0, line.length - 3);
          if (code >= 0xC0) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsIk1BWF9CNjRfTUlNRV9XT1JEX0JZVEVfTEVOR1RIIiwibWltZUVuY29kZSIsImRhdGEiLCJmcm9tQ2hhcnNldCIsImJ1ZmZlciIsImNvbnZlcnQiLCJyZWR1Y2UiLCJhZ2dyZWdhdGUiLCJvcmQiLCJpbmRleCIsIl9jaGVja1JhbmdlcyIsImxlbmd0aCIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsInRvU3RyaW5nIiwidG9VcHBlckNhc2UiLCJuciIsInJhbmdlcyIsInZhbCIsInJhbmdlIiwibWltZURlY29kZSIsInN0ciIsImVuY29kZWRCeXRlc0NvdW50IiwibWF0Y2giLCJVaW50OEFycmF5IiwiaSIsImxlbiIsImJ1ZmZlclBvcyIsImhleCIsInN1YnN0ciIsImNociIsImNoYXJBdCIsInRlc3QiLCJwYXJzZUludCIsImNoYXJDb2RlQXQiLCJkZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJidWYiLCJiNjQiLCJlbmNvZGVCYXNlNjQiLCJfYWRkQmFzZTY0U29mdExpbmVicmVha3MiLCJiYXNlNjREZWNvZGUiLCJkZWNvZGVCYXNlNjQiLCJPVVRQVVRfVFlQRURfQVJSQVkiLCJhcnIyc3RyIiwicXVvdGVkUHJpbnRhYmxlRW5jb2RlIiwibWltZUVuY29kZWRTdHIiLCJyZXBsYWNlIiwic3BhY2VzIiwiX2FkZFFQU29mdExpbmVicmVha3MiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJyYXdTdHJpbmciLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3JkRW5jb2RpbmciLCJwYXJ0cyIsImVuY29kZWRTdHIiLCJwaXBlIiwicUVuY29kZUZvcmJpZGRlbkhlYWRlckNoYXJzIiwiX3NwbGl0TWltZUVuY29kZWRTdHJpbmciLCJqIiwiZW5jb2RlIiwic3Vic3RyaW5nIiwicHVzaCIsIm1hcCIsInByZWZpeCIsInN1ZmZpeCIsInAiLCJqb2luIiwidHJpbSIsInFFbmNvZGUiLCJtaW1lV29yZHNFbmNvZGUiLCJyZWdleCIsIm1pbWVXb3JkRGVjb2RlIiwic3BsaXQiLCJzaGlmdCIsImVuY29kaW5nIiwibWltZVdvcmRzRGVjb2RlIiwicHJldkVuY29kaW5nIiwiZW5kT2ZQcmV2V29yZCIsInJlc3VsdCIsIm1pbWVXb3JkIiwiZm9sZExpbmVzIiwiYWZ0ZXJTcGFjZSIsInBvcyIsImxpbmUiLCJoZWFkZXJMaW5lRW5jb2RlIiwia2V5IiwidmFsdWUiLCJlbmNvZGVkVmFsdWUiLCJoZWFkZXJMaW5lRGVjb2RlIiwiaGVhZGVyTGluZSIsImhlYWRlckxpbmVzRGVjb2RlIiwiaGVhZGVycyIsImxpbmVzIiwiaGVhZGVyc09iaiIsInNwbGljZSIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiY29uY2F0IiwicGFyc2VIZWFkZXJWYWx1ZSIsInJlc3BvbnNlIiwicGFyYW1zIiwidHlwZSIsInF1b3RlIiwiZXNjYXBlZCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiYWN0dWFsS2V5IiwiTnVtYmVyIiwiY2hhcnNldCIsInZhbHVlcyIsIkFycmF5IiwiaXNBcnJheSIsInMiLCJjIiwiY29udGludWF0aW9uRW5jb2RlIiwibWF4TGVuZ3RoIiwibGlzdCIsIlJlZ0V4cCIsInVyaUVuY29kZWQiLCJlbmNvZGVVUklDb21wb25lbnQiLCJlbmNvZGVkIiwiaXRlbSIsIm1heGxlbiIsIm1pbldvcmRMZW5ndGgiLCJtYXhXb3JkTGVuZ3RoIiwiTWF0aCIsIm1heCIsImN1ckxpbmUiLCJkb25lIiwiYmFzZTY0RW5jb2RlZFN0ciIsInFwRW5jb2RlZFN0ciIsImxpbmVNYXJnaW4iLCJmbG9vciIsImNvZGUiXSwic291cmNlcyI6WyIuLi9zcmMvbWltZWNvZGVjLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGVuY29kZSBhcyBlbmNvZGVCYXNlNjQsIGRlY29kZSBhcyBkZWNvZGVCYXNlNjQsIE9VVFBVVF9UWVBFRF9BUlJBWSB9IGZyb20gJ2VtYWlsanMtYmFzZTY0J1xuaW1wb3J0IHsgZW5jb2RlLCBkZWNvZGUsIGNvbnZlcnQsIGFycjJzdHIgfSBmcm9tICcuL2NoYXJzZXQnXG5pbXBvcnQgeyBwaXBlIH0gZnJvbSAncmFtZGEnXG5cbi8vIExpbmVzIGNhbid0IGJlIGxvbmdlciB0aGFuIDc2ICsgPENSPjxMRj4gPSA3OCBieXRlc1xuLy8gaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NSNzZWN0aW9uLTYuN1xuY29uc3QgTUFYX0xJTkVfTEVOR1RIID0gNzZcbmNvbnN0IE1BWF9NSU1FX1dPUkRfTEVOR1RIID0gNTJcbmNvbnN0IE1BWF9CNjRfTUlNRV9XT1JEX0JZVEVfTEVOR1RIID0gMzlcblxuLyoqXG4gKiBFbmNvZGVzIGFsbCBub24gcHJpbnRhYmxlIGFuZCBub24gYXNjaWkgYnl0ZXMgdG8gPVhYIGZvcm0sIHdoZXJlIFhYIGlzIHRoZVxuICogYnl0ZSB2YWx1ZSBpbiBoZXguIFRoaXMgZnVuY3Rpb24gZG9lcyBub3QgY29udmVydCBsaW5lYnJlYWtzIGV0Yy4gaXRcbiAqIG9ubHkgZXNjYXBlcyBjaGFyYWN0ZXIgc2VxdWVuY2VzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBFaXRoZXIgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2UgZW5jb2RpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBlbmNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZUVuY29kZSAoZGF0YSA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgYnVmZmVyID0gY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcbiAgcmV0dXJuIGJ1ZmZlci5yZWR1Y2UoKGFnZ3JlZ2F0ZSwgb3JkLCBpbmRleCkgPT5cbiAgICBfY2hlY2tSYW5nZXMob3JkKSAmJiAhKChvcmQgPT09IDB4MjAgfHwgb3JkID09PSAweDA5KSAmJiAoaW5kZXggPT09IGJ1ZmZlci5sZW5ndGggLSAxIHx8IGJ1ZmZlcltpbmRleCArIDFdID09PSAweDBhIHx8IGJ1ZmZlcltpbmRleCArIDFdID09PSAweDBkKSlcbiAgICAgID8gYWdncmVnYXRlICsgU3RyaW5nLmZyb21DaGFyQ29kZShvcmQpIC8vIGlmIHRoZSBjaGFyIGlzIGluIGFsbG93ZWQgcmFuZ2UsIHRoZW4ga2VlcCBhcyBpcywgdW5sZXNzIGl0IGlzIGEgd3MgaW4gdGhlIGVuZCBvZiBhIGxpbmVcbiAgICAgIDogYWdncmVnYXRlICsgJz0nICsgKG9yZCA8IDB4MTAgPyAnMCcgOiAnJykgKyBvcmQudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCksICcnKVxuXG4gIGZ1bmN0aW9uIF9jaGVja1JhbmdlcyAobnIpIHtcbiAgICBjb25zdCByYW5nZXMgPSBbIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ1I3NlY3Rpb24tNi43XG4gICAgICBbMHgwOV0sIC8vIDxUQUI+XG4gICAgICBbMHgwQV0sIC8vIDxMRj5cbiAgICAgIFsweDBEXSwgLy8gPENSPlxuICAgICAgWzB4MjAsIDB4M0NdLCAvLyA8U1A+IVwiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6O1xuICAgICAgWzB4M0UsIDB4N0VdIC8vID4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9XG4gICAgXVxuICAgIHJldHVybiByYW5nZXMucmVkdWNlKCh2YWwsIHJhbmdlKSA9PiB2YWwgfHwgKHJhbmdlLmxlbmd0aCA9PT0gMSAmJiBuciA9PT0gcmFuZ2VbMF0pIHx8IChyYW5nZS5sZW5ndGggPT09IDIgJiYgbnIgPj0gcmFuZ2VbMF0gJiYgbnIgPD0gcmFuZ2VbMV0pLCBmYWxzZSlcbiAgfVxufVxuXG4vKipcbiAqIERlY29kZXMgbWltZSBlbmNvZGVkIHN0cmluZyB0byBhbiB1bmljb2RlIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZ1xuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2UgZW5jb2RpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZURlY29kZSAoc3RyID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBlbmNvZGVkQnl0ZXNDb3VudCA9IChzdHIubWF0Y2goLz1bXFxkYS1mQS1GXXsyfS9nKSB8fCBbXSkubGVuZ3RoXG4gIGNvbnN0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KHN0ci5sZW5ndGggLSBlbmNvZGVkQnl0ZXNDb3VudCAqIDIpXG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGgsIGJ1ZmZlclBvcyA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGhleCA9IHN0ci5zdWJzdHIoaSArIDEsIDIpXG4gICAgY29uc3QgY2hyID0gc3RyLmNoYXJBdChpKVxuICAgIGlmIChjaHIgPT09ICc9JyAmJiBoZXggJiYgL1tcXGRhLWZBLUZdezJ9Ly50ZXN0KGhleCkpIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBwYXJzZUludChoZXgsIDE2KVxuICAgICAgaSArPSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBjaHIuY2hhckNvZGVBdCgwKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZWNvZGUoYnVmZmVyLCBmcm9tQ2hhcnNldClcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIHR5cGVkIGFycmF5IG9mIGdpdmVuIGNoYXJzZXQgaW50byB1bmljb2RlXG4gKiBiYXNlNjQgc3RyaW5nLiBBbHNvIGFkZHMgbGluZSBicmVha3NcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyBvciB0eXBlZCBhcnJheSB0byBiZSBiYXNlNjQgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IEluaXRpYWwgY2hhcnNldCwgZS5nLiAnYmluYXJ5Jy4gRGVmYXVsdHMgdG8gJ1VURi04J1xuICogQHJldHVybiB7U3RyaW5nfSBCYXNlNjQgZW5jb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NEVuY29kZSAoZGF0YSwgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IGJ1ZiA9ICh0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycgJiYgZnJvbUNoYXJzZXQgPT09ICdiaW5hcnknKSA/IGRhdGEgOiBjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KVxuICBjb25zdCBiNjQgPSBlbmNvZGVCYXNlNjQoYnVmKVxuICByZXR1cm4gX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzKGI2NClcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgYmFzZTY0IHN0cmluZyBvZiBhbnkgY2hhcnNldCBpbnRvIGFuIHVuaWNvZGUgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBCYXNlNjQgZW5jb2RlZCBzdHJpbmdcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgYmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NERlY29kZSAoc3RyLCBmcm9tQ2hhcnNldCkge1xuICBjb25zdCBidWYgPSBkZWNvZGVCYXNlNjQoc3RyLCBPVVRQVVRfVFlQRURfQVJSQVkpXG4gIHJldHVybiBmcm9tQ2hhcnNldCA9PT0gJ2JpbmFyeScgPyBhcnIyc3RyKGJ1ZikgOiBkZWNvZGUoYnVmLCBmcm9tQ2hhcnNldClcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgaW50byBhIHF1b3RlZCBwcmludGFibGUgZW5jb2RpbmdcbiAqIFRoaXMgaXMgYWxtb3N0IHRoZSBzYW1lIGFzIG1pbWVFbmNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWRcbiAqIGFzIHdlbGwgdG8gZW5zdXJlIHRoYXQgdGhlIGxpbmVzIGFyZSBuZXZlciBsb25nZXIgdGhhbiBhbGxvd2VkIGxlbmd0aFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gbWltZSBlbmNvZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlZFByaW50YWJsZUVuY29kZSAoZGF0YSA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgbWltZUVuY29kZWRTdHIgPSBtaW1lRW5jb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIC5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnXFxyXFxuJykgLy8gZml4IGxpbmUgYnJlYWtzLCBlbnN1cmUgPENSPjxMRj5cbiAgICAucmVwbGFjZSgvW1xcdCBdKyQvZ20sIHNwYWNlcyA9PiBzcGFjZXMucmVwbGFjZSgvIC9nLCAnPTIwJykucmVwbGFjZSgvXFx0L2csICc9MDknKSkgLy8gcmVwbGFjZSBzcGFjZXMgaW4gdGhlIGVuZCBvZiBsaW5lc1xuXG4gIHJldHVybiBfYWRkUVBTb2Z0TGluZWJyZWFrcyhtaW1lRW5jb2RlZFN0cikgLy8gYWRkIHNvZnQgbGluZSBicmVha3MgdG8gZW5zdXJlIGxpbmUgbGVuZ3RocyBzam9ydGVyIHRoYW4gNzYgYnl0ZXNcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgc3RyaW5nIGZyb20gYSBxdW90ZWQgcHJpbnRhYmxlIGVuY29kaW5nLiBUaGlzIGlzIGFsbW9zdCB0aGVcbiAqIHNhbWUgYXMgbWltZURlY29kZSwgZXhjZXB0IGxpbmUgYnJlYWtzIHdpbGwgYmUgY2hhbmdlZCBhcyB3ZWxsXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nIHRvIGRlY29kZVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBkZWNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVkUHJpbnRhYmxlRGVjb2RlIChzdHIgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IHJhd1N0cmluZyA9IHN0clxuICAgIC5yZXBsYWNlKC9bXFx0IF0rJC9nbSwgJycpIC8vIHJlbW92ZSBpbnZhbGlkIHdoaXRlc3BhY2UgZnJvbSB0aGUgZW5kIG9mIGxpbmVzXG4gICAgLnJlcGxhY2UoLz0oPzpcXHI/XFxufCQpL2csICcnKSAvLyByZW1vdmUgc29mdCBsaW5lIGJyZWFrc1xuXG4gIHJldHVybiBtaW1lRGVjb2RlKHJhd1N0cmluZywgZnJvbUNoYXJzZXQpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IHRvIGFuIFVURi04IE1JTUUgV29yZFxuICogICBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0N1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7U3RyaW5nfSBTaW5nbGUgb3Igc2V2ZXJhbCBtaW1lIHdvcmRzIGpvaW5lZCB0b2dldGhlclxuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRFbmNvZGUgKGRhdGEsIG1pbWVXb3JkRW5jb2RpbmcgPSAnUScsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBsZXQgcGFydHMgPSBbXVxuICBjb25zdCBzdHIgPSAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG5cbiAgaWYgKG1pbWVXb3JkRW5jb2RpbmcgPT09ICdRJykge1xuICAgIGNvbnN0IHN0ciA9ICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpID8gZGF0YSA6IGRlY29kZShkYXRhLCBmcm9tQ2hhcnNldClcbiAgICBjb25zdCBlbmNvZGVkU3RyID0gcGlwZShtaW1lRW5jb2RlLCBxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMpKHN0cilcbiAgICBwYXJ0cyA9IGVuY29kZWRTdHIubGVuZ3RoIDwgTUFYX01JTUVfV09SRF9MRU5HVEggPyBbZW5jb2RlZFN0cl0gOiBfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyhlbmNvZGVkU3RyLCBNQVhfTUlNRV9XT1JEX0xFTkdUSClcbiAgfSBlbHNlIHtcbiAgICAvLyBGaXRzIGFzIG11Y2ggYXMgcG9zc2libGUgaW50byBldmVyeSBsaW5lIHdpdGhvdXQgYnJlYWtpbmcgdXRmLTggbXVsdGlieXRlIGNoYXJhY3RlcnMnIG9jdGV0cyB1cCBhY3Jvc3MgbGluZXNcbiAgICBsZXQgaiA9IDBcbiAgICBsZXQgaSA9IDBcbiAgICB3aGlsZSAoaSA8IHN0ci5sZW5ndGgpIHtcbiAgICAgIGlmIChlbmNvZGUoc3RyLnN1YnN0cmluZyhqLCBpKSkubGVuZ3RoID4gTUFYX0I2NF9NSU1FX1dPUkRfQllURV9MRU5HVEgpIHtcbiAgICAgICAgLy8gd2Ugd2VudCBvbmUgY2hhcmFjdGVyIHRvbyBmYXIsIHN1YnN0cmluZyBhdCB0aGUgY2hhciBiZWZvcmVcbiAgICAgICAgcGFydHMucHVzaChzdHIuc3Vic3RyaW5nKGosIGkgLSAxKSlcbiAgICAgICAgaiA9IGkgLSAxXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpKytcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gYWRkIHRoZSByZW1haW5kZXIgb2YgdGhlIHN0cmluZ1xuICAgIHN0ci5zdWJzdHJpbmcoaikgJiYgcGFydHMucHVzaChzdHIuc3Vic3RyaW5nKGopKVxuICAgIHBhcnRzID0gcGFydHMubWFwKGVuY29kZSkubWFwKGVuY29kZUJhc2U2NClcbiAgfVxuXG4gIGNvbnN0IHByZWZpeCA9ICc9P1VURi04PycgKyBtaW1lV29yZEVuY29kaW5nICsgJz8nXG4gIGNvbnN0IHN1ZmZpeCA9ICc/PSAnXG4gIHJldHVybiBwYXJ0cy5tYXAocCA9PiBwcmVmaXggKyBwICsgc3VmZml4KS5qb2luKCcnKS50cmltKClcbn1cblxuLyoqXG4gKiBRLUVuY29kZXMgcmVtYWluaW5nIGZvcmJpZGRlbiBoZWFkZXIgY2hhcnNcbiAqICAgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDcjc2VjdGlvbi01XG4gKi9cbmNvbnN0IHFFbmNvZGVGb3JiaWRkZW5IZWFkZXJDaGFycyA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgY29uc3QgcUVuY29kZSA9IGNociA9PiBjaHIgPT09ICcgJyA/ICdfJyA6ICgnPScgKyAoY2hyLmNoYXJDb2RlQXQoMCkgPCAweDEwID8gJzAnIDogJycpICsgY2hyLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvW15hLXowLTkhKitcXC0vPV0vaWcsIHFFbmNvZGUpXG59XG5cbi8qKlxuICogRmluZHMgd29yZCBzZXF1ZW5jZXMgd2l0aCBub24gYXNjaWkgdGV4dCBhbmQgY29udmVydHMgdGhlc2UgdG8gbWltZSB3b3Jkc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBwb3NzaWJsZSBtaW1lIHdvcmRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZHNFbmNvZGUgKGRhdGEgPSAnJywgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IHJlZ2V4ID0gLyhbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKig/OlxccytbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKlxccyopPykrKD89XFxzfCQpL2dcbiAgcmV0dXJuIGRlY29kZShjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KSkucmVwbGFjZShyZWdleCwgbWF0Y2ggPT4gbWF0Y2gubGVuZ3RoID8gbWltZVdvcmRFbmNvZGUobWF0Y2gsIG1pbWVXb3JkRW5jb2RpbmcsIGZyb21DaGFyc2V0KSA6ICcnKVxufVxuXG4vKipcbiAqIERlY29kZSBhIGNvbXBsZXRlIG1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSB3b3JkIGVuY29kZWQgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3JkRGVjb2RlIChzdHIgPSAnJykge1xuICBjb25zdCBtYXRjaCA9IHN0ci5tYXRjaCgvXj1cXD8oW1xcd19cXC0qXSspXFw/KFtRcUJiXSlcXD8oW14/XSopXFw/PSQvaSlcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIHN0clxuXG4gIC8vIFJGQzIyMzEgYWRkZWQgbGFuZ3VhZ2UgdGFnIHRvIHRoZSBlbmNvZGluZ1xuICAvLyBzZWU6IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMjMxI3NlY3Rpb24tNVxuICAvLyB0aGlzIGltcGxlbWVudGF0aW9uIHNpbGVudGx5IGlnbm9yZXMgdGhpcyB0YWdcbiAgY29uc3QgZnJvbUNoYXJzZXQgPSBtYXRjaFsxXS5zcGxpdCgnKicpLnNoaWZ0KClcbiAgY29uc3QgZW5jb2RpbmcgPSAobWF0Y2hbMl0gfHwgJ1EnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKClcbiAgY29uc3QgcmF3U3RyaW5nID0gKG1hdGNoWzNdIHx8ICcnKS5yZXBsYWNlKC9fL2csICcgJylcblxuICBpZiAoZW5jb2RpbmcgPT09ICdCJykge1xuICAgIHJldHVybiBiYXNlNjREZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIGlmIChlbmNvZGluZyA9PT0gJ1EnKSB7XG4gICAgcmV0dXJuIG1pbWVEZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyXG4gIH1cbn1cblxuLyoqXG4gKiBEZWNvZGUgYSBzdHJpbmcgdGhhdCBtaWdodCBpbmNsdWRlIG9uZSBvciBzZXZlcmFsIG1pbWUgd29yZHNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyBpbmNsdWRpbmcgc29tZSBtaW1lIHdvcmRzIHRoYXQgd2lsbCBiZSBlbmNvZGVkXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3Jkc0RlY29kZSAoc3RyID0gJycpIHtcbiAgc3RyID0gc3RyLnRvU3RyaW5nKCkucmVwbGFjZSgvKD1cXD9bXj9dK1xcP1tRcUJiXVxcP1teP10rXFw/PSlcXHMrKD89PVxcP1teP10rXFw/W1FxQmJdXFw/W14/XSpcXD89KS9nLCAnJDEnKVxuICAvLyBqb2luIGJ5dGVzIG9mIG11bHRpLWJ5dGUgVVRGLThcbiAgbGV0IHByZXZFbmNvZGluZ1xuICBzdHIgPSBzdHIucmVwbGFjZSgvKFxcPz0pPz1cXD9bdVVdW3RUXVtmRl0tOFxcPyhbUXFCYl0pXFw/L2csIChtYXRjaCwgZW5kT2ZQcmV2V29yZCwgZW5jb2RpbmcpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSAoZW5kT2ZQcmV2V29yZCAmJiBlbmNvZGluZyA9PT0gcHJldkVuY29kaW5nKSA/ICcnIDogbWF0Y2hcbiAgICBwcmV2RW5jb2RpbmcgPSBlbmNvZGluZ1xuICAgIHJldHVybiByZXN1bHRcbiAgfSlcbiAgc3RyID0gc3RyLnJlcGxhY2UoLz1cXD9bXFx3X1xcLSpdK1xcP1tRcUJiXVxcP1teP10qXFw/PS9nLCBtaW1lV29yZCA9PiBtaW1lV29yZERlY29kZShtaW1lV29yZC5yZXBsYWNlKC9cXHMrL2csICcnKSkpXG5cbiAgcmV0dXJuIHN0clxufVxuXG4vKipcbiAqIEZvbGRzIGxvbmcgbGluZXMsIHVzZWZ1bCBmb3IgZm9sZGluZyBoZWFkZXIgbGluZXMgKGFmdGVyU3BhY2U9ZmFsc2UpIGFuZFxuICogZmxvd2VkIHRleHQgKGFmdGVyU3BhY2U9dHJ1ZSlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBiZSBmb2xkZWRcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gYWZ0ZXJTcGFjZSBJZiB0cnVlLCBsZWF2ZSBhIHNwYWNlIGluIHRoIGVuZCBvZiBhIGxpbmVcbiAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggZm9sZGVkIGxpbmVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb2xkTGluZXMgKHN0ciA9ICcnLCBhZnRlclNwYWNlKSB7XG4gIGxldCBwb3MgPSAwXG4gIGNvbnN0IGxlbiA9IHN0ci5sZW5ndGhcbiAgbGV0IHJlc3VsdCA9ICcnXG4gIGxldCBsaW5lLCBtYXRjaFxuXG4gIHdoaWxlIChwb3MgPCBsZW4pIHtcbiAgICBsaW5lID0gc3RyLnN1YnN0cihwb3MsIE1BWF9MSU5FX0xFTkdUSClcbiAgICBpZiAobGluZS5sZW5ndGggPCBNQVhfTElORV9MRU5HVEgpIHtcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBicmVha1xuICAgIH1cbiAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvXlteXFxuXFxyXSooXFxyP1xcbnxcXHIpLykpKSB7XG4gICAgICBsaW5lID0gbWF0Y2hbMF1cbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxzKylbXlxcc10qJC8pKSAmJiBtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkgPCBsaW5lLmxlbmd0aCkge1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIChhZnRlclNwYWNlID8gKG1hdGNoWzFdIHx8ICcnKS5sZW5ndGggOiAwKSkpXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBzdHIuc3Vic3RyKHBvcyArIGxpbmUubGVuZ3RoKS5tYXRjaCgvXlteXFxzXSsoXFxzKikvKSkpIHtcbiAgICAgIGxpbmUgPSBsaW5lICsgbWF0Y2hbMF0uc3Vic3RyKDAsIG1hdGNoWzBdLmxlbmd0aCAtICghYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpXG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGxpbmVcbiAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICBpZiAocG9zIDwgbGVuKSB7XG4gICAgICByZXN1bHQgKz0gJ1xcclxcbidcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbi8qKlxuICogRW5jb2RlcyBhbmQgZm9sZHMgYSBoZWFkZXIgbGluZSBmb3IgYSBNSU1FIG1lc3NhZ2UgaGVhZGVyLlxuICogU2hvcnRoYW5kIGZvciBtaW1lV29yZHNFbmNvZGUgKyBmb2xkTGluZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSBuYW1lLCB3aWxsIG5vdCBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSB2YWx1ZSBWYWx1ZSB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIENoYXJhY3RlciBzZXQgb2YgdGhlIHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGVuY29kZWQgYW5kIGZvbGRlZCBoZWFkZXIgbGluZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZUVuY29kZSAoa2V5LCB2YWx1ZSwgZnJvbUNoYXJzZXQpIHtcbiAgY29uc3QgZW5jb2RlZFZhbHVlID0gbWltZVdvcmRzRW5jb2RlKHZhbHVlLCAnUScsIGZyb21DaGFyc2V0KVxuICByZXR1cm4gZm9sZExpbmVzKGtleSArICc6ICcgKyBlbmNvZGVkVmFsdWUpXG59XG5cbi8qKlxuICogVGhlIHJlc3VsdCBpcyBub3QgbWltZSB3b3JkIGRlY29kZWQsIHlvdSBuZWVkIHRvIGRvIHlvdXIgb3duIGRlY29kaW5nIGJhc2VkXG4gKiBvbiB0aGUgcnVsZXMgZm9yIHRoZSBzcGVjaWZpYyBoZWFkZXIga2V5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlckxpbmUgU2luZ2xlIGhlYWRlciBsaW5lLCBtaWdodCBpbmNsdWRlIGxpbmVicmVha3MgYXMgd2VsbCBpZiBmb2xkZWRcbiAqIEByZXR1cm4ge09iamVjdH0gQW5kIG9iamVjdCBvZiB7a2V5LCB2YWx1ZX1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVEZWNvZGUgKGhlYWRlckxpbmUgPSAnJykge1xuICBjb25zdCBsaW5lID0gaGVhZGVyTGluZS50b1N0cmluZygpLnJlcGxhY2UoLyg/Olxccj9cXG58XFxyKVsgXFx0XSovZywgJyAnKS50cmltKClcbiAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKihbXjpdKyk6KC4qKSQvKVxuXG4gIHJldHVybiB7XG4gICAga2V5OiAoKG1hdGNoICYmIG1hdGNoWzFdKSB8fCAnJykudHJpbSgpLFxuICAgIHZhbHVlOiAoKG1hdGNoICYmIG1hdGNoWzJdKSB8fCAnJykudHJpbSgpXG4gIH1cbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBibG9jayBvZiBoZWFkZXIgbGluZXMuIERvZXMgbm90IGRlY29kZSBtaW1lIHdvcmRzIGFzIGV2ZXJ5XG4gKiBoZWFkZXIgbWlnaHQgaGF2ZSBpdHMgb3duIHJ1bGVzIChlZy4gZm9ybWF0dGVkIGVtYWlsIGFkZHJlc3NlcyBhbmQgc3VjaClcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVycyBIZWFkZXJzIHN0cmluZ1xuICogQHJldHVybiB7T2JqZWN0fSBBbiBvYmplY3Qgb2YgaGVhZGVycywgd2hlcmUgaGVhZGVyIGtleXMgYXJlIG9iamVjdCBrZXlzLiBOQiEgU2V2ZXJhbCB2YWx1ZXMgd2l0aCB0aGUgc2FtZSBrZXkgbWFrZSB1cCBhbiBBcnJheVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZXNEZWNvZGUgKGhlYWRlcnMpIHtcbiAgY29uc3QgbGluZXMgPSBoZWFkZXJzLnNwbGl0KC9cXHI/XFxufFxcci8pXG4gIGNvbnN0IGhlYWRlcnNPYmogPSB7fVxuXG4gIGZvciAobGV0IGkgPSBsaW5lcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChpICYmIGxpbmVzW2ldLm1hdGNoKC9eXFxzLykpIHtcbiAgICAgIGxpbmVzW2kgLSAxXSArPSAnXFxyXFxuJyArIGxpbmVzW2ldXG4gICAgICBsaW5lcy5zcGxpY2UoaSwgMSlcbiAgICB9XG4gIH1cblxuICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBoZWFkZXIgPSBoZWFkZXJMaW5lRGVjb2RlKGxpbmVzW2ldKVxuICAgIGNvbnN0IGtleSA9IGhlYWRlci5rZXkudG9Mb3dlckNhc2UoKVxuICAgIGNvbnN0IHZhbHVlID0gaGVhZGVyLnZhbHVlXG5cbiAgICBpZiAoIWhlYWRlcnNPYmpba2V5XSkge1xuICAgICAgaGVhZGVyc09ialtrZXldID0gdmFsdWVcbiAgICB9IGVsc2Uge1xuICAgICAgaGVhZGVyc09ialtrZXldID0gW10uY29uY2F0KGhlYWRlcnNPYmpba2V5XSwgdmFsdWUpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGhlYWRlcnNPYmpcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBoZWFkZXIgdmFsdWUgd2l0aCBrZXk9dmFsdWUgYXJndW1lbnRzIGludG8gYSBzdHJ1Y3R1cmVkXG4gKiBvYmplY3QuXG4gKlxuICogICBwYXJzZUhlYWRlclZhbHVlKCdjb250ZW50LXR5cGU6IHRleHQvcGxhaW47IENIQVJTRVQ9J1VURi04JycpIC0+XG4gKiAgIHtcbiAqICAgICAndmFsdWUnOiAndGV4dC9wbGFpbicsXG4gKiAgICAgJ3BhcmFtcyc6IHtcbiAqICAgICAgICdjaGFyc2V0JzogJ1VURi04J1xuICogICAgIH1cbiAqICAgfVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgSGVhZGVyIHZhbHVlXG4gKiBAcmV0dXJuIHtPYmplY3R9IEhlYWRlciB2YWx1ZSBhcyBhIHBhcnNlZCBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSGVhZGVyVmFsdWUgKHN0cikge1xuICBjb25zdCByZXNwb25zZSA9IHtcbiAgICB2YWx1ZTogZmFsc2UsXG4gICAgcGFyYW1zOiB7fVxuICB9XG4gIGxldCBrZXkgPSBmYWxzZVxuICBsZXQgdmFsdWUgPSAnJ1xuICBsZXQgdHlwZSA9ICd2YWx1ZSdcbiAgbGV0IHF1b3RlID0gZmFsc2VcbiAgbGV0IGVzY2FwZWQgPSBmYWxzZVxuICBsZXQgY2hyXG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNociA9IHN0ci5jaGFyQXQoaSlcbiAgICBpZiAodHlwZSA9PT0gJ2tleScpIHtcbiAgICAgIGlmIChjaHIgPT09ICc9Jykge1xuICAgICAgICBrZXkgPSB2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKVxuICAgICAgICB0eXBlID0gJ3ZhbHVlJ1xuICAgICAgICB2YWx1ZSA9ICcnXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICB2YWx1ZSArPSBjaHJcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVzY2FwZWQpIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9IGVsc2UgaWYgKGNociA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGVzY2FwZWQgPSB0cnVlXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9IGVsc2UgaWYgKHF1b3RlICYmIGNociA9PT0gcXVvdGUpIHtcbiAgICAgICAgcXVvdGUgPSBmYWxzZVxuICAgICAgfSBlbHNlIGlmICghcXVvdGUgJiYgY2hyID09PSAnXCInKSB7XG4gICAgICAgIHF1b3RlID0gY2hyXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICc7Jykge1xuICAgICAgICBpZiAoa2V5ID09PSBmYWxzZSkge1xuICAgICAgICAgIHJlc3BvbnNlLnZhbHVlID0gdmFsdWUudHJpbSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZS50cmltKClcbiAgICAgICAgfVxuICAgICAgICB0eXBlID0gJ2tleSdcbiAgICAgICAgdmFsdWUgPSAnJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9XG4gICAgICBlc2NhcGVkID0gZmFsc2VcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZSA9PT0gJ3ZhbHVlJykge1xuICAgIGlmIChrZXkgPT09IGZhbHNlKSB7XG4gICAgICByZXNwb25zZS52YWx1ZSA9IHZhbHVlLnRyaW0oKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlLnRyaW0oKVxuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZS50cmltKCkpIHtcbiAgICByZXNwb25zZS5wYXJhbXNbdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCldID0gJydcbiAgfVxuXG4gIC8vIGhhbmRsZSBwYXJhbWV0ZXIgdmFsdWUgY29udGludWF0aW9uc1xuICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjIzMSNzZWN0aW9uLTNcblxuICAvLyBwcmVwcm9jZXNzIHZhbHVlc1xuICBPYmplY3Qua2V5cyhyZXNwb25zZS5wYXJhbXMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIGxldCBhY3R1YWxLZXksIG5yLCBtYXRjaCwgdmFsdWVcbiAgICBpZiAoKG1hdGNoID0ga2V5Lm1hdGNoKC8oXFwqKFxcZCspfFxcKihcXGQrKVxcKnxcXCopJC8pKSkge1xuICAgICAgYWN0dWFsS2V5ID0ga2V5LnN1YnN0cigwLCBtYXRjaC5pbmRleClcbiAgICAgIG5yID0gTnVtYmVyKG1hdGNoWzJdIHx8IG1hdGNoWzNdKSB8fCAwXG5cbiAgICAgIGlmICghcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gfHwgdHlwZW9mIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSA9IHtcbiAgICAgICAgICBjaGFyc2V0OiBmYWxzZSxcbiAgICAgICAgICB2YWx1ZXM6IFtdXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XVxuXG4gICAgICBpZiAobnIgPT09IDAgJiYgbWF0Y2hbMF0uc3Vic3RyKC0xKSA9PT0gJyonICYmIChtYXRjaCA9IHZhbHVlLm1hdGNoKC9eKFteJ10qKSdbXiddKicoLiopJC8pKSkge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS5jaGFyc2V0ID0gbWF0Y2hbMV0gfHwgJ2lzby04ODU5LTEnXG4gICAgICAgIHZhbHVlID0gbWF0Y2hbMl1cbiAgICAgIH1cblxuICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0udmFsdWVzW25yXSA9IHZhbHVlXG5cbiAgICAgIC8vIHJlbW92ZSB0aGUgb2xkIHJlZmVyZW5jZVxuICAgICAgZGVsZXRlIHJlc3BvbnNlLnBhcmFtc1trZXldXG4gICAgfVxuICB9KVxuXG4gIC8vIGNvbmNhdGVuYXRlIHNwbGl0IHJmYzIyMzEgc3RyaW5ncyBhbmQgY29udmVydCBlbmNvZGVkIHN0cmluZ3MgdG8gbWltZSBlbmNvZGVkIHdvcmRzXG4gIE9iamVjdC5rZXlzKHJlc3BvbnNlLnBhcmFtcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgbGV0IHZhbHVlXG4gICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldICYmIEFycmF5LmlzQXJyYXkocmVzcG9uc2UucGFyYW1zW2tleV0udmFsdWVzKSkge1xuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XS52YWx1ZXMubWFwKGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgcmV0dXJuIHZhbCB8fCAnJ1xuICAgICAgfSkuam9pbignJylcblxuICAgICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldLmNoYXJzZXQpIHtcbiAgICAgICAgLy8gY29udmVydCBcIiVBQlwiIHRvIFwiPT9jaGFyc2V0P1E/PUFCPz1cIlxuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9ICc9PycgKyByZXNwb25zZS5wYXJhbXNba2V5XS5jaGFyc2V0ICsgJz9RPycgKyB2YWx1ZVxuICAgICAgICAgIC5yZXBsYWNlKC9bPT9fXFxzXS9nLCBmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgLy8gZml4IGludmFsaWRseSBlbmNvZGVkIGNoYXJzXG4gICAgICAgICAgICBjb25zdCBjID0gcy5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgcmV0dXJuIHMgPT09ICcgJyA/ICdfJyA6ICclJyArIChjLmxlbmd0aCA8IDIgPyAnMCcgOiAnJykgKyBjXG4gICAgICAgICAgfSlcbiAgICAgICAgICAucmVwbGFjZSgvJS9nLCAnPScpICsgJz89JyAvLyBjaGFuZ2UgZnJvbSB1cmxlbmNvZGluZyB0byBwZXJjZW50IGVuY29kaW5nXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBQYXJhbWV0ZXIgVmFsdWUgQ29udGludWF0aW9uIGVuY29kaW5nIChyZmMyMjMxKVxuICogVXNlZnVsIGZvciBzcGxpdHRpbmcgbG9uZyBwYXJhbWV0ZXIgdmFsdWVzLlxuICpcbiAqIEZvciBleGFtcGxlXG4gKiAgICAgIHRpdGxlPVwidW5pY29kZSBzdHJpbmdcIlxuICogYmVjb21lc1xuICogICAgIHRpdGxlKjAqPVwidXRmLTgnJ3VuaWNvZGVcIlxuICogICAgIHRpdGxlKjEqPVwiJTIwc3RyaW5nXCJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge051bWJlcn0gW21heExlbmd0aD01MF0gTWF4IGxlbmd0aCBmb3IgZ2VuZXJhdGVkIGNodW5rc1xuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7QXJyYXl9IEEgbGlzdCBvZiBlbmNvZGVkIGtleXMgYW5kIGhlYWRlcnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnRpbnVhdGlvbkVuY29kZSAoa2V5LCBkYXRhLCBtYXhMZW5ndGgsIGZyb21DaGFyc2V0KSB7XG4gIGNvbnN0IGxpc3QgPSBbXVxuICBsZXQgZW5jb2RlZFN0ciA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gIGxldCBsaW5lXG5cbiAgbWF4TGVuZ3RoID0gbWF4TGVuZ3RoIHx8IDUwXG5cbiAgLy8gcHJvY2VzcyBhc2NpaSBvbmx5IHRleHRcbiAgaWYgKC9eW1xcdy5cXC0gXSokLy50ZXN0KGRhdGEpKSB7XG4gICAgLy8gY2hlY2sgaWYgY29udmVyc2lvbiBpcyBldmVuIG5lZWRlZFxuICAgIGlmIChlbmNvZGVkU3RyLmxlbmd0aCA8PSBtYXhMZW5ndGgpIHtcbiAgICAgIHJldHVybiBbe1xuICAgICAgICBrZXksXG4gICAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGVuY29kZWRTdHIpID8gJ1wiJyArIGVuY29kZWRTdHIgKyAnXCInIDogZW5jb2RlZFN0clxuICAgICAgfV1cbiAgICB9XG5cbiAgICBlbmNvZGVkU3RyID0gZW5jb2RlZFN0ci5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIG1heExlbmd0aCArICd9JywgJ2cnKSwgZnVuY3Rpb24gKHN0cikge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogc3RyXG4gICAgICB9KVxuICAgICAgcmV0dXJuICcnXG4gICAgfSlcblxuICAgIGlmIChlbmNvZGVkU3RyKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBlbmNvZGVkU3RyXG4gICAgICB9KVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBwcm9jZXNzIHRleHQgd2l0aCB1bmljb2RlIG9yIHNwZWNpYWwgY2hhcnNcbiAgICBjb25zdCB1cmlFbmNvZGVkID0gZW5jb2RlVVJJQ29tcG9uZW50KCd1dGYtOFxcJ1xcJycgKyBlbmNvZGVkU3RyKVxuICAgIGxldCBpID0gMFxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBsZXQgbGVuID0gbWF4TGVuZ3RoXG4gICAgICAvLyBtdXN0IG5vdCBzcGxpdCBoZXggZW5jb2RlZCBieXRlIGJldHdlZW4gbGluZXNcbiAgICAgIGlmICh1cmlFbmNvZGVkW2kgKyBtYXhMZW5ndGggLSAxXSA9PT0gJyUnKSB7XG4gICAgICAgIGxlbiAtPSAxXG4gICAgICB9IGVsc2UgaWYgKHVyaUVuY29kZWRbaSArIG1heExlbmd0aCAtIDJdID09PSAnJScpIHtcbiAgICAgICAgbGVuIC09IDJcbiAgICAgIH1cbiAgICAgIGxpbmUgPSB1cmlFbmNvZGVkLnN1YnN0cihpLCBsZW4pXG4gICAgICBpZiAoIWxpbmUpIHtcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgIGxpbmUsXG4gICAgICAgIGVuY29kZWQ6IHRydWVcbiAgICAgIH0pXG4gICAgICBpICs9IGxpbmUubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxpc3QubWFwKGZ1bmN0aW9uIChpdGVtLCBpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIGVuY29kZWQgbGluZXM6IHtuYW1lfSp7cGFydH0qXG4gICAgICAvLyB1bmVuY29kZWQgbGluZXM6IHtuYW1lfSp7cGFydH1cbiAgICAgIC8vIGlmIGFueSBsaW5lIG5lZWRzIHRvIGJlIGVuY29kZWQgdGhlbiB0aGUgZmlyc3QgbGluZSAocGFydD09MCkgaXMgYWx3YXlzIGVuY29kZWRcbiAgICAgIGtleToga2V5ICsgJyonICsgaSArIChpdGVtLmVuY29kZWQgPyAnKicgOiAnJyksXG4gICAgICB2YWx1ZTogL1tcXHNcIjs9XS8udGVzdChpdGVtLmxpbmUpID8gJ1wiJyArIGl0ZW0ubGluZSArICdcIicgOiBpdGVtLmxpbmVcbiAgICB9XG4gIH0pXG59XG5cbi8qKlxuICogU3BsaXRzIGEgbWltZSBlbmNvZGVkIHN0cmluZy4gTmVlZGVkIGZvciBkaXZpZGluZyBtaW1lIHdvcmRzIGludG8gc21hbGxlciBjaHVua3NcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmcgdG8gYmUgc3BsaXQgdXBcbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhsZW4gTWF4aW11bSBsZW5ndGggb2YgY2hhcmFjdGVycyBmb3Igb25lIHBhcnQgKG1pbmltdW0gMTIpXG4gKiBAcmV0dXJuIHtBcnJheX0gU3BsaXQgc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIF9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nIChzdHIsIG1heGxlbiA9IDEyKSB7XG4gIGNvbnN0IG1pbldvcmRMZW5ndGggPSAxMiAvLyByZXF1aXJlIGF0IGxlYXN0IDEyIHN5bWJvbHMgdG8gZml0IHBvc3NpYmxlIDQgb2N0ZXQgVVRGLTggc2VxdWVuY2VzXG4gIGNvbnN0IG1heFdvcmRMZW5ndGggPSBNYXRoLm1heChtYXhsZW4sIG1pbldvcmRMZW5ndGgpXG4gIGNvbnN0IGxpbmVzID0gW11cblxuICB3aGlsZSAoc3RyLmxlbmd0aCkge1xuICAgIGxldCBjdXJMaW5lID0gc3RyLnN1YnN0cigwLCBtYXhXb3JkTGVuZ3RoKVxuXG4gICAgY29uc3QgbWF0Y2ggPSBjdXJMaW5lLm1hdGNoKC89WzAtOUEtRl0/JC9pKSAvLyBza2lwIGluY29tcGxldGUgZXNjYXBlZCBjaGFyXG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjdXJMaW5lID0gY3VyTGluZS5zdWJzdHIoMCwgbWF0Y2guaW5kZXgpXG4gICAgfVxuXG4gICAgbGV0IGRvbmUgPSBmYWxzZVxuICAgIHdoaWxlICghZG9uZSkge1xuICAgICAgbGV0IGNoclxuICAgICAgZG9uZSA9IHRydWVcbiAgICAgIGNvbnN0IG1hdGNoID0gc3RyLnN1YnN0cihjdXJMaW5lLmxlbmd0aCkubWF0Y2goL149KFswLTlBLUZdezJ9KS9pKSAvLyBjaGVjayBpZiBub3QgbWlkZGxlIG9mIGEgdW5pY29kZSBjaGFyIHNlcXVlbmNlXG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY2hyID0gcGFyc2VJbnQobWF0Y2hbMV0sIDE2KVxuICAgICAgICAvLyBpbnZhbGlkIHNlcXVlbmNlLCBtb3ZlIG9uZSBjaGFyIGJhY2sgYW5jIHJlY2hlY2tcbiAgICAgICAgaWYgKGNociA8IDB4QzIgJiYgY2hyID4gMHg3Rikge1xuICAgICAgICAgIGN1ckxpbmUgPSBjdXJMaW5lLnN1YnN0cigwLCBjdXJMaW5lLmxlbmd0aCAtIDMpXG4gICAgICAgICAgZG9uZSA9IGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY3VyTGluZS5sZW5ndGgpIHtcbiAgICAgIGxpbmVzLnB1c2goY3VyTGluZSlcbiAgICB9XG4gICAgc3RyID0gc3RyLnN1YnN0cihjdXJMaW5lLmxlbmd0aClcbiAgfVxuXG4gIHJldHVybiBsaW5lc1xufVxuXG5mdW5jdGlvbiBfYWRkQmFzZTY0U29mdExpbmVicmVha3MgKGJhc2U2NEVuY29kZWRTdHIgPSAnJykge1xuICByZXR1cm4gYmFzZTY0RW5jb2RlZFN0ci50cmltKCkucmVwbGFjZShuZXcgUmVnRXhwKCcueycgKyBNQVhfTElORV9MRU5HVEggKyAnfScsICdnJyksICckJlxcclxcbicpLnRyaW0oKVxufVxuXG4vKipcbiAqIEFkZHMgc29mdCBsaW5lIGJyZWFrcyh0aGUgb25lcyB0aGF0IHdpbGwgYmUgc3RyaXBwZWQgb3V0IHdoZW4gZGVjb2RpbmcgUVApXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHFwRW5jb2RlZFN0ciBTdHJpbmcgaW4gUXVvdGVkLVByaW50YWJsZSBlbmNvZGluZ1xuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBmb3JjZWQgbGluZSBicmVha3NcbiAqL1xuZnVuY3Rpb24gX2FkZFFQU29mdExpbmVicmVha3MgKHFwRW5jb2RlZFN0ciA9ICcnKSB7XG4gIGxldCBwb3MgPSAwXG4gIGNvbnN0IGxlbiA9IHFwRW5jb2RlZFN0ci5sZW5ndGhcbiAgY29uc3QgbGluZU1hcmdpbiA9IE1hdGguZmxvb3IoTUFYX0xJTkVfTEVOR1RIIC8gMylcbiAgbGV0IHJlc3VsdCA9ICcnXG4gIGxldCBtYXRjaCwgbGluZVxuXG4gIC8vIGluc2VydCBzb2Z0IGxpbmVicmVha3Mgd2hlcmUgbmVlZGVkXG4gIHdoaWxlIChwb3MgPCBsZW4pIHtcbiAgICBsaW5lID0gcXBFbmNvZGVkU3RyLnN1YnN0cihwb3MsIE1BWF9MSU5FX0xFTkdUSClcbiAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvXFxyXFxuLykpKSB7XG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChsaW5lLnN1YnN0cigtMSkgPT09ICdcXG4nKSB7XG4gICAgICAvLyBub3RoaW5nIHRvIGNoYW5nZSBoZXJlXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gbGluZS5zdWJzdHIoLWxpbmVNYXJnaW4pLm1hdGNoKC9cXG4uKj8kLykpKSB7XG4gICAgICAvLyB0cnVuY2F0ZSB0byBuZWFyZXN0IGxpbmUgYnJlYWtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAxKSlcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmIChsaW5lLmxlbmd0aCA+IE1BWF9MSU5FX0xFTkdUSCAtIGxpbmVNYXJnaW4gJiYgKG1hdGNoID0gbGluZS5zdWJzdHIoLWxpbmVNYXJnaW4pLm1hdGNoKC9bIFxcdC4sIT9dW14gXFx0LiwhP10qJC8pKSkge1xuICAgICAgLy8gdHJ1bmNhdGUgdG8gbmVhcmVzdCBzcGFjZVxuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIDEpKVxuICAgIH0gZWxzZSBpZiAobGluZS5zdWJzdHIoLTEpID09PSAnXFxyJykge1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMSlcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGxpbmUubWF0Y2goLz1bXFxkYS1mXXswLDJ9JC9pKSkge1xuICAgICAgICAvLyBwdXNoIGluY29tcGxldGUgZW5jb2Rpbmcgc2VxdWVuY2VzIHRvIHRoZSBuZXh0IGxpbmVcbiAgICAgICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goLz1bXFxkYS1mXXswLDF9JC9pKSkpIHtcbiAgICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSBtYXRjaFswXS5sZW5ndGgpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbnN1cmUgdGhhdCB1dGYtOCBzZXF1ZW5jZXMgYXJlIG5vdCBzcGxpdFxuICAgICAgICB3aGlsZSAobGluZS5sZW5ndGggPiAzICYmIGxpbmUubGVuZ3RoIDwgbGVuIC0gcG9zICYmICFsaW5lLm1hdGNoKC9eKD86PVtcXGRhLWZdezJ9KXsxLDR9JC9pKSAmJiAobWF0Y2ggPSBsaW5lLm1hdGNoKC89W1xcZGEtZl17Mn0kL2lnKSkpIHtcbiAgICAgICAgICBjb25zdCBjb2RlID0gcGFyc2VJbnQobWF0Y2hbMF0uc3Vic3RyKDEsIDIpLCAxNilcbiAgICAgICAgICBpZiAoY29kZSA8IDEyOCkge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAzKVxuXG4gICAgICAgICAgaWYgKGNvZGUgPj0gMHhDMCkge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zICsgbGluZS5sZW5ndGggPCBsZW4gJiYgbGluZS5zdWJzdHIoLTEpICE9PSAnXFxuJykge1xuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSBNQVhfTElORV9MRU5HVEggJiYgbGluZS5tYXRjaCgvPVtcXGRhLWZdezJ9JC9pKSkge1xuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAzKVxuICAgICAgfSBlbHNlIGlmIChsaW5lLmxlbmd0aCA9PT0gTUFYX0xJTkVfTEVOR1RIKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDEpXG4gICAgICB9XG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGxpbmUgKz0gJz1cXHJcXG4nXG4gICAgfSBlbHNlIHtcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgIH1cblxuICAgIHJlc3VsdCArPSBsaW5lXG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbmV4cG9ydCB7IGRlY29kZSwgZW5jb2RlLCBjb252ZXJ0IH1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQTRCO0FBRTVCO0FBQ0E7QUFDQSxJQUFNQSxlQUFlLEdBQUcsRUFBRTtBQUMxQixJQUFNQyxvQkFBb0IsR0FBRyxFQUFFO0FBQy9CLElBQU1DLDZCQUE2QixHQUFHLEVBQUU7O0FBRXhDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLFNBQVNDLFVBQVUsR0FBb0M7RUFBQSxJQUFsQ0MsSUFBSSx1RUFBRyxFQUFFO0VBQUEsSUFBRUMsV0FBVyx1RUFBRyxPQUFPO0VBQzFELElBQU1DLE1BQU0sR0FBRyxJQUFBQyxnQkFBTyxFQUFDSCxJQUFJLEVBQUVDLFdBQVcsQ0FBQztFQUN6QyxPQUFPQyxNQUFNLENBQUNFLE1BQU0sQ0FBQyxVQUFDQyxTQUFTLEVBQUVDLEdBQUcsRUFBRUMsS0FBSztJQUFBLE9BQ3pDQyxZQUFZLENBQUNGLEdBQUcsQ0FBQyxJQUFJLEVBQUUsQ0FBQ0EsR0FBRyxLQUFLLElBQUksSUFBSUEsR0FBRyxLQUFLLElBQUksTUFBTUMsS0FBSyxLQUFLTCxNQUFNLENBQUNPLE1BQU0sR0FBRyxDQUFDLElBQUlQLE1BQU0sQ0FBQ0ssS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSUwsTUFBTSxDQUFDSyxLQUFL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