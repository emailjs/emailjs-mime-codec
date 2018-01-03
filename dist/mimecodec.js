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

var _utils = require('./utils');

// Lines can't be longer than 76 + <CR><LF> = 78 bytes
// http://tools.ietf.org/html/rfc2045#section-6.7
var MAX_LINE_LENGTH = 76;
var MAX_MIME_WORD_LENGTH = 52;

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
  return (0, _charset.decode)((0, _emailjsBase.decode)(str, _emailjsBase.OUTPUT_TYPED_ARRAY), fromCharset);
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

  var parts = void 0;

  if (mimeWordEncoding === 'Q') {
    var str = typeof data === 'string' ? data : (0, _charset.decode)(data, fromCharset);
    var encodedStr = (0, _ramda.pipe)(mimeEncode, qEncodeForbiddenHeaderChars)(str);
    parts = encodedStr.length < MAX_MIME_WORD_LENGTH ? [encodedStr] : _splitMimeEncodedString(encodedStr, MAX_MIME_WORD_LENGTH);
  } else {
    var buf = (0, _charset.convert)(data, fromCharset);
    parts = (0, _utils.splitTypedArrayEvery)(MAX_MIME_WORD_LENGTH, buf).map(_emailjsBase.encode);
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

  var regex = /([^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*(?:\s+[^\s\u0080-\uFFFF]*[\u0080-\uFFFF]+[^\s\u0080-\uFFFF]*\s*)?)+/g;
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

  var match = str.match(/^=\?([\w_\-*]+)\?([QqBb])\?([^?]+)\?=$/i);
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
  str = str.replace(/\?==\?[uU][tT][fF]-8\?[QqBb]\?/g, ''); // join bytes of multi-byte UTF-8
  str = str.replace(/=\?[\w_\-*]+\?[QqBb]\?[^?]+\?=/g, function (mimeWord) {
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
  var startPos = 0;
  var isEncoded = false;

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
    // first line includes the charset and language info and needs to be encoded
    // even if it does not contain any unicode characters
    line = 'utf-8\'\'';
    isEncoded = true;
    startPos = 0;
    // process text with unicode or special chars
    for (var i = 0, len = encodedStr.length; i < len; i++) {
      var chr = encodedStr[i];

      if (isEncoded) {
        chr = encodeURIComponent(chr);
      } else {
        // try to urlencode current char
        chr = chr === ' ' ? chr : encodeURIComponent(chr);
        // By default it is not required to encode a line, the need
        // only appears when the string contains unicode or special chars
        // in this case we start processing the line over and encode all chars
        if (chr !== encodedStr[i]) {
          // Check if it is even possible to add the encoded char to the line
          // If not, there is no reason to use this line, just push it to the list
          // and start a new line with the char that needs encoding
          if ((encodeURIComponent(line) + chr).length >= maxLength) {
            list.push({
              line: line,
              encoded: isEncoded
            });
            line = '';
            startPos = i - 1;
          } else {
            isEncoded = true;
            i = startPos;
            line = '';
            continue;
          }
        }
      }

      // if the line is already too long, push it to the list and start a new one
      if ((line + chr).length >= maxLength) {
        list.push({
          line: line,
          encoded: isEncoded
        });
        line = chr = encodedStr[i] === ' ' ? ' ' : encodeURIComponent(encodedStr[i]);
        if (chr === encodedStr[i]) {
          isEncoded = false;
          startPos = i - 1;
        } else {
          isEncoded = true;
        }
      } else {
        line += chr;
      }
    }

    if (line) {
      list.push({
        line: line,
        encoded: isEncoded
      });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMuanMiXSwibmFtZXMiOlsibWltZUVuY29kZSIsIm1pbWVEZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJiYXNlNjREZWNvZGUiLCJxdW90ZWRQcmludGFibGVFbmNvZGUiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsIm1pbWVXb3JkRGVjb2RlIiwibWltZVdvcmRzRGVjb2RlIiwiZm9sZExpbmVzIiwiaGVhZGVyTGluZUVuY29kZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lc0RlY29kZSIsInBhcnNlSGVhZGVyVmFsdWUiLCJjb250aW51YXRpb25FbmNvZGUiLCJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsImRhdGEiLCJmcm9tQ2hhcnNldCIsImJ1ZmZlciIsInJlZHVjZSIsImFnZ3JlZ2F0ZSIsIm9yZCIsImluZGV4IiwiX2NoZWNrUmFuZ2VzIiwibGVuZ3RoIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidG9TdHJpbmciLCJ0b1VwcGVyQ2FzZSIsIm5yIiwicmFuZ2VzIiwidmFsIiwicmFuZ2UiLCJzdHIiLCJlbmNvZGVkQnl0ZXNDb3VudCIsIm1hdGNoIiwiVWludDhBcnJheSIsImkiLCJsZW4iLCJidWZmZXJQb3MiLCJoZXgiLCJzdWJzdHIiLCJjaHIiLCJjaGFyQXQiLCJ0ZXN0IiwicGFyc2VJbnQiLCJjaGFyQ29kZUF0IiwiYnVmIiwiYjY0IiwiX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzIiwibWltZUVuY29kZWRTdHIiLCJyZXBsYWNlIiwic3BhY2VzIiwiX2FkZFFQU29mdExpbmVicmVha3MiLCJyYXdTdHJpbmciLCJtaW1lV29yZEVuY29kaW5nIiwicGFydHMiLCJlbmNvZGVkU3RyIiwicUVuY29kZUZvcmJpZGRlbkhlYWRlckNoYXJzIiwiX3NwbGl0TWltZUVuY29kZWRTdHJpbmciLCJtYXAiLCJwcmVmaXgiLCJzdWZmaXgiLCJwIiwiam9pbiIsInRyaW0iLCJxRW5jb2RlIiwicmVnZXgiLCJzcGxpdCIsInNoaWZ0IiwiZW5jb2RpbmciLCJtaW1lV29yZCIsImFmdGVyU3BhY2UiLCJwb3MiLCJyZXN1bHQiLCJsaW5lIiwia2V5IiwidmFsdWUiLCJlbmNvZGVkVmFsdWUiLCJoZWFkZXJMaW5lIiwiaGVhZGVycyIsImxpbmVzIiwiaGVhZGVyc09iaiIsInNwbGljZSIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiY29uY2F0IiwicmVzcG9uc2UiLCJwYXJhbXMiLCJ0eXBlIiwicXVvdGUiLCJlc2NhcGVkIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJhY3R1YWxLZXkiLCJOdW1iZXIiLCJjaGFyc2V0IiwidmFsdWVzIiwiQXJyYXkiLCJpc0FycmF5IiwicyIsImMiLCJtYXhMZW5ndGgiLCJsaXN0Iiwic3RhcnRQb3MiLCJpc0VuY29kZWQiLCJSZWdFeHAiLCJwdXNoIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZW5jb2RlZCIsIml0ZW0iLCJtYXhsZW4iLCJtaW5Xb3JkTGVuZ3RoIiwibWF4V29yZExlbmd0aCIsIk1hdGgiLCJtYXgiLCJjdXJMaW5lIiwiZG9uZSIsImJhc2U2NEVuY29kZWRTdHIiLCJxcEVuY29kZWRTdHIiLCJsaW5lTWFyZ2luIiwiZmxvb3IiLCJjb2RlIiwiZGVjb2RlIiwiZW5jb2RlIiwiY29udmVydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O1FBbUJnQkEsVSxHQUFBQSxVO1FBMEJBQyxVLEdBQUFBLFU7UUEwQkFDLFksR0FBQUEsWTtRQWFBQyxZLEdBQUFBLFk7UUFhQUMscUIsR0FBQUEscUI7UUFnQkFDLHFCLEdBQUFBLHFCO1FBaUJBQyxjLEdBQUFBLGM7UUFrQ0FDLGUsR0FBQUEsZTtRQVdBQyxjLEdBQUFBLGM7UUEwQkFDLGUsR0FBQUEsZTtRQWdCQUMsUyxHQUFBQSxTO1FBMENBQyxnQixHQUFBQSxnQjtRQVlBQyxnQixHQUFBQSxnQjtRQWlCQUMsaUIsR0FBQUEsaUI7UUF5Q0FDLGdC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QWhCLEVBQW1CLENBQW5CLENBQVQsRUFBZ0MsRUFBaEMsQ0FBYjtBQUNBLGNBQUlrRixPQUFPLEdBQVgsRUFBZ0I7QUFDZDtBQUNEOztBQUVEaEQsaUJBQU9BLEtBQUtsQyxNQUFMLENBQVksQ0FBWixFQUFla0MsS0FBS25ELE1BQUwsR0FBYyxDQUE3QixDQUFQOztBQUVBLGNBQUltRyxRQUFRLElBQVosRUFBa0I7QUFDaEI7QUFDRDtBQUNGO0FBQ0Y7QUFDRjs7QUFFRCxRQUFJbEQsTUFBTUUsS0FBS25ELE1BQVgsR0FBb0JjLEdBQXBCLElBQTJCcUMsS0FBS2xDLE1BQUwsQ0FBWSxDQUFDLENBQWIsTUFBb0IsSUFBbkQsRUFBeUQ7QUFDdkQsVUFBSWtDLEtBQUtuRCxNQUFMLEtBQWdCVixlQUFoQixJQUFtQzZELEtBQUt4QyxLQUFMLENBQVcsZUFBWCxDQUF2QyxFQUFvRTtBQUNsRXdDLGVBQU9BLEtBQUtsQyxNQUFMLENBQVksQ0FBWixFQUFla0MsS0FBS25ELE1BQUwsR0FBYyxDQUE3QixDQUFQO0FBQ0QsT0FGRCxNQUVPLElBQUltRCxLQUFLbkQsTUFBTCxLQUFnQlYsZUFBcEIsRUFBcUM7QUFDMUM2RCxlQUFPQSxLQUFLbEMsTUFBTCxDQUFZLENBQVosRUFBZWtDLEtBQUtuRCxNQUFMLEdBQWMsQ0FBN0IsQ0FBUDtBQUNEO0FBQ0RpRCxhQUFPRSxLQUFLbkQsTUFBWjtBQUNBbUQsY0FBUSxPQUFSO0FBQ0QsS0FSRCxNQVFPO0FBQ0xGLGFBQU9FLEtBQUtuRCxNQUFaO0FBQ0Q7O0FBRURrRCxjQUFVQyxJQUFWO0FBQ0Q7O0FBRUQsU0FBT0QsTUFBUDtBQUNEOztRQUVRa0QsTTtRQUFRQyxNO1FBQVFDLE8iLCJmaWxlIjoibWltZWNvZGVjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZW5jb2RlIGFzIGVuY29kZUJhc2U2NCwgZGVjb2RlIGFzIGRlY29kZUJhc2U2NCwgT1VUUFVUX1RZUEVEX0FSUkFZIH0gZnJvbSAnZW1haWxqcy1iYXNlNjQnXG5pbXBvcnQgeyBlbmNvZGUsIGRlY29kZSwgY29udmVydCB9IGZyb20gJy4vY2hhcnNldCdcbmltcG9ydCB7IHBpcGUgfSBmcm9tICdyYW1kYSdcbmltcG9ydCB7IHNwbGl0VHlwZWRBcnJheUV2ZXJ5IH0gZnJvbSAnLi91dGlscydcblxuLy8gTGluZXMgY2FuJ3QgYmUgbG9uZ2VyIHRoYW4gNzYgKyA8Q1I+PExGPiA9IDc4IGJ5dGVzXG4vLyBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ1I3NlY3Rpb24tNi43XG5jb25zdCBNQVhfTElORV9MRU5HVEggPSA3NlxuY29uc3QgTUFYX01JTUVfV09SRF9MRU5HVEggPSA1MlxuXG4vKipcbiAqIEVuY29kZXMgYWxsIG5vbiBwcmludGFibGUgYW5kIG5vbiBhc2NpaSBieXRlcyB0byA9WFggZm9ybSwgd2hlcmUgWFggaXMgdGhlXG4gKiBieXRlIHZhbHVlIGluIGhleC4gVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBjb252ZXJ0IGxpbmVicmVha3MgZXRjLiBpdFxuICogb25seSBlc2NhcGVzIGNoYXJhY3RlciBzZXF1ZW5jZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIEVpdGhlciBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5XG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lRW5jb2RlIChkYXRhID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBidWZmZXIgPSBjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KVxuICByZXR1cm4gYnVmZmVyLnJlZHVjZSgoYWdncmVnYXRlLCBvcmQsIGluZGV4KSA9PlxuICAgIF9jaGVja1JhbmdlcyhvcmQpICYmICEoKG9yZCA9PT0gMHgyMCB8fCBvcmQgPT09IDB4MDkpICYmIChpbmRleCA9PT0gYnVmZmVyLmxlbmd0aCAtIDEgfHwgYnVmZmVyW2luZGV4ICsgMV0gPT09IDB4MGEgfHwgYnVmZmVyW2luZGV4ICsgMV0gPT09IDB4MGQpKVxuICAgICAgPyBhZ2dyZWdhdGUgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKG9yZCkgLy8gaWYgdGhlIGNoYXIgaXMgaW4gYWxsb3dlZCByYW5nZSwgdGhlbiBrZWVwIGFzIGlzLCB1bmxlc3MgaXQgaXMgYSB3cyBpbiB0aGUgZW5kIG9mIGEgbGluZVxuICAgICAgOiBhZ2dyZWdhdGUgKyAnPScgKyAob3JkIDwgMHgxMCA/ICcwJyA6ICcnKSArIG9yZC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSwgJycpXG5cbiAgZnVuY3Rpb24gX2NoZWNrUmFuZ2VzIChucikge1xuICAgIGNvbnN0IHJhbmdlcyA9IFsgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDUjc2VjdGlvbi02LjdcbiAgICAgIFsweDA5XSwgLy8gPFRBQj5cbiAgICAgIFsweDBBXSwgLy8gPExGPlxuICAgICAgWzB4MERdLCAvLyA8Q1I+XG4gICAgICBbMHgyMCwgMHgzQ10sIC8vIDxTUD4hXCIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7XG4gICAgICBbMHgzRSwgMHg3RV0gLy8gPj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXFxdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1cbiAgICBdXG4gICAgcmV0dXJuIHJhbmdlcy5yZWR1Y2UoKHZhbCwgcmFuZ2UpID0+IHZhbCB8fCAocmFuZ2UubGVuZ3RoID09PSAxICYmIG5yID09PSByYW5nZVswXSkgfHwgKHJhbmdlLmxlbmd0aCA9PT0gMiAmJiBuciA+PSByYW5nZVswXSAmJiBuciA8PSByYW5nZVsxXSksIGZhbHNlKVxuICB9XG59XG5cbi8qKlxuICogRGVjb2RlcyBtaW1lIGVuY29kZWQgc3RyaW5nIHRvIGFuIHVuaWNvZGUgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lRGVjb2RlIChzdHIgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IGVuY29kZWRCeXRlc0NvdW50ID0gKHN0ci5tYXRjaCgvPVtcXGRhLWZBLUZdezJ9L2cpIHx8IFtdKS5sZW5ndGhcbiAgbGV0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KHN0ci5sZW5ndGggLSBlbmNvZGVkQnl0ZXNDb3VudCAqIDIpXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGgsIGJ1ZmZlclBvcyA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGxldCBoZXggPSBzdHIuc3Vic3RyKGkgKyAxLCAyKVxuICAgIGNvbnN0IGNociA9IHN0ci5jaGFyQXQoaSlcbiAgICBpZiAoY2hyID09PSAnPScgJiYgaGV4ICYmIC9bXFxkYS1mQS1GXXsyfS8udGVzdChoZXgpKSB7XG4gICAgICBidWZmZXJbYnVmZmVyUG9zKytdID0gcGFyc2VJbnQoaGV4LCAxNilcbiAgICAgIGkgKz0gMlxuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXJbYnVmZmVyUG9zKytdID0gY2hyLmNoYXJDb2RlQXQoMClcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVjb2RlKGJ1ZmZlciwgZnJvbUNoYXJzZXQpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiB0eXBlZCBhcnJheSBvZiBnaXZlbiBjaGFyc2V0IGludG8gdW5pY29kZVxuICogYmFzZTY0IHN0cmluZy4gQWxzbyBhZGRzIGxpbmUgYnJlYWtzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgb3IgdHlwZWQgYXJyYXkgdG8gYmUgYmFzZTY0IGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBJbml0aWFsIGNoYXJzZXQsIGUuZy4gJ2JpbmFyeScuIERlZmF1bHRzIHRvICdVVEYtOCdcbiAqIEByZXR1cm4ge1N0cmluZ30gQmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjRFbmNvZGUgKGRhdGEsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBidWYgPSAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnICYmIGZyb21DaGFyc2V0ID09PSAnYmluYXJ5JykgPyBkYXRhIDogY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcbiAgY29uc3QgYjY0ID0gZW5jb2RlQmFzZTY0KGJ1ZilcbiAgcmV0dXJuIF9hZGRCYXNlNjRTb2Z0TGluZWJyZWFrcyhiNjQpXG59XG5cbi8qKlxuICogRGVjb2RlcyBhIGJhc2U2NCBzdHJpbmcgb2YgYW55IGNoYXJzZXQgaW50byBhbiB1bmljb2RlIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIGJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjREZWNvZGUgKHN0ciwgZnJvbUNoYXJzZXQpIHtcbiAgcmV0dXJuIGRlY29kZShkZWNvZGVCYXNlNjQoc3RyLCBPVVRQVVRfVFlQRURfQVJSQVkpLCBmcm9tQ2hhcnNldClcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgaW50byBhIHF1b3RlZCBwcmludGFibGUgZW5jb2RpbmdcbiAqIFRoaXMgaXMgYWxtb3N0IHRoZSBzYW1lIGFzIG1pbWVFbmNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWRcbiAqIGFzIHdlbGwgdG8gZW5zdXJlIHRoYXQgdGhlIGxpbmVzIGFyZSBuZXZlciBsb25nZXIgdGhhbiBhbGxvd2VkIGxlbmd0aFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gbWltZSBlbmNvZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlZFByaW50YWJsZUVuY29kZSAoZGF0YSA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgbWltZUVuY29kZWRTdHIgPSBtaW1lRW5jb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIC5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnXFxyXFxuJykgLy8gZml4IGxpbmUgYnJlYWtzLCBlbnN1cmUgPENSPjxMRj5cbiAgICAucmVwbGFjZSgvW1xcdCBdKyQvZ20sIHNwYWNlcyA9PiBzcGFjZXMucmVwbGFjZSgvIC9nLCAnPTIwJykucmVwbGFjZSgvXFx0L2csICc9MDknKSkgLy8gcmVwbGFjZSBzcGFjZXMgaW4gdGhlIGVuZCBvZiBsaW5lc1xuXG4gIHJldHVybiBfYWRkUVBTb2Z0TGluZWJyZWFrcyhtaW1lRW5jb2RlZFN0cikgLy8gYWRkIHNvZnQgbGluZSBicmVha3MgdG8gZW5zdXJlIGxpbmUgbGVuZ3RocyBzam9ydGVyIHRoYW4gNzYgYnl0ZXNcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgc3RyaW5nIGZyb20gYSBxdW90ZWQgcHJpbnRhYmxlIGVuY29kaW5nLiBUaGlzIGlzIGFsbW9zdCB0aGVcbiAqIHNhbWUgYXMgbWltZURlY29kZSwgZXhjZXB0IGxpbmUgYnJlYWtzIHdpbGwgYmUgY2hhbmdlZCBhcyB3ZWxsXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nIHRvIGRlY29kZVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBkZWNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVkUHJpbnRhYmxlRGVjb2RlIChzdHIgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IHJhd1N0cmluZyA9IHN0clxuICAgIC5yZXBsYWNlKC9bXFx0IF0rJC9nbSwgJycpIC8vIHJlbW92ZSBpbnZhbGlkIHdoaXRlc3BhY2UgZnJvbSB0aGUgZW5kIG9mIGxpbmVzXG4gICAgLnJlcGxhY2UoLz0oPzpcXHI/XFxufCQpL2csICcnKSAvLyByZW1vdmUgc29mdCBsaW5lIGJyZWFrc1xuXG4gIHJldHVybiBtaW1lRGVjb2RlKHJhd1N0cmluZywgZnJvbUNoYXJzZXQpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IHRvIGFuIFVURi04IE1JTUUgV29yZFxuICogICBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0N1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7U3RyaW5nfSBTaW5nbGUgb3Igc2V2ZXJhbCBtaW1lIHdvcmRzIGpvaW5lZCB0b2dldGhlclxuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRFbmNvZGUgKGRhdGEsIG1pbWVXb3JkRW5jb2RpbmcgPSAnUScsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBsZXQgcGFydHNcblxuICBpZiAobWltZVdvcmRFbmNvZGluZyA9PT0gJ1EnKSB7XG4gICAgY29uc3Qgc3RyID0gKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIGxldCBlbmNvZGVkU3RyID0gcGlwZShtaW1lRW5jb2RlLCBxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMpKHN0cilcbiAgICBwYXJ0cyA9IGVuY29kZWRTdHIubGVuZ3RoIDwgTUFYX01JTUVfV09SRF9MRU5HVEggPyBbZW5jb2RlZFN0cl0gOiBfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyhlbmNvZGVkU3RyLCBNQVhfTUlNRV9XT1JEX0xFTkdUSClcbiAgfSBlbHNlIHtcbiAgICBjb25zdCBidWYgPSBjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIHBhcnRzID0gc3BsaXRUeXBlZEFycmF5RXZlcnkoTUFYX01JTUVfV09SRF9MRU5HVEgsIGJ1ZikubWFwKGVuY29kZUJhc2U2NClcbiAgfVxuXG4gIGNvbnN0IHByZWZpeCA9ICc9P1VURi04PycgKyBtaW1lV29yZEVuY29kaW5nICsgJz8nXG4gIGNvbnN0IHN1ZmZpeCA9ICc/PSAnXG4gIHJldHVybiBwYXJ0cy5tYXAocCA9PiBwcmVmaXggKyBwICsgc3VmZml4KS5qb2luKCcnKS50cmltKClcbn1cblxuLyoqXG4gKiBRLUVuY29kZXMgcmVtYWluaW5nIGZvcmJpZGRlbiBoZWFkZXIgY2hhcnNcbiAqICAgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDcjc2VjdGlvbi01XG4gKi9cbmNvbnN0IHFFbmNvZGVGb3JiaWRkZW5IZWFkZXJDaGFycyA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgY29uc3QgcUVuY29kZSA9IGNociA9PiBjaHIgPT09ICcgJyA/ICdfJyA6ICgnPScgKyAoY2hyLmNoYXJDb2RlQXQoMCkgPCAweDEwID8gJzAnIDogJycpICsgY2hyLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvW15hLXowLTkhKitcXC0vPV0vaWcsIHFFbmNvZGUpXG59XG5cbi8qKlxuICogRmluZHMgd29yZCBzZXF1ZW5jZXMgd2l0aCBub24gYXNjaWkgdGV4dCBhbmQgY29udmVydHMgdGhlc2UgdG8gbWltZSB3b3Jkc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBwb3NzaWJsZSBtaW1lIHdvcmRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZHNFbmNvZGUgKGRhdGEgPSAnJywgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IHJlZ2V4ID0gLyhbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKig/OlxccytbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKlxccyopPykrL2dcbiAgcmV0dXJuIGRlY29kZShjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KSkucmVwbGFjZShyZWdleCwgbWF0Y2ggPT4gbWF0Y2gubGVuZ3RoID8gbWltZVdvcmRFbmNvZGUobWF0Y2gsIG1pbWVXb3JkRW5jb2RpbmcsIGZyb21DaGFyc2V0KSA6ICcnKVxufVxuXG4vKipcbiAqIERlY29kZSBhIGNvbXBsZXRlIG1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSB3b3JkIGVuY29kZWQgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3JkRGVjb2RlIChzdHIgPSAnJykge1xuICBjb25zdCBtYXRjaCA9IHN0ci5tYXRjaCgvXj1cXD8oW1xcd19cXC0qXSspXFw/KFtRcUJiXSlcXD8oW14/XSspXFw/PSQvaSlcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIHN0clxuXG4gIC8vIFJGQzIyMzEgYWRkZWQgbGFuZ3VhZ2UgdGFnIHRvIHRoZSBlbmNvZGluZ1xuICAvLyBzZWU6IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMjMxI3NlY3Rpb24tNVxuICAvLyB0aGlzIGltcGxlbWVudGF0aW9uIHNpbGVudGx5IGlnbm9yZXMgdGhpcyB0YWdcbiAgY29uc3QgZnJvbUNoYXJzZXQgPSBtYXRjaFsxXS5zcGxpdCgnKicpLnNoaWZ0KClcbiAgY29uc3QgZW5jb2RpbmcgPSAobWF0Y2hbMl0gfHwgJ1EnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKClcbiAgY29uc3QgcmF3U3RyaW5nID0gKG1hdGNoWzNdIHx8ICcnKS5yZXBsYWNlKC9fL2csICcgJylcblxuICBpZiAoZW5jb2RpbmcgPT09ICdCJykge1xuICAgIHJldHVybiBiYXNlNjREZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIGlmIChlbmNvZGluZyA9PT0gJ1EnKSB7XG4gICAgcmV0dXJuIG1pbWVEZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyXG4gIH1cbn1cblxuLyoqXG4gKiBEZWNvZGUgYSBzdHJpbmcgdGhhdCBtaWdodCBpbmNsdWRlIG9uZSBvciBzZXZlcmFsIG1pbWUgd29yZHNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyBpbmNsdWRpbmcgc29tZSBtaW1lIHdvcmRzIHRoYXQgd2lsbCBiZSBlbmNvZGVkXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3Jkc0RlY29kZSAoc3RyID0gJycpIHtcbiAgc3RyID0gc3RyLnRvU3RyaW5nKCkucmVwbGFjZSgvKD1cXD9bXj9dK1xcP1tRcUJiXVxcP1teP10rXFw/PSlcXHMrKD89PVxcP1teP10rXFw/W1FxQmJdXFw/W14/XSpcXD89KS9nLCAnJDEnKVxuICBzdHIgPSBzdHIucmVwbGFjZSgvXFw/PT1cXD9bdVVdW3RUXVtmRl0tOFxcP1tRcUJiXVxcPy9nLCAnJykgLy8gam9pbiBieXRlcyBvZiBtdWx0aS1ieXRlIFVURi04XG4gIHN0ciA9IHN0ci5yZXBsYWNlKC89XFw/W1xcd19cXC0qXStcXD9bUXFCYl1cXD9bXj9dK1xcPz0vZywgbWltZVdvcmQgPT4gbWltZVdvcmREZWNvZGUobWltZVdvcmQucmVwbGFjZSgvXFxzKy9nLCAnJykpKVxuXG4gIHJldHVybiBzdHJcbn1cblxuLyoqXG4gKiBGb2xkcyBsb25nIGxpbmVzLCB1c2VmdWwgZm9yIGZvbGRpbmcgaGVhZGVyIGxpbmVzIChhZnRlclNwYWNlPWZhbHNlKSBhbmRcbiAqIGZsb3dlZCB0ZXh0IChhZnRlclNwYWNlPXRydWUpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gYmUgZm9sZGVkXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGFmdGVyU3BhY2UgSWYgdHJ1ZSwgbGVhdmUgYSBzcGFjZSBpbiB0aCBlbmQgb2YgYSBsaW5lXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIGZvbGRlZCBsaW5lc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZm9sZExpbmVzIChzdHIgPSAnJywgYWZ0ZXJTcGFjZSkge1xuICBsZXQgcG9zID0gMFxuICBjb25zdCBsZW4gPSBzdHIubGVuZ3RoXG4gIGxldCByZXN1bHQgPSAnJ1xuICBsZXQgbGluZSwgbWF0Y2hcblxuICB3aGlsZSAocG9zIDwgbGVuKSB7XG4gICAgbGluZSA9IHN0ci5zdWJzdHIocG9zLCBNQVhfTElORV9MRU5HVEgpXG4gICAgaWYgKGxpbmUubGVuZ3RoIDwgTUFYX0xJTkVfTEVOR1RIKSB7XG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goL15bXlxcblxccl0qKFxccj9cXG58XFxyKS8pKSkge1xuICAgICAgbGluZSA9IG1hdGNoWzBdXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvKFxccyspW15cXHNdKiQvKSkgJiYgbWF0Y2hbMF0ubGVuZ3RoIC0gKGFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApIDwgbGluZS5sZW5ndGgpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpKVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gc3RyLnN1YnN0cihwb3MgKyBsaW5lLmxlbmd0aCkubWF0Y2goL15bXlxcc10rKFxccyopLykpKSB7XG4gICAgICBsaW5lID0gbGluZSArIG1hdGNoWzBdLnN1YnN0cigwLCBtYXRjaFswXS5sZW5ndGggLSAoIWFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApKVxuICAgIH1cblxuICAgIHJlc3VsdCArPSBsaW5lXG4gICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgaWYgKHBvcyA8IGxlbikge1xuICAgICAgcmVzdWx0ICs9ICdcXHJcXG4nXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4vKipcbiAqIEVuY29kZXMgYW5kIGZvbGRzIGEgaGVhZGVyIGxpbmUgZm9yIGEgTUlNRSBtZXNzYWdlIGhlYWRlci5cbiAqIFNob3J0aGFuZCBmb3IgbWltZVdvcmRzRW5jb2RlICsgZm9sZExpbmVzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBLZXkgbmFtZSwgd2lsbCBub3QgYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gdmFsdWUgVmFsdWUgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBDaGFyYWN0ZXIgc2V0IG9mIHRoZSB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBlbmNvZGVkIGFuZCBmb2xkZWQgaGVhZGVyIGxpbmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVFbmNvZGUgKGtleSwgdmFsdWUsIGZyb21DaGFyc2V0KSB7XG4gIHZhciBlbmNvZGVkVmFsdWUgPSBtaW1lV29yZHNFbmNvZGUodmFsdWUsICdRJywgZnJvbUNoYXJzZXQpXG4gIHJldHVybiBmb2xkTGluZXMoa2V5ICsgJzogJyArIGVuY29kZWRWYWx1ZSlcbn1cblxuLyoqXG4gKiBUaGUgcmVzdWx0IGlzIG5vdCBtaW1lIHdvcmQgZGVjb2RlZCwgeW91IG5lZWQgdG8gZG8geW91ciBvd24gZGVjb2RpbmcgYmFzZWRcbiAqIG9uIHRoZSBydWxlcyBmb3IgdGhlIHNwZWNpZmljIGhlYWRlciBrZXlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVyTGluZSBTaW5nbGUgaGVhZGVyIGxpbmUsIG1pZ2h0IGluY2x1ZGUgbGluZWJyZWFrcyBhcyB3ZWxsIGlmIGZvbGRlZFxuICogQHJldHVybiB7T2JqZWN0fSBBbmQgb2JqZWN0IG9mIHtrZXksIHZhbHVlfVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZURlY29kZSAoaGVhZGVyTGluZSA9ICcnKSB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkZXJMaW5lLnRvU3RyaW5nKCkucmVwbGFjZSgvKD86XFxyP1xcbnxcXHIpWyBcXHRdKi9nLCAnICcpLnRyaW0oKVxuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqKFteOl0rKTooLiopJC8pXG5cbiAgcmV0dXJuIHtcbiAgICBrZXk6ICgobWF0Y2ggJiYgbWF0Y2hbMV0pIHx8ICcnKS50cmltKCksXG4gICAgdmFsdWU6ICgobWF0Y2ggJiYgbWF0Y2hbMl0pIHx8ICcnKS50cmltKClcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlcyBhIGJsb2NrIG9mIGhlYWRlciBsaW5lcy4gRG9lcyBub3QgZGVjb2RlIG1pbWUgd29yZHMgYXMgZXZlcnlcbiAqIGhlYWRlciBtaWdodCBoYXZlIGl0cyBvd24gcnVsZXMgKGVnLiBmb3JtYXR0ZWQgZW1haWwgYWRkcmVzc2VzIGFuZCBzdWNoKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJzIEhlYWRlcnMgc3RyaW5nXG4gKiBAcmV0dXJuIHtPYmplY3R9IEFuIG9iamVjdCBvZiBoZWFkZXJzLCB3aGVyZSBoZWFkZXIga2V5cyBhcmUgb2JqZWN0IGtleXMuIE5CISBTZXZlcmFsIHZhbHVlcyB3aXRoIHRoZSBzYW1lIGtleSBtYWtlIHVwIGFuIEFycmF5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkZXJMaW5lc0RlY29kZSAoaGVhZGVycykge1xuICBjb25zdCBsaW5lcyA9IGhlYWRlcnMuc3BsaXQoL1xccj9cXG58XFxyLylcbiAgY29uc3QgaGVhZGVyc09iaiA9IHt9XG5cbiAgZm9yIChsZXQgaSA9IGxpbmVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGkgJiYgbGluZXNbaV0ubWF0Y2goL15cXHMvKSkge1xuICAgICAgbGluZXNbaSAtIDFdICs9ICdcXHJcXG4nICsgbGluZXNbaV1cbiAgICAgIGxpbmVzLnNwbGljZShpLCAxKVxuICAgIH1cbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGhlYWRlciA9IGhlYWRlckxpbmVEZWNvZGUobGluZXNbaV0pXG4gICAgY29uc3Qga2V5ID0gaGVhZGVyLmtleS50b0xvd2VyQ2FzZSgpXG4gICAgY29uc3QgdmFsdWUgPSBoZWFkZXIudmFsdWVcblxuICAgIGlmICghaGVhZGVyc09ialtrZXldKSB7XG4gICAgICBoZWFkZXJzT2JqW2tleV0gPSB2YWx1ZVxuICAgIH0gZWxzZSB7XG4gICAgICBoZWFkZXJzT2JqW2tleV0gPSBbXS5jb25jYXQoaGVhZGVyc09ialtrZXldLCB2YWx1ZSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaGVhZGVyc09ialxufVxuXG4vKipcbiAqIFBhcnNlcyBhIGhlYWRlciB2YWx1ZSB3aXRoIGtleT12YWx1ZSBhcmd1bWVudHMgaW50byBhIHN0cnVjdHVyZWRcbiAqIG9iamVjdC5cbiAqXG4gKiAgIHBhcnNlSGVhZGVyVmFsdWUoJ2NvbnRlbnQtdHlwZTogdGV4dC9wbGFpbjsgQ0hBUlNFVD0nVVRGLTgnJykgLT5cbiAqICAge1xuICogICAgICd2YWx1ZSc6ICd0ZXh0L3BsYWluJyxcbiAqICAgICAncGFyYW1zJzoge1xuICogICAgICAgJ2NoYXJzZXQnOiAnVVRGLTgnXG4gKiAgICAgfVxuICogICB9XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBIZWFkZXIgdmFsdWVcbiAqIEByZXR1cm4ge09iamVjdH0gSGVhZGVyIHZhbHVlIGFzIGEgcGFyc2VkIHN0cnVjdHVyZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIZWFkZXJWYWx1ZSAoc3RyKSB7XG4gIGxldCByZXNwb25zZSA9IHtcbiAgICB2YWx1ZTogZmFsc2UsXG4gICAgcGFyYW1zOiB7fVxuICB9XG4gIGxldCBrZXkgPSBmYWxzZVxuICBsZXQgdmFsdWUgPSAnJ1xuICBsZXQgdHlwZSA9ICd2YWx1ZSdcbiAgbGV0IHF1b3RlID0gZmFsc2VcbiAgbGV0IGVzY2FwZWQgPSBmYWxzZVxuICBsZXQgY2hyXG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNociA9IHN0ci5jaGFyQXQoaSlcbiAgICBpZiAodHlwZSA9PT0gJ2tleScpIHtcbiAgICAgIGlmIChjaHIgPT09ICc9Jykge1xuICAgICAgICBrZXkgPSB2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKVxuICAgICAgICB0eXBlID0gJ3ZhbHVlJ1xuICAgICAgICB2YWx1ZSA9ICcnXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICB2YWx1ZSArPSBjaHJcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVzY2FwZWQpIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9IGVsc2UgaWYgKGNociA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGVzY2FwZWQgPSB0cnVlXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9IGVsc2UgaWYgKHF1b3RlICYmIGNociA9PT0gcXVvdGUpIHtcbiAgICAgICAgcXVvdGUgPSBmYWxzZVxuICAgICAgfSBlbHNlIGlmICghcXVvdGUgJiYgY2hyID09PSAnXCInKSB7XG4gICAgICAgIHF1b3RlID0gY2hyXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICc7Jykge1xuICAgICAgICBpZiAoa2V5ID09PSBmYWxzZSkge1xuICAgICAgICAgIHJlc3BvbnNlLnZhbHVlID0gdmFsdWUudHJpbSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZS50cmltKClcbiAgICAgICAgfVxuICAgICAgICB0eXBlID0gJ2tleSdcbiAgICAgICAgdmFsdWUgPSAnJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9XG4gICAgICBlc2NhcGVkID0gZmFsc2VcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZSA9PT0gJ3ZhbHVlJykge1xuICAgIGlmIChrZXkgPT09IGZhbHNlKSB7XG4gICAgICByZXNwb25zZS52YWx1ZSA9IHZhbHVlLnRyaW0oKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlLnRyaW0oKVxuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZS50cmltKCkpIHtcbiAgICByZXNwb25zZS5wYXJhbXNbdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCldID0gJydcbiAgfVxuXG4gIC8vIGhhbmRsZSBwYXJhbWV0ZXIgdmFsdWUgY29udGludWF0aW9uc1xuICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjIzMSNzZWN0aW9uLTNcblxuICAvLyBwcmVwcm9jZXNzIHZhbHVlc1xuICBPYmplY3Qua2V5cyhyZXNwb25zZS5wYXJhbXMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHZhciBhY3R1YWxLZXksIG5yLCBtYXRjaCwgdmFsdWVcbiAgICBpZiAoKG1hdGNoID0ga2V5Lm1hdGNoKC8oXFwqKFxcZCspfFxcKihcXGQrKVxcKnxcXCopJC8pKSkge1xuICAgICAgYWN0dWFsS2V5ID0ga2V5LnN1YnN0cigwLCBtYXRjaC5pbmRleClcbiAgICAgIG5yID0gTnVtYmVyKG1hdGNoWzJdIHx8IG1hdGNoWzNdKSB8fCAwXG5cbiAgICAgIGlmICghcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gfHwgdHlwZW9mIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSA9IHtcbiAgICAgICAgICBjaGFyc2V0OiBmYWxzZSxcbiAgICAgICAgICB2YWx1ZXM6IFtdXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XVxuXG4gICAgICBpZiAobnIgPT09IDAgJiYgbWF0Y2hbMF0uc3Vic3RyKC0xKSA9PT0gJyonICYmIChtYXRjaCA9IHZhbHVlLm1hdGNoKC9eKFteJ10qKSdbXiddKicoLiopJC8pKSkge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS5jaGFyc2V0ID0gbWF0Y2hbMV0gfHwgJ2lzby04ODU5LTEnXG4gICAgICAgIHZhbHVlID0gbWF0Y2hbMl1cbiAgICAgIH1cblxuICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0udmFsdWVzW25yXSA9IHZhbHVlXG5cbiAgICAgIC8vIHJlbW92ZSB0aGUgb2xkIHJlZmVyZW5jZVxuICAgICAgZGVsZXRlIHJlc3BvbnNlLnBhcmFtc1trZXldXG4gICAgfVxuICB9KVxuXG4gIC8vIGNvbmNhdGVuYXRlIHNwbGl0IHJmYzIyMzEgc3RyaW5ncyBhbmQgY29udmVydCBlbmNvZGVkIHN0cmluZ3MgdG8gbWltZSBlbmNvZGVkIHdvcmRzXG4gIE9iamVjdC5rZXlzKHJlc3BvbnNlLnBhcmFtcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdmFyIHZhbHVlXG4gICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldICYmIEFycmF5LmlzQXJyYXkocmVzcG9uc2UucGFyYW1zW2tleV0udmFsdWVzKSkge1xuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XS52YWx1ZXMubWFwKGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgcmV0dXJuIHZhbCB8fCAnJ1xuICAgICAgfSkuam9pbignJylcblxuICAgICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldLmNoYXJzZXQpIHtcbiAgICAgICAgLy8gY29udmVydCBcIiVBQlwiIHRvIFwiPT9jaGFyc2V0P1E/PUFCPz1cIlxuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9ICc9PycgKyByZXNwb25zZS5wYXJhbXNba2V5XS5jaGFyc2V0ICsgJz9RPycgKyB2YWx1ZVxuICAgICAgICAgIC5yZXBsYWNlKC9bPT9fXFxzXS9nLCBmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgLy8gZml4IGludmFsaWRseSBlbmNvZGVkIGNoYXJzXG4gICAgICAgICAgICB2YXIgYyA9IHMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNilcbiAgICAgICAgICAgIHJldHVybiBzID09PSAnICcgPyAnXycgOiAnJScgKyAoYy5sZW5ndGggPCAyID8gJzAnIDogJycpICsgY1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnJlcGxhY2UoLyUvZywgJz0nKSArICc/PScgLy8gY2hhbmdlIGZyb20gdXJsZW5jb2RpbmcgdG8gcGVyY2VudCBlbmNvZGluZ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gcmVzcG9uc2Vcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gYW4gVVRGLTggUGFyYW1ldGVyIFZhbHVlIENvbnRpbnVhdGlvbiBlbmNvZGluZyAocmZjMjIzMSlcbiAqIFVzZWZ1bCBmb3Igc3BsaXR0aW5nIGxvbmcgcGFyYW1ldGVyIHZhbHVlcy5cbiAqXG4gKiBGb3IgZXhhbXBsZVxuICogICAgICB0aXRsZT1cInVuaWNvZGUgc3RyaW5nXCJcbiAqIGJlY29tZXNcbiAqICAgICB0aXRsZSowKj1cInV0Zi04Jyd1bmljb2RlXCJcbiAqICAgICB0aXRsZSoxKj1cIiUyMHN0cmluZ1wiXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtOdW1iZXJ9IFttYXhMZW5ndGg9NTBdIE1heCBsZW5ndGggZm9yIGdlbmVyYXRlZCBjaHVua3NcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIHNoYXJhY3RlciBzZXRcbiAqIEByZXR1cm4ge0FycmF5fSBBIGxpc3Qgb2YgZW5jb2RlZCBrZXlzIGFuZCBoZWFkZXJzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb250aW51YXRpb25FbmNvZGUgKGtleSwgZGF0YSwgbWF4TGVuZ3RoLCBmcm9tQ2hhcnNldCkge1xuICBjb25zdCBsaXN0ID0gW11cbiAgdmFyIGVuY29kZWRTdHIgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICB2YXIgbGluZVxuICB2YXIgc3RhcnRQb3MgPSAwXG4gIHZhciBpc0VuY29kZWQgPSBmYWxzZVxuXG4gIG1heExlbmd0aCA9IG1heExlbmd0aCB8fCA1MFxuXG4gIC8vIHByb2Nlc3MgYXNjaWkgb25seSB0ZXh0XG4gIGlmICgvXltcXHcuXFwtIF0qJC8udGVzdChkYXRhKSkge1xuICAgIC8vIGNoZWNrIGlmIGNvbnZlcnNpb24gaXMgZXZlbiBuZWVkZWRcbiAgICBpZiAoZW5jb2RlZFN0ci5sZW5ndGggPD0gbWF4TGVuZ3RoKSB7XG4gICAgICByZXR1cm4gW3tcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGVuY29kZWRTdHIpID8gJ1wiJyArIGVuY29kZWRTdHIgKyAnXCInIDogZW5jb2RlZFN0clxuICAgICAgfV1cbiAgICB9XG5cbiAgICBlbmNvZGVkU3RyID0gZW5jb2RlZFN0ci5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIG1heExlbmd0aCArICd9JywgJ2cnKSwgZnVuY3Rpb24gKHN0cikge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogc3RyXG4gICAgICB9KVxuICAgICAgcmV0dXJuICcnXG4gICAgfSlcblxuICAgIGlmIChlbmNvZGVkU3RyKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBlbmNvZGVkU3RyXG4gICAgICB9KVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBmaXJzdCBsaW5lIGluY2x1ZGVzIHRoZSBjaGFyc2V0IGFuZCBsYW5ndWFnZSBpbmZvIGFuZCBuZWVkcyB0byBiZSBlbmNvZGVkXG4gICAgLy8gZXZlbiBpZiBpdCBkb2VzIG5vdCBjb250YWluIGFueSB1bmljb2RlIGNoYXJhY3RlcnNcbiAgICBsaW5lID0gJ3V0Zi04XFwnXFwnJ1xuICAgIGlzRW5jb2RlZCA9IHRydWVcbiAgICBzdGFydFBvcyA9IDBcbiAgICAvLyBwcm9jZXNzIHRleHQgd2l0aCB1bmljb2RlIG9yIHNwZWNpYWwgY2hhcnNcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZW5jb2RlZFN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGNociA9IGVuY29kZWRTdHJbaV1cblxuICAgICAgaWYgKGlzRW5jb2RlZCkge1xuICAgICAgICBjaHIgPSBlbmNvZGVVUklDb21wb25lbnQoY2hyKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdHJ5IHRvIHVybGVuY29kZSBjdXJyZW50IGNoYXJcbiAgICAgICAgY2hyID0gY2hyID09PSAnICcgPyBjaHIgOiBlbmNvZGVVUklDb21wb25lbnQoY2hyKVxuICAgICAgICAvLyBCeSBkZWZhdWx0IGl0IGlzIG5vdCByZXF1aXJlZCB0byBlbmNvZGUgYSBsaW5lLCB0aGUgbmVlZFxuICAgICAgICAvLyBvbmx5IGFwcGVhcnMgd2hlbiB0aGUgc3RyaW5nIGNvbnRhaW5zIHVuaWNvZGUgb3Igc3BlY2lhbCBjaGFyc1xuICAgICAgICAvLyBpbiB0aGlzIGNhc2Ugd2Ugc3RhcnQgcHJvY2Vzc2luZyB0aGUgbGluZSBvdmVyIGFuZCBlbmNvZGUgYWxsIGNoYXJzXG4gICAgICAgIGlmIChjaHIgIT09IGVuY29kZWRTdHJbaV0pIHtcbiAgICAgICAgICAvLyBDaGVjayBpZiBpdCBpcyBldmVuIHBvc3NpYmxlIHRvIGFkZCB0aGUgZW5jb2RlZCBjaGFyIHRvIHRoZSBsaW5lXG4gICAgICAgICAgLy8gSWYgbm90LCB0aGVyZSBpcyBubyByZWFzb24gdG8gdXNlIHRoaXMgbGluZSwganVzdCBwdXNoIGl0IHRvIHRoZSBsaXN0XG4gICAgICAgICAgLy8gYW5kIHN0YXJ0IGEgbmV3IGxpbmUgd2l0aCB0aGUgY2hhciB0aGF0IG5lZWRzIGVuY29kaW5nXG4gICAgICAgICAgaWYgKChlbmNvZGVVUklDb21wb25lbnQobGluZSkgKyBjaHIpLmxlbmd0aCA+PSBtYXhMZW5ndGgpIHtcbiAgICAgICAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGxpbmUgPSAnJ1xuICAgICAgICAgICAgc3RhcnRQb3MgPSBpIC0gMVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpc0VuY29kZWQgPSB0cnVlXG4gICAgICAgICAgICBpID0gc3RhcnRQb3NcbiAgICAgICAgICAgIGxpbmUgPSAnJ1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gaWYgdGhlIGxpbmUgaXMgYWxyZWFkeSB0b28gbG9uZywgcHVzaCBpdCB0byB0aGUgbGlzdCBhbmQgc3RhcnQgYSBuZXcgb25lXG4gICAgICBpZiAoKGxpbmUgKyBjaHIpLmxlbmd0aCA+PSBtYXhMZW5ndGgpIHtcbiAgICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgICBsaW5lOiBsaW5lLFxuICAgICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgICB9KVxuICAgICAgICBsaW5lID0gY2hyID0gZW5jb2RlZFN0cltpXSA9PT0gJyAnID8gJyAnIDogZW5jb2RlVVJJQ29tcG9uZW50KGVuY29kZWRTdHJbaV0pXG4gICAgICAgIGlmIChjaHIgPT09IGVuY29kZWRTdHJbaV0pIHtcbiAgICAgICAgICBpc0VuY29kZWQgPSBmYWxzZVxuICAgICAgICAgIHN0YXJ0UG9zID0gaSAtIDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpc0VuY29kZWQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpbmUgKz0gY2hyXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxpbmUpIHtcbiAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGlzdC5tYXAoZnVuY3Rpb24gKGl0ZW0sIGkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLy8gZW5jb2RlZCBsaW5lczoge25hbWV9KntwYXJ0fSpcbiAgICAgIC8vIHVuZW5jb2RlZCBsaW5lczoge25hbWV9KntwYXJ0fVxuICAgICAgLy8gaWYgYW55IGxpbmUgbmVlZHMgdG8gYmUgZW5jb2RlZCB0aGVuIHRoZSBmaXJzdCBsaW5lIChwYXJ0PT0wKSBpcyBhbHdheXMgZW5jb2RlZFxuICAgICAga2V5OiBrZXkgKyAnKicgKyBpICsgKGl0ZW0uZW5jb2RlZCA/ICcqJyA6ICcnKSxcbiAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGl0ZW0ubGluZSkgPyAnXCInICsgaXRlbS5saW5lICsgJ1wiJyA6IGl0ZW0ubGluZVxuICAgIH1cbiAgfSlcbn1cblxuLyoqXG4gKiBTcGxpdHMgYSBtaW1lIGVuY29kZWQgc3RyaW5nLiBOZWVkZWQgZm9yIGRpdmlkaW5nIG1pbWUgd29yZHMgaW50byBzbWFsbGVyIGNodW5rc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZyB0byBiZSBzcGxpdCB1cFxuICogQHBhcmFtIHtOdW1iZXJ9IG1heGxlbiBNYXhpbXVtIGxlbmd0aCBvZiBjaGFyYWN0ZXJzIGZvciBvbmUgcGFydCAobWluaW11bSAxMilcbiAqIEByZXR1cm4ge0FycmF5fSBTcGxpdCBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gX3NwbGl0TWltZUVuY29kZWRTdHJpbmcgKHN0ciwgbWF4bGVuID0gMTIpIHtcbiAgY29uc3QgbWluV29yZExlbmd0aCA9IDEyIC8vIHJlcXVpcmUgYXQgbGVhc3QgMTIgc3ltYm9scyB0byBmaXQgcG9zc2libGUgNCBvY3RldCBVVEYtOCBzZXF1ZW5jZXNcbiAgY29uc3QgbWF4V29yZExlbmd0aCA9IE1hdGgubWF4KG1heGxlbiwgbWluV29yZExlbmd0aClcbiAgY29uc3QgbGluZXMgPSBbXVxuXG4gIHdoaWxlIChzdHIubGVuZ3RoKSB7XG4gICAgbGV0IGN1ckxpbmUgPSBzdHIuc3Vic3RyKDAsIG1heFdvcmRMZW5ndGgpXG5cbiAgICBjb25zdCBtYXRjaCA9IGN1ckxpbmUubWF0Y2goLz1bMC05QS1GXT8kL2kpIC8vIHNraXAgaW5jb21wbGV0ZSBlc2NhcGVkIGNoYXJcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGN1ckxpbmUgPSBjdXJMaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleClcbiAgICB9XG5cbiAgICBsZXQgZG9uZSA9IGZhbHNlXG4gICAgd2hpbGUgKCFkb25lKSB7XG4gICAgICBsZXQgY2hyXG4gICAgICBkb25lID0gdHJ1ZVxuICAgICAgY29uc3QgbWF0Y2ggPSBzdHIuc3Vic3RyKGN1ckxpbmUubGVuZ3RoKS5tYXRjaCgvXj0oWzAtOUEtRl17Mn0pL2kpIC8vIGNoZWNrIGlmIG5vdCBtaWRkbGUgb2YgYSB1bmljb2RlIGNoYXIgc2VxdWVuY2VcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBjaHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTYpXG4gICAgICAgIC8vIGludmFsaWQgc2VxdWVuY2UsIG1vdmUgb25lIGNoYXIgYmFjayBhbmMgcmVjaGVja1xuICAgICAgICBpZiAoY2hyIDwgMHhDMiAmJiBjaHIgPiAweDdGKSB7XG4gICAgICAgICAgY3VyTGluZSA9IGN1ckxpbmUuc3Vic3RyKDAsIGN1ckxpbmUubGVuZ3RoIC0gMylcbiAgICAgICAgICBkb25lID0gZmFsc2VcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjdXJMaW5lLmxlbmd0aCkge1xuICAgICAgbGluZXMucHVzaChjdXJMaW5lKVxuICAgIH1cbiAgICBzdHIgPSBzdHIuc3Vic3RyKGN1ckxpbmUubGVuZ3RoKVxuICB9XG5cbiAgcmV0dXJuIGxpbmVzXG59XG5cbmZ1bmN0aW9uIF9hZGRCYXNlNjRTb2Z0TGluZWJyZWFrcyAoYmFzZTY0RW5jb2RlZFN0ciA9ICcnKSB7XG4gIHJldHVybiBiYXNlNjRFbmNvZGVkU3RyLnRyaW0oKS5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIE1BWF9MSU5FX0xFTkdUSCArICd9JywgJ2cnKSwgJyQmXFxyXFxuJykudHJpbSgpXG59XG5cbi8qKlxuICogQWRkcyBzb2Z0IGxpbmUgYnJlYWtzKHRoZSBvbmVzIHRoYXQgd2lsbCBiZSBzdHJpcHBlZCBvdXQgd2hlbiBkZWNvZGluZyBRUClcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcXBFbmNvZGVkU3RyIFN0cmluZyBpbiBRdW90ZWQtUHJpbnRhYmxlIGVuY29kaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIGZvcmNlZCBsaW5lIGJyZWFrc1xuICovXG5mdW5jdGlvbiBfYWRkUVBTb2Z0TGluZWJyZWFrcyAocXBFbmNvZGVkU3RyID0gJycpIHtcbiAgbGV0IHBvcyA9IDBcbiAgY29uc3QgbGVuID0gcXBFbmNvZGVkU3RyLmxlbmd0aFxuICBjb25zdCBsaW5lTWFyZ2luID0gTWF0aC5mbG9vcihNQVhfTElORV9MRU5HVEggLyAzKVxuICBsZXQgcmVzdWx0ID0gJydcbiAgbGV0IG1hdGNoLCBsaW5lXG5cbiAgLy8gaW5zZXJ0IHNvZnQgbGluZWJyZWFrcyB3aGVyZSBuZWVkZWRcbiAgd2hpbGUgKHBvcyA8IGxlbikge1xuICAgIGxpbmUgPSBxcEVuY29kZWRTdHIuc3Vic3RyKHBvcywgTUFYX0xJTkVfTEVOR1RIKVxuICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC9cXHJcXG4vKSkpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGxpbmUuc3Vic3RyKC0xKSA9PT0gJ1xcbicpIHtcbiAgICAgIC8vIG5vdGhpbmcgdG8gY2hhbmdlIGhlcmVcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1xcbi4qPyQvKSkpIHtcbiAgICAgIC8vIHRydW5jYXRlIHRvIG5lYXJlc3QgbGluZSBicmVha1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIDEpKVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9IGVsc2UgaWYgKGxpbmUubGVuZ3RoID4gTUFYX0xJTkVfTEVOR1RIIC0gbGluZU1hcmdpbiAmJiAobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1sgXFx0LiwhP11bXiBcXHQuLCE/XSokLykpKSB7XG4gICAgICAvLyB0cnVuY2F0ZSB0byBuZWFyZXN0IHNwYWNlXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gMSkpXG4gICAgfSBlbHNlIGlmIChsaW5lLnN1YnN0cigtMSkgPT09ICdcXHInKSB7XG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMn0kL2kpKSB7XG4gICAgICAgIC8vIHB1c2ggaW5jb21wbGV0ZSBlbmNvZGluZyBzZXF1ZW5jZXMgdG8gdGhlIG5leHQgbGluZVxuICAgICAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMX0kL2kpKSkge1xuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVuc3VyZSB0aGF0IHV0Zi04IHNlcXVlbmNlcyBhcmUgbm90IHNwbGl0XG4gICAgICAgIHdoaWxlIChsaW5lLmxlbmd0aCA+IDMgJiYgbGluZS5sZW5ndGggPCBsZW4gLSBwb3MgJiYgIWxpbmUubWF0Y2goL14oPzo9W1xcZGEtZl17Mn0pezEsNH0kL2kpICYmIChtYXRjaCA9IGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvaWcpKSkge1xuICAgICAgICAgIGNvbnN0IGNvZGUgPSBwYXJzZUludChtYXRjaFswXS5zdWJzdHIoMSwgMiksIDE2KVxuICAgICAgICAgIGlmIChjb2RlIDwgMTI4KSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDMpXG5cbiAgICAgICAgICBpZiAoY29kZSA+PSAweEMwKSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3MgKyBsaW5lLmxlbmd0aCA8IGxlbiAmJiBsaW5lLnN1YnN0cigtMSkgIT09ICdcXG4nKSB7XG4gICAgICBpZiAobGluZS5sZW5ndGggPT09IE1BWF9MSU5FX0xFTkdUSCAmJiBsaW5lLm1hdGNoKC89W1xcZGEtZl17Mn0kL2kpKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDMpXG4gICAgICB9IGVsc2UgaWYgKGxpbmUubGVuZ3RoID09PSBNQVhfTElORV9MRU5HVEgpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMSlcbiAgICAgIH1cbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgbGluZSArPSAnPVxcclxcbidcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGxpbmVcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuZXhwb3J0IHsgZGVjb2RlLCBlbmNvZGUsIGNvbnZlcnQgfVxuIl19