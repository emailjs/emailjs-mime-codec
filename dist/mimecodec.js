'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convert = exports.encode = exports.decode = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.mimeEncode = mimeEncode;
exports.mimeDecode = mimeDecode;
exports.base64Encode = base64Encode;
exports.base64Decode = base64Decode;
exports.quotedPrintableEncode = quotedPrintableEncode;
exports.quotedPrintableDecode = quotedPrintableDecode;
exports.mimeWordEncode = mimeWordEncode;
exports.mimeWordsEncode = mimeWordsEncode;
exports.mimeWordDecode = mimeWordDecode;
exports.mimeWordsDecode = mimeWordsDecode;
exports.foldLines = foldLines;
exports.headerLineEncode = headerLineEncode;
exports.headerLineDecode = headerLineDecode;
exports.headerLinesDecode = headerLinesDecode;
exports.parseHeaderValue = parseHeaderValue;
exports.continuationEncode = continuationEncode;

var _emailjsBase = require('emailjs-base64');

var _charset = require('./charset');

var _ramda = require('ramda');

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
    var ranges = [// https://tools.ietf.org/html/rfc2045#section-6.7
    [0x09], // <TAB>
    [0x0A], // <LF>
    [0x0D], // <CR>
    [0x20, 0x3C], // <SP>!"#$%&'()*+,-./0123456789:;
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
  var prevEncoding = void 0;
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
  var afterSpace = arguments[1];

  var pos = 0;
  var len = str.length;
  var result = '';
  var line = void 0,
      match = void 0;

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
  var chr = void 0;

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
  var match = void 0,
      line = void 0;

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

exports.decode = _charset.decode;
exports.encode = _charset.encode;
exports.convert = _charset.convert;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMuanMiXSwibmFtZXMiOlsibWltZUVuY29kZSIsIm1pbWVEZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJiYXNlNjREZWNvZGUiLCJxdW90ZWRQcmludGFibGVFbmNvZGUiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsIm1pbWVXb3JkRGVjb2RlIiwibWltZVdvcmRzRGVjb2RlIiwiZm9sZExpbmVzIiwiaGVhZGVyTGluZUVuY29kZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lc0RlY29kZSIsInBhcnNlSGVhZGVyVmFsdWUiLCJjb250aW51YXRpb25FbmNvZGUiLCJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsIk1BWF9CNjRfTUlNRV9XT1JEX0JZVEVfTEVOR1RIIiwiZGF0YSIsImZyb21DaGFyc2V0IiwiYnVmZmVyIiwicmVkdWNlIiwiYWdncmVnYXRlIiwib3JkIiwiaW5kZXgiLCJfY2hlY2tSYW5nZXMiLCJsZW5ndGgiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJ0b1N0cmluZyIsInRvVXBwZXJDYXNlIiwibnIiLCJyYW5nZXMiLCJ2YWwiLCJyYW5nZSIsInN0ciIsImVuY29kZWRCeXRlc0NvdW50IiwibWF0Y2giLCJVaW50OEFycmF5IiwiaSIsImxlbiIsImJ1ZmZlclBvcyIsImhleCIsInN1YnN0ciIsImNociIsImNoYXJBdCIsInRlc3QiLCJwYXJzZUludCIsImNoYXJDb2RlQXQiLCJidWYiLCJiNjQiLCJfYWRkQmFzZTY0U29mdExpbmVicmVha3MiLCJPVVRQVVRfVFlQRURfQVJSQVkiLCJtaW1lRW5jb2RlZFN0ciIsInJlcGxhY2UiLCJzcGFjZXMiLCJfYWRkUVBTb2Z0TGluZWJyZWFrcyIsInJhd1N0cmluZyIsIm1pbWVXb3JkRW5jb2RpbmciLCJwYXJ0cyIsImVuY29kZWRTdHIiLCJxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMiLCJfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyIsImoiLCJzdWJzdHJpbmciLCJwdXNoIiwibWFwIiwiZW5jb2RlIiwiZW5jb2RlQmFzZTY0IiwicHJlZml4Iiwic3VmZml4IiwicCIsImpvaW4iLCJ0cmltIiwicUVuY29kZSIsInJlZ2V4Iiwic3BsaXQiLCJzaGlmdCIsImVuY29kaW5nIiwicHJldkVuY29kaW5nIiwiZW5kT2ZQcmV2V29yZCIsInJlc3VsdCIsIm1pbWVXb3JkIiwiYWZ0ZXJTcGFjZSIsInBvcyIsImxpbmUiLCJrZXkiLCJ2YWx1ZSIsImVuY29kZWRWYWx1ZSIsImhlYWRlckxpbmUiLCJoZWFkZXJzIiwibGluZXMiLCJoZWFkZXJzT2JqIiwic3BsaWNlIiwiaGVhZGVyIiwidG9Mb3dlckNhc2UiLCJjb25jYXQiLCJyZXNwb25zZSIsInBhcmFtcyIsInR5cGUiLCJxdW90ZSIsImVzY2FwZWQiLCJPYmplY3QiLCJrZXlzIiwiZm9yRWFjaCIsImFjdHVhbEtleSIsIk51bWJlciIsImNoYXJzZXQiLCJ2YWx1ZXMiLCJBcnJheSIsImlzQXJyYXkiLCJzIiwiYyIsIm1heExlbmd0aCIsImxpc3QiLCJSZWdFeHAiLCJ1cmlFbmNvZGVkIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZW5jb2RlZCIsIml0ZW0iLCJtYXhsZW4iLCJtaW5Xb3JkTGVuZ3RoIiwibWF4V29yZExlbmd0aCIsIk1hdGgiLCJtYXgiLCJjdXJMaW5lIiwiZG9uZSIsImJhc2U2NEVuY29kZWRTdHIiLCJxcEVuY29kZWRTdHIiLCJsaW5lTWFyZ2luIiwiZmxvb3IiLCJjb2RlIiwiZGVjb2RlIiwiY29udmVydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O1FBbUJnQkEsVSxHQUFBQSxVO1FBMEJBQyxVLEdBQUFBLFU7UUEwQkFDLFksR0FBQUEsWTtRQWFBQyxZLEdBQUFBLFk7UUFjQUMscUIsR0FBQUEscUI7UUFnQkFDLHFCLEdBQUFBLHFCO1FBaUJBQyxjLEdBQUFBLGM7UUFnREFDLGUsR0FBQUEsZTtRQVdBQyxjLEdB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aW1wb3J0IHsgZW5jb2RlIGFzIGVuY29kZUJhc2U2NCwgZGVjb2RlIGFzIGRlY29kZUJhc2U2NCwgT1VUUFVUX1RZUEVEX0FSUkFZIH0gZnJvbSAnZW1haWxqcy1iYXNlNjQnXHJcbmltcG9ydCB7IGVuY29kZSwgZGVjb2RlLCBjb252ZXJ0LCBhcnIyc3RyIH0gZnJvbSAnLi9jaGFyc2V0J1xyXG5pbXBvcnQgeyBwaXBlIH0gZnJvbSAncmFtZGEnXHJcblxyXG4vLyBMaW5lcyBjYW4ndCBiZSBsb25nZXIgdGhhbiA3NiArIDxDUj48TEY+ID0gNzggYnl0ZXNcclxuLy8gaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NSNzZWN0aW9uLTYuN1xyXG5jb25zdCBNQVhfTElORV9MRU5HVEggPSA3NlxyXG5jb25zdCBNQVhfTUlNRV9XT1JEX0xFTkdUSCA9IDUyXHJcbmNvbnN0IE1BWF9CNjRfTUlNRV9XT1JEX0JZVEVfTEVOR1RIID0gMzlcclxuXHJcbi8qKlxyXG4gKiBFbmNvZGVzIGFsbCBub24gcHJpbnRhYmxlIGFuZCBub24gYXNjaWkgYnl0ZXMgdG8gPVhYIGZvcm0sIHdoZXJlIFhYIGlzIHRoZVxyXG4gKiBieXRlIHZhbHVlIGluIGhleC4gVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBjb252ZXJ0IGxpbmVicmVha3MgZXRjLiBpdFxyXG4gKiBvbmx5IGVzY2FwZXMgY2hhcmFjdGVyIHNlcXVlbmNlc1xyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIEVpdGhlciBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5XHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIGVuY29kaW5nXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBlbmNvZGVkIHN0cmluZ1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIG1pbWVFbmNvZGUgKGRhdGEgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XHJcbiAgY29uc3QgYnVmZmVyID0gY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcclxuICByZXR1cm4gYnVmZmVyLnJlZHVjZSgoYWdncmVnYXRlLCBvcmQsIGluZGV4KSA9PlxyXG4gICAgX2NoZWNrUmFuZ2VzKG9yZCkgJiYgISgob3JkID09PSAweDIwIHx8IG9yZCA9PT0gMHgwOSkgJiYgKGluZGV4ID09PSBidWZmZXIubGVuZ3RoIC0gMSB8fCBidWZmZXJbaW5kZXggKyAxXSA9PT0gMHgwYSB8fCBidWZmZXJbaW5kZXggKyAxXSA9PT0gMHgwZCkpXHJcbiAgICAgID8gYWdncmVnYXRlICsgU3RyaW5nLmZyb21DaGFyQ29kZShvcmQpIC8vIGlmIHRoZSBjaGFyIGlzIGluIGFsbG93ZWQgcmFuZ2UsIHRoZW4ga2VlcCBhcyBpcywgdW5sZXNzIGl0IGlzIGEgd3MgaW4gdGhlIGVuZCBvZiBhIGxpbmVcclxuICAgICAgOiBhZ2dyZWdhdGUgKyAnPScgKyAob3JkIDwgMHgxMCA/ICcwJyA6ICcnKSArIG9yZC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSwgJycpXHJcblxyXG4gIGZ1bmN0aW9uIF9jaGVja1JhbmdlcyAobnIpIHtcclxuICAgIGNvbnN0IHJhbmdlcyA9IFsgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDUjc2VjdGlvbi02LjdcclxuICAgICAgWzB4MDldLCAvLyA8VEFCPlxyXG4gICAgICBbMHgwQV0sIC8vIDxMRj5cclxuICAgICAgWzB4MERdLCAvLyA8Q1I+XHJcbiAgICAgIFsweDIwLCAweDNDXSwgLy8gPFNQPiFcIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5OjtcclxuICAgICAgWzB4M0UsIDB4N0VdIC8vID4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9XHJcbiAgICBdXHJcbiAgICByZXR1cm4gcmFuZ2VzLnJlZHVjZSgodmFsLCByYW5nZSkgPT4gdmFsIHx8IChyYW5nZS5sZW5ndGggPT09IDEgJiYgbnIgPT09IHJhbmdlWzBdKSB8fCAocmFuZ2UubGVuZ3RoID09PSAyICYmIG5yID49IHJhbmdlWzBdICYmIG5yIDw9IHJhbmdlWzFdKSwgZmFsc2UpXHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVjb2RlcyBtaW1lIGVuY29kZWQgc3RyaW5nIHRvIGFuIHVuaWNvZGUgc3RyaW5nXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZ1xyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtaW1lRGVjb2RlIChzdHIgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XHJcbiAgY29uc3QgZW5jb2RlZEJ5dGVzQ291bnQgPSAoc3RyLm1hdGNoKC89W1xcZGEtZkEtRl17Mn0vZykgfHwgW10pLmxlbmd0aFxyXG4gIGxldCBidWZmZXIgPSBuZXcgVWludDhBcnJheShzdHIubGVuZ3RoIC0gZW5jb2RlZEJ5dGVzQ291bnQgKiAyKVxyXG5cclxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3RyLmxlbmd0aCwgYnVmZmVyUG9zID0gMDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICBsZXQgaGV4ID0gc3RyLnN1YnN0cihpICsgMSwgMilcclxuICAgIGNvbnN0IGNociA9IHN0ci5jaGFyQXQoaSlcclxuICAgIGlmIChjaHIgPT09ICc9JyAmJiBoZXggJiYgL1tcXGRhLWZBLUZdezJ9Ly50ZXN0KGhleCkpIHtcclxuICAgICAgYnVmZmVyW2J1ZmZlclBvcysrXSA9IHBhcnNlSW50KGhleCwgMTYpXHJcbiAgICAgIGkgKz0gMlxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgYnVmZmVyW2J1ZmZlclBvcysrXSA9IGNoci5jaGFyQ29kZUF0KDApXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZGVjb2RlKGJ1ZmZlciwgZnJvbUNoYXJzZXQpXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIHR5cGVkIGFycmF5IG9mIGdpdmVuIGNoYXJzZXQgaW50byB1bmljb2RlXHJcbiAqIGJhc2U2NCBzdHJpbmcuIEFsc28gYWRkcyBsaW5lIGJyZWFrc1xyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyBvciB0eXBlZCBhcnJheSB0byBiZSBiYXNlNjQgZW5jb2RlZFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gSW5pdGlhbCBjaGFyc2V0LCBlLmcuICdiaW5hcnknLiBEZWZhdWx0cyB0byAnVVRGLTgnXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gQmFzZTY0IGVuY29kZWQgc3RyaW5nXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gYmFzZTY0RW5jb2RlIChkYXRhLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcclxuICBjb25zdCBidWYgPSAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnICYmIGZyb21DaGFyc2V0ID09PSAnYmluYXJ5JykgPyBkYXRhIDogY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcclxuICBjb25zdCBiNjQgPSBlbmNvZGVCYXNlNjQoYnVmKVxyXG4gIHJldHVybiBfYWRkQmFzZTY0U29mdExpbmVicmVha3MoYjY0KVxyXG59XHJcblxyXG4vKipcclxuICogRGVjb2RlcyBhIGJhc2U2NCBzdHJpbmcgb2YgYW55IGNoYXJzZXQgaW50byBhbiB1bmljb2RlIHN0cmluZ1xyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEJhc2U2NCBlbmNvZGVkIHN0cmluZ1xyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIGJhc2U2NCBlbmNvZGVkIHN0cmluZ1xyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjREZWNvZGUgKHN0ciwgZnJvbUNoYXJzZXQpIHtcclxuICBjb25zdCBidWYgPSBkZWNvZGVCYXNlNjQoc3RyLCBPVVRQVVRfVFlQRURfQVJSQVkpXHJcbiAgcmV0dXJuIGZyb21DaGFyc2V0ID09PSAnYmluYXJ5JyA/IGFycjJzdHIoYnVmKSA6IGRlY29kZShidWYsIGZyb21DaGFyc2V0KVxyXG59XHJcblxyXG4vKipcclxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IGludG8gYSBxdW90ZWQgcHJpbnRhYmxlIGVuY29kaW5nXHJcbiAqIFRoaXMgaXMgYWxtb3N0IHRoZSBzYW1lIGFzIG1pbWVFbmNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWRcclxuICogYXMgd2VsbCB0byBlbnN1cmUgdGhhdCB0aGUgbGluZXMgYXJlIG5ldmVyIGxvbmdlciB0aGFuIGFsbG93ZWQgbGVuZ3RoXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gbWltZSBlbmNvZGVcclxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBzdHJpbmdcclxuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGVuY29kZWQgc3RyaW5nXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVkUHJpbnRhYmxlRW5jb2RlIChkYXRhID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xyXG4gIGNvbnN0IG1pbWVFbmNvZGVkU3RyID0gbWltZUVuY29kZShkYXRhLCBmcm9tQ2hhcnNldClcclxuICAgIC5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnXFxyXFxuJykgLy8gZml4IGxpbmUgYnJlYWtzLCBlbnN1cmUgPENSPjxMRj5cclxuICAgIC5yZXBsYWNlKC9bXFx0IF0rJC9nbSwgc3BhY2VzID0+IHNwYWNlcy5yZXBsYWNlKC8gL2csICc9MjAnKS5yZXBsYWNlKC9cXHQvZywgJz0wOScpKSAvLyByZXBsYWNlIHNwYWNlcyBpbiB0aGUgZW5kIG9mIGxpbmVzXHJcblxyXG4gIHJldHVybiBfYWRkUVBTb2Z0TGluZWJyZWFrcyhtaW1lRW5jb2RlZFN0cikgLy8gYWRkIHNvZnQgbGluZSBicmVha3MgdG8gZW5zdXJlIGxpbmUgbGVuZ3RocyBzam9ydGVyIHRoYW4gNzYgYnl0ZXNcclxufVxyXG5cclxuLyoqXHJcbiAqIERlY29kZXMgYSBzdHJpbmcgZnJvbSBhIHF1b3RlZCBwcmludGFibGUgZW5jb2RpbmcuIFRoaXMgaXMgYWxtb3N0IHRoZVxyXG4gKiBzYW1lIGFzIG1pbWVEZWNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWQgYXMgd2VsbFxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmcgdG8gZGVjb2RlXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgc3RyaW5nXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBkZWNvZGVkIHN0cmluZ1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlZFByaW50YWJsZURlY29kZSAoc3RyID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xyXG4gIGNvbnN0IHJhd1N0cmluZyA9IHN0clxyXG4gICAgLnJlcGxhY2UoL1tcXHQgXSskL2dtLCAnJykgLy8gcmVtb3ZlIGludmFsaWQgd2hpdGVzcGFjZSBmcm9tIHRoZSBlbmQgb2YgbGluZXNcclxuICAgIC5yZXBsYWNlKC89KD86XFxyP1xcbnwkKS9nLCAnJykgLy8gcmVtb3ZlIHNvZnQgbGluZSBicmVha3NcclxuXHJcbiAgcmV0dXJuIG1pbWVEZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcclxufVxyXG5cclxuLyoqXHJcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBNSU1FIFdvcmRcclxuICogICBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0N1xyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBzaGFyYWN0ZXIgc2V0XHJcbiAqIEByZXR1cm4ge1N0cmluZ30gU2luZ2xlIG9yIHNldmVyYWwgbWltZSB3b3JkcyBqb2luZWQgdG9nZXRoZXJcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZEVuY29kZSAoZGF0YSwgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XHJcbiAgbGV0IHBhcnRzID0gW11cclxuICBjb25zdCBzdHIgPSAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXHJcblxyXG4gIGlmIChtaW1lV29yZEVuY29kaW5nID09PSAnUScpIHtcclxuICAgIGNvbnN0IHN0ciA9ICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpID8gZGF0YSA6IGRlY29kZShkYXRhLCBmcm9tQ2hhcnNldClcclxuICAgIGxldCBlbmNvZGVkU3RyID0gcGlwZShtaW1lRW5jb2RlLCBxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMpKHN0cilcclxuICAgIHBhcnRzID0gZW5jb2RlZFN0ci5sZW5ndGggPCBNQVhfTUlNRV9XT1JEX0xFTkdUSCA/IFtlbmNvZGVkU3RyXSA6IF9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nKGVuY29kZWRTdHIsIE1BWF9NSU1FX1dPUkRfTEVOR1RIKVxyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBGaXRzIGFzIG11Y2ggYXMgcG9zc2libGUgaW50byBldmVyeSBsaW5lIHdpdGhvdXQgYnJlYWtpbmcgdXRmLTggbXVsdGlieXRlIGNoYXJhY3RlcnMnIG9jdGV0cyB1cCBhY3Jvc3MgbGluZXNcclxuICAgIGxldCBqID0gMFxyXG4gICAgbGV0IGkgPSAwXHJcbiAgICB3aGlsZSAoaSA8IHN0ci5sZW5ndGgpIHtcclxuICAgICAgaWYgKGVuY29kZShzdHIuc3Vic3RyaW5nKGosIGkpKS5sZW5ndGggPiBNQVhfQjY0X01JTUVfV09SRF9CWVRFX0xFTkdUSCkge1xyXG4gICAgICAgIC8vIHdlIHdlbnQgb25lIGNoYXJhY3RlciB0b28gZmFyLCBzdWJzdHJpbmcgYXQgdGhlIGNoYXIgYmVmb3JlXHJcbiAgICAgICAgcGFydHMucHVzaChzdHIuc3Vic3RyaW5nKGosIGkgLSAxKSlcclxuICAgICAgICBqID0gaSAtIDFcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpKytcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgLy8gYWRkIHRoZSByZW1haW5kZXIgb2YgdGhlIHN0cmluZ1xyXG4gICAgc3RyLnN1YnN0cmluZyhqKSAmJiBwYXJ0cy5wdXNoKHN0ci5zdWJzdHJpbmcoaikpXHJcbiAgICBwYXJ0cyA9IHBhcnRzLm1hcChlbmNvZGUpLm1hcChlbmNvZGVCYXNlNjQpXHJcbiAgfVxyXG5cclxuICBjb25zdCBwcmVmaXggPSAnPT9VVEYtOD8nICsgbWltZVdvcmRFbmNvZGluZyArICc/J1xyXG4gIGNvbnN0IHN1ZmZpeCA9ICc/PSAnXHJcbiAgcmV0dXJuIHBhcnRzLm1hcChwID0+IHByZWZpeCArIHAgKyBzdWZmaXgpLmpvaW4oJycpLnRyaW0oKVxyXG59XHJcblxyXG4vKipcclxuICogUS1FbmNvZGVzIHJlbWFpbmluZyBmb3JiaWRkZW4gaGVhZGVyIGNoYXJzXHJcbiAqICAgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDcjc2VjdGlvbi01XHJcbiAqL1xyXG5jb25zdCBxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMgPSBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgY29uc3QgcUVuY29kZSA9IGNociA9PiBjaHIgPT09ICcgJyA/ICdfJyA6ICgnPScgKyAoY2hyLmNoYXJDb2RlQXQoMCkgPCAweDEwID8gJzAnIDogJycpICsgY2hyLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkpXHJcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9bXmEtejAtOSEqK1xcLS89XS9pZywgcUVuY29kZSlcclxufVxyXG5cclxuLyoqXHJcbiAqIEZpbmRzIHdvcmQgc2VxdWVuY2VzIHdpdGggbm9uIGFzY2lpIHRleHQgYW5kIGNvbnZlcnRzIHRoZXNlIHRvIG1pbWUgd29yZHNcclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gbWltZVdvcmRFbmNvZGluZz0nUScgRW5jb2RpbmcgZm9yIHRoZSBtaW1lIHdvcmQsIGVpdGhlciBRIG9yIEJcclxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIHBvc3NpYmxlIG1pbWUgd29yZHNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZHNFbmNvZGUgKGRhdGEgPSAnJywgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XHJcbiAgY29uc3QgcmVnZXggPSAvKFteXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qKD86XFxzK1teXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qXFxzKik/KSsoPz1cXHN8JCkvZ1xyXG4gIHJldHVybiBkZWNvZGUoY29udmVydChkYXRhLCBmcm9tQ2hhcnNldCkpLnJlcGxhY2UocmVnZXgsIG1hdGNoID0+IG1hdGNoLmxlbmd0aCA/IG1pbWVXb3JkRW5jb2RlKG1hdGNoLCBtaW1lV29yZEVuY29kaW5nLCBmcm9tQ2hhcnNldCkgOiAnJylcclxufVxyXG5cclxuLyoqXHJcbiAqIERlY29kZSBhIGNvbXBsZXRlIG1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZERlY29kZSAoc3RyID0gJycpIHtcclxuICBjb25zdCBtYXRjaCA9IHN0ci5tYXRjaCgvXj1cXD8oW1xcd19cXC0qXSspXFw/KFtRcUJiXSlcXD8oW14/XSopXFw/PSQvaSlcclxuICBpZiAoIW1hdGNoKSByZXR1cm4gc3RyXHJcblxyXG4gIC8vIFJGQzIyMzEgYWRkZWQgbGFuZ3VhZ2UgdGFnIHRvIHRoZSBlbmNvZGluZ1xyXG4gIC8vIHNlZTogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIyMzEjc2VjdGlvbi01XHJcbiAgLy8gdGhpcyBpbXBsZW1lbnRhdGlvbiBzaWxlbnRseSBpZ25vcmVzIHRoaXMgdGFnXHJcbiAgY29uc3QgZnJvbUNoYXJzZXQgPSBtYXRjaFsxXS5zcGxpdCgnKicpLnNoaWZ0KClcclxuICBjb25zdCBlbmNvZGluZyA9IChtYXRjaFsyXSB8fCAnUScpLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKVxyXG4gIGNvbnN0IHJhd1N0cmluZyA9IChtYXRjaFszXSB8fCAnJykucmVwbGFjZSgvXy9nLCAnICcpXHJcblxyXG4gIGlmIChlbmNvZGluZyA9PT0gJ0InKSB7XHJcbiAgICByZXR1cm4gYmFzZTY0RGVjb2RlKHJhd1N0cmluZywgZnJvbUNoYXJzZXQpXHJcbiAgfSBlbHNlIGlmIChlbmNvZGluZyA9PT0gJ1EnKSB7XHJcbiAgICByZXR1cm4gbWltZURlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxyXG4gIH0gZWxzZSB7XHJcbiAgICByZXR1cm4gc3RyXHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRGVjb2RlIGEgc3RyaW5nIHRoYXQgbWlnaHQgaW5jbHVkZSBvbmUgb3Igc2V2ZXJhbCBtaW1lIHdvcmRzXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIGluY2x1ZGluZyBzb21lIG1pbWUgd29yZHMgdGhhdCB3aWxsIGJlIGVuY29kZWRcclxuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRzRGVjb2RlIChzdHIgPSAnJykge1xyXG4gIHN0ciA9IHN0ci50b1N0cmluZygpLnJlcGxhY2UoLyg9XFw/W14/XStcXD9bUXFCYl1cXD9bXj9dK1xcPz0pXFxzKyg/PT1cXD9bXj9dK1xcP1tRcUJiXVxcP1teP10qXFw/PSkvZywgJyQxJylcclxuICAvLyBqb2luIGJ5dGVzIG9mIG11bHRpLWJ5dGUgVVRGLThcclxuICBsZXQgcHJldkVuY29kaW5nXHJcbiAgc3RyID0gc3RyLnJlcGxhY2UoLyhcXD89KT89XFw/W3VVXVt0VF1bZkZdLThcXD8oW1FxQmJdKVxcPy9nLCAobWF0Y2gsIGVuZE9mUHJldldvcmQsIGVuY29kaW5nKSA9PiB7XHJcbiAgICBjb25zdCByZXN1bHQgPSAoZW5kT2ZQcmV2V29yZCAmJiBlbmNvZGluZyA9PT0gcHJldkVuY29kaW5nKSA/ICcnIDogbWF0Y2hcclxuICAgIHByZXZFbmNvZGluZyA9IGVuY29kaW5nXHJcbiAgICByZXR1cm4gcmVzdWx0XHJcbiAgfSlcclxuICBzdHIgPSBzdHIucmVwbGFjZSgvPVxcP1tcXHdfXFwtKl0rXFw/W1FxQmJdXFw/W14/XSpcXD89L2csIG1pbWVXb3JkID0+IG1pbWVXb3JkRGVjb2RlKG1pbWVXb3JkLnJlcGxhY2UoL1xccysvZywgJycpKSlcclxuXHJcbiAgcmV0dXJuIHN0clxyXG59XHJcblxyXG4vKipcclxuICogRm9sZHMgbG9uZyBsaW5lcywgdXNlZnVsIGZvciBmb2xkaW5nIGhlYWRlciBsaW5lcyAoYWZ0ZXJTcGFjZT1mYWxzZSkgYW5kXHJcbiAqIGZsb3dlZCB0ZXh0IChhZnRlclNwYWNlPXRydWUpXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIGJlIGZvbGRlZFxyXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGFmdGVyU3BhY2UgSWYgdHJ1ZSwgbGVhdmUgYSBzcGFjZSBpbiB0aCBlbmQgb2YgYSBsaW5lXHJcbiAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggZm9sZGVkIGxpbmVzXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZm9sZExpbmVzIChzdHIgPSAnJywgYWZ0ZXJTcGFjZSkge1xyXG4gIGxldCBwb3MgPSAwXHJcbiAgY29uc3QgbGVuID0gc3RyLmxlbmd0aFxyXG4gIGxldCByZXN1bHQgPSAnJ1xyXG4gIGxldCBsaW5lLCBtYXRjaFxyXG5cclxuICB3aGlsZSAocG9zIDwgbGVuKSB7XHJcbiAgICBsaW5lID0gc3RyLnN1YnN0cihwb3MsIE1BWF9MSU5FX0xFTkdUSClcclxuICAgIGlmIChsaW5lLmxlbmd0aCA8IE1BWF9MSU5FX0xFTkdUSCkge1xyXG4gICAgICByZXN1bHQgKz0gbGluZVxyXG4gICAgICBicmVha1xyXG4gICAgfVxyXG4gICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goL15bXlxcblxccl0qKFxccj9cXG58XFxyKS8pKSkge1xyXG4gICAgICBsaW5lID0gbWF0Y2hbMF1cclxuICAgICAgcmVzdWx0ICs9IGxpbmVcclxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXHJcbiAgICAgIGNvbnRpbnVlXHJcbiAgICB9IGVsc2UgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goLyhcXHMrKVteXFxzXSokLykpICYmIG1hdGNoWzBdLmxlbmd0aCAtIChhZnRlclNwYWNlID8gKG1hdGNoWzFdIHx8ICcnKS5sZW5ndGggOiAwKSA8IGxpbmUubGVuZ3RoKSB7XHJcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpKVxyXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBzdHIuc3Vic3RyKHBvcyArIGxpbmUubGVuZ3RoKS5tYXRjaCgvXlteXFxzXSsoXFxzKikvKSkpIHtcclxuICAgICAgbGluZSA9IGxpbmUgKyBtYXRjaFswXS5zdWJzdHIoMCwgbWF0Y2hbMF0ubGVuZ3RoIC0gKCFhZnRlclNwYWNlID8gKG1hdGNoWzFdIHx8ICcnKS5sZW5ndGggOiAwKSlcclxuICAgIH1cclxuXHJcbiAgICByZXN1bHQgKz0gbGluZVxyXG4gICAgcG9zICs9IGxpbmUubGVuZ3RoXHJcbiAgICBpZiAocG9zIDwgbGVuKSB7XHJcbiAgICAgIHJlc3VsdCArPSAnXFxyXFxuJ1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIHJlc3VsdFxyXG59XHJcblxyXG4vKipcclxuICogRW5jb2RlcyBhbmQgZm9sZHMgYSBoZWFkZXIgbGluZSBmb3IgYSBNSU1FIG1lc3NhZ2UgaGVhZGVyLlxyXG4gKiBTaG9ydGhhbmQgZm9yIG1pbWVXb3Jkc0VuY29kZSArIGZvbGRMaW5lc1xyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSBuYW1lLCB3aWxsIG5vdCBiZSBlbmNvZGVkXHJcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IHZhbHVlIFZhbHVlIHRvIGJlIGVuY29kZWRcclxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBDaGFyYWN0ZXIgc2V0IG9mIHRoZSB2YWx1ZVxyXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGVuY29kZWQgYW5kIGZvbGRlZCBoZWFkZXIgbGluZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVFbmNvZGUgKGtleSwgdmFsdWUsIGZyb21DaGFyc2V0KSB7XHJcbiAgdmFyIGVuY29kZWRWYWx1ZSA9IG1pbWVXb3Jkc0VuY29kZSh2YWx1ZSwgJ1EnLCBmcm9tQ2hhcnNldClcclxuICByZXR1cm4gZm9sZExpbmVzKGtleSArICc6ICcgKyBlbmNvZGVkVmFsdWUpXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBUaGUgcmVzdWx0IGlzIG5vdCBtaW1lIHdvcmQgZGVjb2RlZCwgeW91IG5lZWQgdG8gZG8geW91ciBvd24gZGVjb2RpbmcgYmFzZWRcclxuICogb24gdGhlIHJ1bGVzIGZvciB0aGUgc3BlY2lmaWMgaGVhZGVyIGtleVxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVyTGluZSBTaW5nbGUgaGVhZGVyIGxpbmUsIG1pZ2h0IGluY2x1ZGUgbGluZWJyZWFrcyBhcyB3ZWxsIGlmIGZvbGRlZFxyXG4gKiBAcmV0dXJuIHtPYmplY3R9IEFuZCBvYmplY3Qgb2Yge2tleSwgdmFsdWV9XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZURlY29kZSAoaGVhZGVyTGluZSA9ICcnKSB7XHJcbiAgY29uc3QgbGluZSA9IGhlYWRlckxpbmUudG9TdHJpbmcoKS5yZXBsYWNlKC8oPzpcXHI/XFxufFxccilbIFxcdF0qL2csICcgJykudHJpbSgpXHJcbiAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKihbXjpdKyk6KC4qKSQvKVxyXG5cclxuICByZXR1cm4ge1xyXG4gICAga2V5OiAoKG1hdGNoICYmIG1hdGNoWzFdKSB8fCAnJykudHJpbSgpLFxyXG4gICAgdmFsdWU6ICgobWF0Y2ggJiYgbWF0Y2hbMl0pIHx8ICcnKS50cmltKClcclxuICB9XHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQYXJzZXMgYSBibG9jayBvZiBoZWFkZXIgbGluZXMuIERvZXMgbm90IGRlY29kZSBtaW1lIHdvcmRzIGFzIGV2ZXJ5XHJcbiAqIGhlYWRlciBtaWdodCBoYXZlIGl0cyBvd24gcnVsZXMgKGVnLiBmb3JtYXR0ZWQgZW1haWwgYWRkcmVzc2VzIGFuZCBzdWNoKVxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVycyBIZWFkZXJzIHN0cmluZ1xyXG4gKiBAcmV0dXJuIHtPYmplY3R9IEFuIG9iamVjdCBvZiBoZWFkZXJzLCB3aGVyZSBoZWFkZXIga2V5cyBhcmUgb2JqZWN0IGtleXMuIE5CISBTZXZlcmFsIHZhbHVlcyB3aXRoIHRoZSBzYW1lIGtleSBtYWtlIHVwIGFuIEFycmF5XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZXNEZWNvZGUgKGhlYWRlcnMpIHtcclxuICBjb25zdCBsaW5lcyA9IGhlYWRlcnMuc3BsaXQoL1xccj9cXG58XFxyLylcclxuICBjb25zdCBoZWFkZXJzT2JqID0ge31cclxuXHJcbiAgZm9yIChsZXQgaSA9IGxpbmVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICBpZiAoaSAmJiBsaW5lc1tpXS5tYXRjaCgvXlxccy8pKSB7XHJcbiAgICAgIGxpbmVzW2kgLSAxXSArPSAnXFxyXFxuJyArIGxpbmVzW2ldXHJcbiAgICAgIGxpbmVzLnNwbGljZShpLCAxKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICBjb25zdCBoZWFkZXIgPSBoZWFkZXJMaW5lRGVjb2RlKGxpbmVzW2ldKVxyXG4gICAgY29uc3Qga2V5ID0gaGVhZGVyLmtleS50b0xvd2VyQ2FzZSgpXHJcbiAgICBjb25zdCB2YWx1ZSA9IGhlYWRlci52YWx1ZVxyXG5cclxuICAgIGlmICghaGVhZGVyc09ialtrZXldKSB7XHJcbiAgICAgIGhlYWRlcnNPYmpba2V5XSA9IHZhbHVlXHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBoZWFkZXJzT2JqW2tleV0gPSBbXS5jb25jYXQoaGVhZGVyc09ialtrZXldLCB2YWx1ZSlcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBoZWFkZXJzT2JqXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBQYXJzZXMgYSBoZWFkZXIgdmFsdWUgd2l0aCBrZXk9dmFsdWUgYXJndW1lbnRzIGludG8gYSBzdHJ1Y3R1cmVkXHJcbiAqIG9iamVjdC5cclxuICpcclxuICogICBwYXJzZUhlYWRlclZhbHVlKCdjb250ZW50LXR5cGU6IHRleHQvcGxhaW47IENIQVJTRVQ9J1VURi04JycpIC0+XHJcbiAqICAge1xyXG4gKiAgICAgJ3ZhbHVlJzogJ3RleHQvcGxhaW4nLFxyXG4gKiAgICAgJ3BhcmFtcyc6IHtcclxuICogICAgICAgJ2NoYXJzZXQnOiAnVVRGLTgnXHJcbiAqICAgICB9XHJcbiAqICAgfVxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEhlYWRlciB2YWx1ZVxyXG4gKiBAcmV0dXJuIHtPYmplY3R9IEhlYWRlciB2YWx1ZSBhcyBhIHBhcnNlZCBzdHJ1Y3R1cmVcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhlYWRlclZhbHVlIChzdHIpIHtcclxuICBsZXQgcmVzcG9uc2UgPSB7XHJcbiAgICB2YWx1ZTogZmFsc2UsXHJcbiAgICBwYXJhbXM6IHt9XHJcbiAgfVxyXG4gIGxldCBrZXkgPSBmYWxzZVxyXG4gIGxldCB2YWx1ZSA9ICcnXHJcbiAgbGV0IHR5cGUgPSAndmFsdWUnXHJcbiAgbGV0IHF1b3RlID0gZmFsc2VcclxuICBsZXQgZXNjYXBlZCA9IGZhbHNlXHJcbiAgbGV0IGNoclxyXG5cclxuICBmb3IgKGxldCBpID0gMCwgbGVuID0gc3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XHJcbiAgICBjaHIgPSBzdHIuY2hhckF0KGkpXHJcbiAgICBpZiAodHlwZSA9PT0gJ2tleScpIHtcclxuICAgICAgaWYgKGNociA9PT0gJz0nKSB7XHJcbiAgICAgICAga2V5ID0gdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKClcclxuICAgICAgICB0eXBlID0gJ3ZhbHVlJ1xyXG4gICAgICAgIHZhbHVlID0gJydcclxuICAgICAgICBjb250aW51ZVxyXG4gICAgICB9XHJcbiAgICAgIHZhbHVlICs9IGNoclxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKGVzY2FwZWQpIHtcclxuICAgICAgICB2YWx1ZSArPSBjaHJcclxuICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICdcXFxcJykge1xyXG4gICAgICAgIGVzY2FwZWQgPSB0cnVlXHJcbiAgICAgICAgY29udGludWVcclxuICAgICAgfSBlbHNlIGlmIChxdW90ZSAmJiBjaHIgPT09IHF1b3RlKSB7XHJcbiAgICAgICAgcXVvdGUgPSBmYWxzZVxyXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICdcIicpIHtcclxuICAgICAgICBxdW90ZSA9IGNoclxyXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICc7Jykge1xyXG4gICAgICAgIGlmIChrZXkgPT09IGZhbHNlKSB7XHJcbiAgICAgICAgICByZXNwb25zZS52YWx1ZSA9IHZhbHVlLnRyaW0oKVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlLnRyaW0oKVxyXG4gICAgICAgIH1cclxuICAgICAgICB0eXBlID0gJ2tleSdcclxuICAgICAgICB2YWx1ZSA9ICcnXHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdmFsdWUgKz0gY2hyXHJcbiAgICAgIH1cclxuICAgICAgZXNjYXBlZCA9IGZhbHNlXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAodHlwZSA9PT0gJ3ZhbHVlJykge1xyXG4gICAgaWYgKGtleSA9PT0gZmFsc2UpIHtcclxuICAgICAgcmVzcG9uc2UudmFsdWUgPSB2YWx1ZS50cmltKClcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gdmFsdWUudHJpbSgpXHJcbiAgICB9XHJcbiAgfSBlbHNlIGlmICh2YWx1ZS50cmltKCkpIHtcclxuICAgIHJlc3BvbnNlLnBhcmFtc1t2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKV0gPSAnJ1xyXG4gIH1cclxuXHJcbiAgLy8gaGFuZGxlIHBhcmFtZXRlciB2YWx1ZSBjb250aW51YXRpb25zXHJcbiAgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIyMzEjc2VjdGlvbi0zXHJcblxyXG4gIC8vIHByZXByb2Nlc3MgdmFsdWVzXHJcbiAgT2JqZWN0LmtleXMocmVzcG9uc2UucGFyYW1zKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcclxuICAgIHZhciBhY3R1YWxLZXksIG5yLCBtYXRjaCwgdmFsdWVcclxuICAgIGlmICgobWF0Y2ggPSBrZXkubWF0Y2goLyhcXCooXFxkKyl8XFwqKFxcZCspXFwqfFxcKikkLykpKSB7XHJcbiAgICAgIGFjdHVhbEtleSA9IGtleS5zdWJzdHIoMCwgbWF0Y2guaW5kZXgpXHJcbiAgICAgIG5yID0gTnVtYmVyKG1hdGNoWzJdIHx8IG1hdGNoWzNdKSB8fCAwXHJcblxyXG4gICAgICBpZiAoIXJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldIHx8IHR5cGVvZiByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSAhPT0gJ29iamVjdCcpIHtcclxuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSA9IHtcclxuICAgICAgICAgIGNoYXJzZXQ6IGZhbHNlLFxyXG4gICAgICAgICAgdmFsdWVzOiBbXVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XVxyXG5cclxuICAgICAgaWYgKG5yID09PSAwICYmIG1hdGNoWzBdLnN1YnN0cigtMSkgPT09ICcqJyAmJiAobWF0Y2ggPSB2YWx1ZS5tYXRjaCgvXihbXiddKiknW14nXSonKC4qKSQvKSkpIHtcclxuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS5jaGFyc2V0ID0gbWF0Y2hbMV0gfHwgJ2lzby04ODU5LTEnXHJcbiAgICAgICAgdmFsdWUgPSBtYXRjaFsyXVxyXG4gICAgICB9XHJcblxyXG4gICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS52YWx1ZXNbbnJdID0gdmFsdWVcclxuXHJcbiAgICAgIC8vIHJlbW92ZSB0aGUgb2xkIHJlZmVyZW5jZVxyXG4gICAgICBkZWxldGUgcmVzcG9uc2UucGFyYW1zW2tleV1cclxuICAgIH1cclxuICB9KVxyXG5cclxuICAvLyBjb25jYXRlbmF0ZSBzcGxpdCByZmMyMjMxIHN0cmluZ3MgYW5kIGNvbnZlcnQgZW5jb2RlZCBzdHJpbmdzIHRvIG1pbWUgZW5jb2RlZCB3b3Jkc1xyXG4gIE9iamVjdC5rZXlzKHJlc3BvbnNlLnBhcmFtcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICB2YXIgdmFsdWVcclxuICAgIGlmIChyZXNwb25zZS5wYXJhbXNba2V5XSAmJiBBcnJheS5pc0FycmF5KHJlc3BvbnNlLnBhcmFtc1trZXldLnZhbHVlcykpIHtcclxuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XS52YWx1ZXMubWFwKGZ1bmN0aW9uICh2YWwpIHtcclxuICAgICAgICByZXR1cm4gdmFsIHx8ICcnXHJcbiAgICAgIH0pLmpvaW4oJycpXHJcblxyXG4gICAgICBpZiAocmVzcG9uc2UucGFyYW1zW2tleV0uY2hhcnNldCkge1xyXG4gICAgICAgIC8vIGNvbnZlcnQgXCIlQUJcIiB0byBcIj0/Y2hhcnNldD9RPz1BQj89XCJcclxuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9ICc9PycgKyByZXNwb25zZS5wYXJhbXNba2V5XS5jaGFyc2V0ICsgJz9RPycgKyB2YWx1ZVxyXG4gICAgICAgICAgLnJlcGxhY2UoL1s9P19cXHNdL2csIGZ1bmN0aW9uIChzKSB7XHJcbiAgICAgICAgICAgIC8vIGZpeCBpbnZhbGlkbHkgZW5jb2RlZCBjaGFyc1xyXG4gICAgICAgICAgICB2YXIgYyA9IHMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNilcclxuICAgICAgICAgICAgcmV0dXJuIHMgPT09ICcgJyA/ICdfJyA6ICclJyArIChjLmxlbmd0aCA8IDIgPyAnMCcgOiAnJykgKyBjXHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLnJlcGxhY2UoLyUvZywgJz0nKSArICc/PScgLy8gY2hhbmdlIGZyb20gdXJsZW5jb2RpbmcgdG8gcGVyY2VudCBlbmNvZGluZ1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gdmFsdWVcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH0pXHJcblxyXG4gIHJldHVybiByZXNwb25zZVxyXG59XHJcblxyXG4vKipcclxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IHRvIGFuIFVURi04IFBhcmFtZXRlciBWYWx1ZSBDb250aW51YXRpb24gZW5jb2RpbmcgKHJmYzIyMzEpXHJcbiAqIFVzZWZ1bCBmb3Igc3BsaXR0aW5nIGxvbmcgcGFyYW1ldGVyIHZhbHVlcy5cclxuICpcclxuICogRm9yIGV4YW1wbGVcclxuICogICAgICB0aXRsZT1cInVuaWNvZGUgc3RyaW5nXCJcclxuICogYmVjb21lc1xyXG4gKiAgICAgdGl0bGUqMCo9XCJ1dGYtOCcndW5pY29kZVwiXHJcbiAqICAgICB0aXRsZSoxKj1cIiUyMHN0cmluZ1wiXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcclxuICogQHBhcmFtIHtOdW1iZXJ9IFttYXhMZW5ndGg9NTBdIE1heCBsZW5ndGggZm9yIGdlbmVyYXRlZCBjaHVua3NcclxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxyXG4gKiBAcmV0dXJuIHtBcnJheX0gQSBsaXN0IG9mIGVuY29kZWQga2V5cyBhbmQgaGVhZGVyc1xyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNvbnRpbnVhdGlvbkVuY29kZSAoa2V5LCBkYXRhLCBtYXhMZW5ndGgsIGZyb21DaGFyc2V0KSB7XHJcbiAgY29uc3QgbGlzdCA9IFtdXHJcbiAgdmFyIGVuY29kZWRTdHIgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxyXG4gIHZhciBsaW5lXHJcblxyXG4gIG1heExlbmd0aCA9IG1heExlbmd0aCB8fCA1MFxyXG5cclxuICAvLyBwcm9jZXNzIGFzY2lpIG9ubHkgdGV4dFxyXG4gIGlmICgvXltcXHcuXFwtIF0qJC8udGVzdChkYXRhKSkge1xyXG4gICAgLy8gY2hlY2sgaWYgY29udmVyc2lvbiBpcyBldmVuIG5lZWRlZFxyXG4gICAgaWYgKGVuY29kZWRTdHIubGVuZ3RoIDw9IG1heExlbmd0aCkge1xyXG4gICAgICByZXR1cm4gW3tcclxuICAgICAgICBrZXk6IGtleSxcclxuICAgICAgICB2YWx1ZTogL1tcXHNcIjs9XS8udGVzdChlbmNvZGVkU3RyKSA/ICdcIicgKyBlbmNvZGVkU3RyICsgJ1wiJyA6IGVuY29kZWRTdHJcclxuICAgICAgfV1cclxuICAgIH1cclxuXHJcbiAgICBlbmNvZGVkU3RyID0gZW5jb2RlZFN0ci5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIG1heExlbmd0aCArICd9JywgJ2cnKSwgZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICBsaXN0LnB1c2goe1xyXG4gICAgICAgIGxpbmU6IHN0clxyXG4gICAgICB9KVxyXG4gICAgICByZXR1cm4gJydcclxuICAgIH0pXHJcblxyXG4gICAgaWYgKGVuY29kZWRTdHIpIHtcclxuICAgICAgbGlzdC5wdXNoKHtcclxuICAgICAgICBsaW5lOiBlbmNvZGVkU3RyXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfSBlbHNlIHtcclxuICAgIC8vIHByb2Nlc3MgdGV4dCB3aXRoIHVuaWNvZGUgb3Igc3BlY2lhbCBjaGFyc1xyXG4gICAgY29uc3QgdXJpRW5jb2RlZCA9IGVuY29kZVVSSUNvbXBvbmVudCgndXRmLThcXCdcXCcnICsgZW5jb2RlZFN0cilcclxuICAgIGxldCBpID0gMFxyXG4gICAgd2hpbGUgKHRydWUpIHtcclxuICAgICAgbGV0IGxlbiA9IG1heExlbmd0aFxyXG4gICAgICAvLyBtdXN0IG5vdCBzcGxpdCBoZXggZW5jb2RlZCBieXRlIGJldHdlZW4gbGluZXNcclxuICAgICAgaWYgKHVyaUVuY29kZWRbaSArIG1heExlbmd0aCAtIDFdID09PSAnJScpIHtcclxuICAgICAgICBsZW4gLT0gMVxyXG4gICAgICB9IGVsc2UgaWYgKHVyaUVuY29kZWRbaSArIG1heExlbmd0aCAtIDJdID09PSAnJScpIHtcclxuICAgICAgICBsZW4gLT0gMlxyXG4gICAgICB9XHJcbiAgICAgIGxpbmUgPSB1cmlFbmNvZGVkLnN1YnN0cihpLCBsZW4pXHJcbiAgICAgIGlmICghbGluZSkge1xyXG4gICAgICAgIGJyZWFrXHJcbiAgICAgIH1cclxuICAgICAgbGlzdC5wdXNoKHtcclxuICAgICAgICBsaW5lOiBsaW5lLFxyXG4gICAgICAgIGVuY29kZWQ6IHRydWVcclxuICAgICAgfSlcclxuICAgICAgaSArPSBsaW5lLmxlbmd0aFxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGxpc3QubWFwKGZ1bmN0aW9uIChpdGVtLCBpKSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICAvLyBlbmNvZGVkIGxpbmVzOiB7bmFtZX0qe3BhcnR9KlxyXG4gICAgICAvLyB1bmVuY29kZWQgbGluZXM6IHtuYW1lfSp7cGFydH1cclxuICAgICAgLy8gaWYgYW55IGxpbmUgbmVlZHMgdG8gYmUgZW5jb2RlZCB0aGVuIHRoZSBmaXJzdCBsaW5lIChwYXJ0PT0wKSBpcyBhbHdheXMgZW5jb2RlZFxyXG4gICAgICBrZXk6IGtleSArICcqJyArIGkgKyAoaXRlbS5lbmNvZGVkID8gJyonIDogJycpLFxyXG4gICAgICB2YWx1ZTogL1tcXHNcIjs9XS8udGVzdChpdGVtLmxpbmUpID8gJ1wiJyArIGl0ZW0ubGluZSArICdcIicgOiBpdGVtLmxpbmVcclxuICAgIH1cclxuICB9KVxyXG59XHJcblxyXG4vKipcclxuICogU3BsaXRzIGEgbWltZSBlbmNvZGVkIHN0cmluZy4gTmVlZGVkIGZvciBkaXZpZGluZyBtaW1lIHdvcmRzIGludG8gc21hbGxlciBjaHVua3NcclxuICpcclxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nIHRvIGJlIHNwbGl0IHVwXHJcbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhsZW4gTWF4aW11bSBsZW5ndGggb2YgY2hhcmFjdGVycyBmb3Igb25lIHBhcnQgKG1pbmltdW0gMTIpXHJcbiAqIEByZXR1cm4ge0FycmF5fSBTcGxpdCBzdHJpbmdcclxuICovXHJcbmZ1bmN0aW9uIF9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nIChzdHIsIG1heGxlbiA9IDEyKSB7XHJcbiAgY29uc3QgbWluV29yZExlbmd0aCA9IDEyIC8vIHJlcXVpcmUgYXQgbGVhc3QgMTIgc3ltYm9scyB0byBmaXQgcG9zc2libGUgNCBvY3RldCBVVEYtOCBzZXF1ZW5jZXNcclxuICBjb25zdCBtYXhXb3JkTGVuZ3RoID0gTWF0aC5tYXgobWF4bGVuLCBtaW5Xb3JkTGVuZ3RoKVxyXG4gIGNvbnN0IGxpbmVzID0gW11cclxuXHJcbiAgd2hpbGUgKHN0ci5sZW5ndGgpIHtcclxuICAgIGxldCBjdXJMaW5lID0gc3RyLnN1YnN0cigwLCBtYXhXb3JkTGVuZ3RoKVxyXG5cclxuICAgIGNvbnN0IG1hdGNoID0gY3VyTGluZS5tYXRjaCgvPVswLTlBLUZdPyQvaSkgLy8gc2tpcCBpbmNvbXBsZXRlIGVzY2FwZWQgY2hhclxyXG4gICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgIGN1ckxpbmUgPSBjdXJMaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleClcclxuICAgIH1cclxuXHJcbiAgICBsZXQgZG9uZSA9IGZhbHNlXHJcbiAgICB3aGlsZSAoIWRvbmUpIHtcclxuICAgICAgbGV0IGNoclxyXG4gICAgICBkb25lID0gdHJ1ZVxyXG4gICAgICBjb25zdCBtYXRjaCA9IHN0ci5zdWJzdHIoY3VyTGluZS5sZW5ndGgpLm1hdGNoKC9ePShbMC05QS1GXXsyfSkvaSkgLy8gY2hlY2sgaWYgbm90IG1pZGRsZSBvZiBhIHVuaWNvZGUgY2hhciBzZXF1ZW5jZVxyXG4gICAgICBpZiAobWF0Y2gpIHtcclxuICAgICAgICBjaHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTYpXHJcbiAgICAgICAgLy8gaW52YWxpZCBzZXF1ZW5jZSwgbW92ZSBvbmUgY2hhciBiYWNrIGFuYyByZWNoZWNrXHJcbiAgICAgICAgaWYgKGNociA8IDB4QzIgJiYgY2hyID4gMHg3Rikge1xyXG4gICAgICAgICAgY3VyTGluZSA9IGN1ckxpbmUuc3Vic3RyKDAsIGN1ckxpbmUubGVuZ3RoIC0gMylcclxuICAgICAgICAgIGRvbmUgPSBmYWxzZVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChjdXJMaW5lLmxlbmd0aCkge1xyXG4gICAgICBsaW5lcy5wdXNoKGN1ckxpbmUpXHJcbiAgICB9XHJcbiAgICBzdHIgPSBzdHIuc3Vic3RyKGN1ckxpbmUubGVuZ3RoKVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGxpbmVzXHJcbn1cclxuXHJcbmZ1bmN0aW9uIF9hZGRCYXNlNjRTb2Z0TGluZWJyZWFrcyAoYmFzZTY0RW5jb2RlZFN0ciA9ICcnKSB7XHJcbiAgcmV0dXJuIGJhc2U2NEVuY29kZWRTdHIudHJpbSgpLnJlcGxhY2UobmV3IFJlZ0V4cCgnLnsnICsgTUFYX0xJTkVfTEVOR1RIICsgJ30nLCAnZycpLCAnJCZcXHJcXG4nKS50cmltKClcclxufVxyXG5cclxuLyoqXHJcbiAqIEFkZHMgc29mdCBsaW5lIGJyZWFrcyh0aGUgb25lcyB0aGF0IHdpbGwgYmUgc3RyaXBwZWQgb3V0IHdoZW4gZGVjb2RpbmcgUVApXHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBxcEVuY29kZWRTdHIgU3RyaW5nIGluIFF1b3RlZC1QcmludGFibGUgZW5jb2RpbmdcclxuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBmb3JjZWQgbGluZSBicmVha3NcclxuICovXHJcbmZ1bmN0aW9uIF9hZGRRUFNvZnRMaW5lYnJlYWtzIChxcEVuY29kZWRTdHIgPSAnJykge1xyXG4gIGxldCBwb3MgPSAwXHJcbiAgY29uc3QgbGVuID0gcXBFbmNvZGVkU3RyLmxlbmd0aFxyXG4gIGNvbnN0IGxpbmVNYXJnaW4gPSBNYXRoLmZsb29yKE1BWF9MSU5FX0xFTkdUSCAvIDMpXHJcbiAgbGV0IHJlc3VsdCA9ICcnXHJcbiAgbGV0IG1hdGNoLCBsaW5lXHJcblxyXG4gIC8vIGluc2VydCBzb2Z0IGxpbmVicmVha3Mgd2hlcmUgbmVlZGVkXHJcbiAgd2hpbGUgKHBvcyA8IGxlbikge1xyXG4gICAgbGluZSA9IHFwRW5jb2RlZFN0ci5zdWJzdHIocG9zLCBNQVhfTElORV9MRU5HVEgpXHJcbiAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvXFxyXFxuLykpKSB7XHJcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aClcclxuICAgICAgcmVzdWx0ICs9IGxpbmVcclxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXHJcbiAgICAgIGNvbnRpbnVlXHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGxpbmUuc3Vic3RyKC0xKSA9PT0gJ1xcbicpIHtcclxuICAgICAgLy8gbm90aGluZyB0byBjaGFuZ2UgaGVyZVxyXG4gICAgICByZXN1bHQgKz0gbGluZVxyXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcclxuICAgICAgY29udGludWVcclxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gbGluZS5zdWJzdHIoLWxpbmVNYXJnaW4pLm1hdGNoKC9cXG4uKj8kLykpKSB7XHJcbiAgICAgIC8vIHRydW5jYXRlIHRvIG5lYXJlc3QgbGluZSBicmVha1xyXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gMSkpXHJcbiAgICAgIHJlc3VsdCArPSBsaW5lXHJcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxyXG4gICAgICBjb250aW51ZVxyXG4gICAgfSBlbHNlIGlmIChsaW5lLmxlbmd0aCA+IE1BWF9MSU5FX0xFTkdUSCAtIGxpbmVNYXJnaW4gJiYgKG1hdGNoID0gbGluZS5zdWJzdHIoLWxpbmVNYXJnaW4pLm1hdGNoKC9bIFxcdC4sIT9dW14gXFx0LiwhP10qJC8pKSkge1xyXG4gICAgICAvLyB0cnVuY2F0ZSB0byBuZWFyZXN0IHNwYWNlXHJcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAxKSlcclxuICAgIH0gZWxzZSBpZiAobGluZS5zdWJzdHIoLTEpID09PSAnXFxyJykge1xyXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKGxpbmUubWF0Y2goLz1bXFxkYS1mXXswLDJ9JC9pKSkge1xyXG4gICAgICAgIC8vIHB1c2ggaW5jb21wbGV0ZSBlbmNvZGluZyBzZXF1ZW5jZXMgdG8gdGhlIG5leHQgbGluZVxyXG4gICAgICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC89W1xcZGEtZl17MCwxfSQvaSkpKSB7XHJcbiAgICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSBtYXRjaFswXS5sZW5ndGgpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBlbnN1cmUgdGhhdCB1dGYtOCBzZXF1ZW5jZXMgYXJlIG5vdCBzcGxpdFxyXG4gICAgICAgIHdoaWxlIChsaW5lLmxlbmd0aCA+IDMgJiYgbGluZS5sZW5ndGggPCBsZW4gLSBwb3MgJiYgIWxpbmUubWF0Y2goL14oPzo9W1xcZGEtZl17Mn0pezEsNH0kL2kpICYmIChtYXRjaCA9IGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvaWcpKSkge1xyXG4gICAgICAgICAgY29uc3QgY29kZSA9IHBhcnNlSW50KG1hdGNoWzBdLnN1YnN0cigxLCAyKSwgMTYpXHJcbiAgICAgICAgICBpZiAoY29kZSA8IDEyOCkge1xyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDMpXHJcblxyXG4gICAgICAgICAgaWYgKGNvZGUgPj0gMHhDMCkge1xyXG4gICAgICAgICAgICBicmVha1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGlmIChwb3MgKyBsaW5lLmxlbmd0aCA8IGxlbiAmJiBsaW5lLnN1YnN0cigtMSkgIT09ICdcXG4nKSB7XHJcbiAgICAgIGlmIChsaW5lLmxlbmd0aCA9PT0gTUFYX0xJTkVfTEVOR1RIICYmIGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvaSkpIHtcclxuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAzKVxyXG4gICAgICB9IGVsc2UgaWYgKGxpbmUubGVuZ3RoID09PSBNQVhfTElORV9MRU5HVEgpIHtcclxuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxyXG4gICAgICB9XHJcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxyXG4gICAgICBsaW5lICs9ICc9XFxyXFxuJ1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXHJcbiAgICB9XHJcblxyXG4gICAgcmVzdWx0ICs9IGxpbmVcclxuICB9XHJcblxyXG4gIHJldHVybiByZXN1bHRcclxufVxyXG5cclxuZXhwb3J0IHsgZGVjb2RlLCBlbmNvZGUsIGNvbnZlcnQgfVxyXG4iXX0=