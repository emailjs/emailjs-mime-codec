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
  str = str.replace(/\?==\?[uU][tT][fF]-8\?[QqBb]\?/g, ''); // join bytes of multi-byte UTF-8
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMuanMiXSwibmFtZXMiOlsibWltZUVuY29kZSIsIm1pbWVEZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJiYXNlNjREZWNvZGUiLCJxdW90ZWRQcmludGFibGVFbmNvZGUiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsIm1pbWVXb3JkRGVjb2RlIiwibWltZVdvcmRzRGVjb2RlIiwiZm9sZExpbmVzIiwiaGVhZGVyTGluZUVuY29kZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lc0RlY29kZSIsInBhcnNlSGVhZGVyVmFsdWUiLCJjb250aW51YXRpb25FbmNvZGUiLCJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsIk1BWF9CNjRfTUlNRV9XT1JEX0JZVEVfTEVOR1RIIiwiZGF0YSIsImZyb21DaGFyc2V0IiwiYnVmZmVyIiwicmVkdWNlIiwiYWdncmVnYXRlIiwib3JkIiwiaW5kZXgiLCJfY2hlY2tSYW5nZXMiLCJsZW5ndGgiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJ0b1N0cmluZyIsInRvVXBwZXJDYXNlIiwibnIiLCJyYW5nZXMiLCJ2YWwiLCJyYW5nZSIsInN0ciIsImVuY29kZWRCeXRlc0NvdW50IiwibWF0Y2giLCJVaW50OEFycmF5IiwiaSIsImxlbiIsImJ1ZmZlclBvcyIsImhleCIsInN1YnN0ciIsImNociIsImNoYXJBdCIsInRlc3QiLCJwYXJzZUludCIsImNoYXJDb2RlQXQiLCJidWYiLCJiNjQiLCJfYWRkQmFzZTY0U29mdExpbmVicmVha3MiLCJtaW1lRW5jb2RlZFN0ciIsInJlcGxhY2UiLCJzcGFjZXMiLCJfYWRkUVBTb2Z0TGluZWJyZWFrcyIsInJhd1N0cmluZyIsIm1pbWVXb3JkRW5jb2RpbmciLCJwYXJ0cyIsImVuY29kZWRTdHIiLCJxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMiLCJfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyIsImoiLCJzdWJzdHJpbmciLCJwdXNoIiwibWFwIiwicHJlZml4Iiwic3VmZml4IiwicCIsImpvaW4iLCJ0cmltIiwicUVuY29kZSIsInJlZ2V4Iiwic3BsaXQiLCJzaGlmdCIsImVuY29kaW5nIiwibWltZVdvcmQiLCJhZnRlclNwYWNlIiwicG9zIiwicmVzdWx0IiwibGluZSIsImtleSIsInZhbHVlIiwiZW5jb2RlZFZhbHVlIiwiaGVhZGVyTGluZSIsImhlYWRlcnMiLCJsaW5lcyIsImhlYWRlcnNPYmoiLCJzcGxpY2UiLCJoZWFkZXIiLCJ0b0xvd2VyQ2FzZSIsImNvbmNhdCIsInJlc3BvbnNlIiwicGFyYW1zIiwidHlwZSIsInF1b3RlIiwiZXNjYXBlZCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiYWN0dWFsS2V5IiwiTnVtYmVyIiwiY2hhcnNldCIsInZhbHVlcyIsIkFycmF5IiwiaXNBcnJheSIsInMiLCJjIiwibWF4TGVuZ3RoIiwibGlzdCIsInN0YXJ0UG9zIiwiaXNFbmNvZGVkIiwiUmVnRXhwIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZW5jb2RlZCIsIml0ZW0iLCJtYXhsZW4iLCJtaW5Xb3JkTGVuZ3RoIiwibWF4V29yZExlbmd0aCIsIk1hdGgiLCJtYXgiLCJjdXJMaW5lIiwiZG9uZSIsImJhc2U2NEVuY29kZWRTdHIiLCJxcEVuY29kZWRTdHIiLCJsaW5lTWFyZ2luIiwiZmxvb3IiLCJjb2RlIiwiZGVjb2RlIiwiZW5jb2RlIiwiY29udmVydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O1FBbUJnQkEsVSxHQUFBQSxVO1FBMEJBQyxVLEdBQUFBLFU7UUEwQkFDLFksR0FBQUEsWTtRQWFBQyxZLEdBQUFBLFk7UUFjQUMscUIsR0FBQUEscUI7UUFnQkFDLHFCLEdBQUFBLHFCO1FBaUJBQyxjLEdBQUFBLGM7UUFnREFDLGUsR0FBQUEsZTtRQVdBQyxjLEdBQUFBLGM7UUEwQkFDLGUsR0FBQUEsZTtRQWdCQUMsUyxHQUFBQSxTO1FBMENBQyxnQixHQUFBQSxn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LEtBQWdCWCxlQUFoQixJQUFtQ2lFLEtBQUszQyxLQUFMLENBQVcsZUFBWCxDQUF2QyxFQUFvRTtBQUNsRTJDLGVBQU9BLEtBQUtyQyxNQUFMLENBQVksQ0FBWixFQUFlcUMsS0FBS3RELE1BQUwsR0FBYyxDQUE3QixDQUFQO0FBQ0QsT0FGRCxNQUVPLElBQUlzRCxLQUFLdEQsTUFBTCxLQUFnQlgsZUFBcEIsRUFBcUM7QUFDMUNpRSxlQUFPQSxLQUFLckMsTUFBTCxDQUFZLENBQVosRUFBZXFDLEtBQUt0RCxNQUFMLEdBQWMsQ0FBN0IsQ0FBUDtBQUNEO0FBQ0RvRCxhQUFPRSxLQUFLdEQsTUFBWjtBQUNBc0QsY0FBUSxPQUFSO0FBQ0QsS0FSRCxNQVFPO0FBQ0xGLGFBQU9FLEtBQUt0RCxNQUFaO0FBQ0Q7O0FBRURxRCxjQUFVQyxJQUFWO0FBQ0Q7O0FBRUQsU0FBT0QsTUFBUDtBQUNEOztRQUVRaUQsTTtRQUFRQyxNO1FBQVFDLE8iLCJmaWxlIjoibWltZWNvZGVjLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZW5jb2RlIGFzIGVuY29kZUJhc2U2NCwgZGVjb2RlIGFzIGRlY29kZUJhc2U2NCwgT1VUUFVUX1RZUEVEX0FSUkFZIH0gZnJvbSAnZW1haWxqcy1iYXNlNjQnXG5pbXBvcnQgeyBlbmNvZGUsIGRlY29kZSwgY29udmVydCwgYXJyMnN0ciB9IGZyb20gJy4vY2hhcnNldCdcbmltcG9ydCB7IHBpcGUgfSBmcm9tICdyYW1kYSdcblxuLy8gTGluZXMgY2FuJ3QgYmUgbG9uZ2VyIHRoYW4gNzYgKyA8Q1I+PExGPiA9IDc4IGJ5dGVzXG4vLyBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ1I3NlY3Rpb24tNi43XG5jb25zdCBNQVhfTElORV9MRU5HVEggPSA3NlxuY29uc3QgTUFYX01JTUVfV09SRF9MRU5HVEggPSA1MlxuY29uc3QgTUFYX0I2NF9NSU1FX1dPUkRfQllURV9MRU5HVEggPSAzOVxuXG4vKipcbiAqIEVuY29kZXMgYWxsIG5vbiBwcmludGFibGUgYW5kIG5vbiBhc2NpaSBieXRlcyB0byA9WFggZm9ybSwgd2hlcmUgWFggaXMgdGhlXG4gKiBieXRlIHZhbHVlIGluIGhleC4gVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBjb252ZXJ0IGxpbmVicmVha3MgZXRjLiBpdFxuICogb25seSBlc2NhcGVzIGNoYXJhY3RlciBzZXF1ZW5jZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIEVpdGhlciBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5XG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lRW5jb2RlIChkYXRhID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBidWZmZXIgPSBjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KVxuICByZXR1cm4gYnVmZmVyLnJlZHVjZSgoYWdncmVnYXRlLCBvcmQsIGluZGV4KSA9PlxuICAgIF9jaGVja1JhbmdlcyhvcmQpICYmICEoKG9yZCA9PT0gMHgyMCB8fCBvcmQgPT09IDB4MDkpICYmIChpbmRleCA9PT0gYnVmZmVyLmxlbmd0aCAtIDEgfHwgYnVmZmVyW2luZGV4ICsgMV0gPT09IDB4MGEgfHwgYnVmZmVyW2luZGV4ICsgMV0gPT09IDB4MGQpKVxuICAgICAgPyBhZ2dyZWdhdGUgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKG9yZCkgLy8gaWYgdGhlIGNoYXIgaXMgaW4gYWxsb3dlZCByYW5nZSwgdGhlbiBrZWVwIGFzIGlzLCB1bmxlc3MgaXQgaXMgYSB3cyBpbiB0aGUgZW5kIG9mIGEgbGluZVxuICAgICAgOiBhZ2dyZWdhdGUgKyAnPScgKyAob3JkIDwgMHgxMCA/ICcwJyA6ICcnKSArIG9yZC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSwgJycpXG5cbiAgZnVuY3Rpb24gX2NoZWNrUmFuZ2VzIChucikge1xuICAgIGNvbnN0IHJhbmdlcyA9IFsgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDUjc2VjdGlvbi02LjdcbiAgICAgIFsweDA5XSwgLy8gPFRBQj5cbiAgICAgIFsweDBBXSwgLy8gPExGPlxuICAgICAgWzB4MERdLCAvLyA8Q1I+XG4gICAgICBbMHgyMCwgMHgzQ10sIC8vIDxTUD4hXCIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7XG4gICAgICBbMHgzRSwgMHg3RV0gLy8gPj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXFxdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1cbiAgICBdXG4gICAgcmV0dXJuIHJhbmdlcy5yZWR1Y2UoKHZhbCwgcmFuZ2UpID0+IHZhbCB8fCAocmFuZ2UubGVuZ3RoID09PSAxICYmIG5yID09PSByYW5nZVswXSkgfHwgKHJhbmdlLmxlbmd0aCA9PT0gMiAmJiBuciA+PSByYW5nZVswXSAmJiBuciA8PSByYW5nZVsxXSksIGZhbHNlKVxuICB9XG59XG5cbi8qKlxuICogRGVjb2RlcyBtaW1lIGVuY29kZWQgc3RyaW5nIHRvIGFuIHVuaWNvZGUgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lRGVjb2RlIChzdHIgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IGVuY29kZWRCeXRlc0NvdW50ID0gKHN0ci5tYXRjaCgvPVtcXGRhLWZBLUZdezJ9L2cpIHx8IFtdKS5sZW5ndGhcbiAgbGV0IGJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KHN0ci5sZW5ndGggLSBlbmNvZGVkQnl0ZXNDb3VudCAqIDIpXG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGgsIGJ1ZmZlclBvcyA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIGxldCBoZXggPSBzdHIuc3Vic3RyKGkgKyAxLCAyKVxuICAgIGNvbnN0IGNociA9IHN0ci5jaGFyQXQoaSlcbiAgICBpZiAoY2hyID09PSAnPScgJiYgaGV4ICYmIC9bXFxkYS1mQS1GXXsyfS8udGVzdChoZXgpKSB7XG4gICAgICBidWZmZXJbYnVmZmVyUG9zKytdID0gcGFyc2VJbnQoaGV4LCAxNilcbiAgICAgIGkgKz0gMlxuICAgIH0gZWxzZSB7XG4gICAgICBidWZmZXJbYnVmZmVyUG9zKytdID0gY2hyLmNoYXJDb2RlQXQoMClcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVjb2RlKGJ1ZmZlciwgZnJvbUNoYXJzZXQpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiB0eXBlZCBhcnJheSBvZiBnaXZlbiBjaGFyc2V0IGludG8gdW5pY29kZVxuICogYmFzZTY0IHN0cmluZy4gQWxzbyBhZGRzIGxpbmUgYnJlYWtzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgb3IgdHlwZWQgYXJyYXkgdG8gYmUgYmFzZTY0IGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBJbml0aWFsIGNoYXJzZXQsIGUuZy4gJ2JpbmFyeScuIERlZmF1bHRzIHRvICdVVEYtOCdcbiAqIEByZXR1cm4ge1N0cmluZ30gQmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjRFbmNvZGUgKGRhdGEsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBidWYgPSAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnICYmIGZyb21DaGFyc2V0ID09PSAnYmluYXJ5JykgPyBkYXRhIDogY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcbiAgY29uc3QgYjY0ID0gZW5jb2RlQmFzZTY0KGJ1ZilcbiAgcmV0dXJuIF9hZGRCYXNlNjRTb2Z0TGluZWJyZWFrcyhiNjQpXG59XG5cbi8qKlxuICogRGVjb2RlcyBhIGJhc2U2NCBzdHJpbmcgb2YgYW55IGNoYXJzZXQgaW50byBhbiB1bmljb2RlIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIGJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjREZWNvZGUgKHN0ciwgZnJvbUNoYXJzZXQpIHtcbiAgY29uc3QgYnVmID0gZGVjb2RlQmFzZTY0KHN0ciwgT1VUUFVUX1RZUEVEX0FSUkFZKVxuICByZXR1cm4gZnJvbUNoYXJzZXQgPT09ICdiaW5hcnknID8gYXJyMnN0cihidWYpIDogZGVjb2RlKGJ1ZiwgZnJvbUNoYXJzZXQpXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IGludG8gYSBxdW90ZWQgcHJpbnRhYmxlIGVuY29kaW5nXG4gKiBUaGlzIGlzIGFsbW9zdCB0aGUgc2FtZSBhcyBtaW1lRW5jb2RlLCBleGNlcHQgbGluZSBicmVha3Mgd2lsbCBiZSBjaGFuZ2VkXG4gKiBhcyB3ZWxsIHRvIGVuc3VyZSB0aGF0IHRoZSBsaW5lcyBhcmUgbmV2ZXIgbG9uZ2VyIHRoYW4gYWxsb3dlZCBsZW5ndGhcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyBvciBhbiBVaW50OEFycmF5IHRvIG1pbWUgZW5jb2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIHN0cmluZ1xuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBxdW90ZWRQcmludGFibGVFbmNvZGUgKGRhdGEgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IG1pbWVFbmNvZGVkU3RyID0gbWltZUVuY29kZShkYXRhLCBmcm9tQ2hhcnNldClcbiAgICAucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJ1xcclxcbicpIC8vIGZpeCBsaW5lIGJyZWFrcywgZW5zdXJlIDxDUj48TEY+XG4gICAgLnJlcGxhY2UoL1tcXHQgXSskL2dtLCBzcGFjZXMgPT4gc3BhY2VzLnJlcGxhY2UoLyAvZywgJz0yMCcpLnJlcGxhY2UoL1xcdC9nLCAnPTA5JykpIC8vIHJlcGxhY2Ugc3BhY2VzIGluIHRoZSBlbmQgb2YgbGluZXNcblxuICByZXR1cm4gX2FkZFFQU29mdExpbmVicmVha3MobWltZUVuY29kZWRTdHIpIC8vIGFkZCBzb2Z0IGxpbmUgYnJlYWtzIHRvIGVuc3VyZSBsaW5lIGxlbmd0aHMgc2pvcnRlciB0aGFuIDc2IGJ5dGVzXG59XG5cbi8qKlxuICogRGVjb2RlcyBhIHN0cmluZyBmcm9tIGEgcXVvdGVkIHByaW50YWJsZSBlbmNvZGluZy4gVGhpcyBpcyBhbG1vc3QgdGhlXG4gKiBzYW1lIGFzIG1pbWVEZWNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWQgYXMgd2VsbFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZyB0byBkZWNvZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE1pbWUgZGVjb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlZFByaW50YWJsZURlY29kZSAoc3RyID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCByYXdTdHJpbmcgPSBzdHJcbiAgICAucmVwbGFjZSgvW1xcdCBdKyQvZ20sICcnKSAvLyByZW1vdmUgaW52YWxpZCB3aGl0ZXNwYWNlIGZyb20gdGhlIGVuZCBvZiBsaW5lc1xuICAgIC5yZXBsYWNlKC89KD86XFxyP1xcbnwkKS9nLCAnJykgLy8gcmVtb3ZlIHNvZnQgbGluZSBicmVha3NcblxuICByZXR1cm4gbWltZURlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBNSU1FIFdvcmRcbiAqICAgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gbWltZVdvcmRFbmNvZGluZz0nUScgRW5jb2RpbmcgZm9yIHRoZSBtaW1lIHdvcmQsIGVpdGhlciBRIG9yIEJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIHNoYXJhY3RlciBzZXRcbiAqIEByZXR1cm4ge1N0cmluZ30gU2luZ2xlIG9yIHNldmVyYWwgbWltZSB3b3JkcyBqb2luZWQgdG9nZXRoZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3JkRW5jb2RlIChkYXRhLCBtaW1lV29yZEVuY29kaW5nID0gJ1EnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgbGV0IHBhcnRzID0gW11cbiAgY29uc3Qgc3RyID0gKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuXG4gIGlmIChtaW1lV29yZEVuY29kaW5nID09PSAnUScpIHtcbiAgICBjb25zdCBzdHIgPSAodHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gICAgbGV0IGVuY29kZWRTdHIgPSBwaXBlKG1pbWVFbmNvZGUsIHFFbmNvZGVGb3JiaWRkZW5IZWFkZXJDaGFycykoc3RyKVxuICAgIHBhcnRzID0gZW5jb2RlZFN0ci5sZW5ndGggPCBNQVhfTUlNRV9XT1JEX0xFTkdUSCA/IFtlbmNvZGVkU3RyXSA6IF9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nKGVuY29kZWRTdHIsIE1BWF9NSU1FX1dPUkRfTEVOR1RIKVxuICB9IGVsc2Uge1xuICAgIC8vIEZpdHMgYXMgbXVjaCBhcyBwb3NzaWJsZSBpbnRvIGV2ZXJ5IGxpbmUgd2l0aG91dCBicmVha2luZyB1dGYtOCBtdWx0aWJ5dGUgY2hhcmFjdGVycycgb2N0ZXRzIHVwIGFjcm9zcyBsaW5lc1xuICAgIGxldCBqID0gMFxuICAgIGxldCBpID0gMFxuICAgIHdoaWxlIChpIDwgc3RyLmxlbmd0aCkge1xuICAgICAgaWYgKGVuY29kZShzdHIuc3Vic3RyaW5nKGosIGkpKS5sZW5ndGggPiBNQVhfQjY0X01JTUVfV09SRF9CWVRFX0xFTkdUSCkge1xuICAgICAgICAvLyB3ZSB3ZW50IG9uZSBjaGFyYWN0ZXIgdG9vIGZhciwgc3Vic3RyaW5nIGF0IHRoZSBjaGFyIGJlZm9yZVxuICAgICAgICBwYXJ0cy5wdXNoKHN0ci5zdWJzdHJpbmcoaiwgaSAtIDEpKVxuICAgICAgICBqID0gaSAtIDFcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGkrK1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBhZGQgdGhlIHJlbWFpbmRlciBvZiB0aGUgc3RyaW5nXG4gICAgc3RyLnN1YnN0cmluZyhqKSAmJiBwYXJ0cy5wdXNoKHN0ci5zdWJzdHJpbmcoaikpXG4gICAgcGFydHMgPSBwYXJ0cy5tYXAoZW5jb2RlKS5tYXAoZW5jb2RlQmFzZTY0KVxuICB9XG5cbiAgY29uc3QgcHJlZml4ID0gJz0/VVRGLTg/JyArIG1pbWVXb3JkRW5jb2RpbmcgKyAnPydcbiAgY29uc3Qgc3VmZml4ID0gJz89ICdcbiAgcmV0dXJuIHBhcnRzLm1hcChwID0+IHByZWZpeCArIHAgKyBzdWZmaXgpLmpvaW4oJycpLnRyaW0oKVxufVxuXG4vKipcbiAqIFEtRW5jb2RlcyByZW1haW5pbmcgZm9yYmlkZGVuIGhlYWRlciBjaGFyc1xuICogICBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NyNzZWN0aW9uLTVcbiAqL1xuY29uc3QgcUVuY29kZUZvcmJpZGRlbkhlYWRlckNoYXJzID0gZnVuY3Rpb24gKHN0cikge1xuICBjb25zdCBxRW5jb2RlID0gY2hyID0+IGNociA9PT0gJyAnID8gJ18nIDogKCc9JyArIChjaHIuY2hhckNvZGVBdCgwKSA8IDB4MTAgPyAnMCcgOiAnJykgKyBjaHIuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSlcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9bXmEtejAtOSEqK1xcLS89XS9pZywgcUVuY29kZSlcbn1cblxuLyoqXG4gKiBGaW5kcyB3b3JkIHNlcXVlbmNlcyB3aXRoIG5vbiBhc2NpaSB0ZXh0IGFuZCBjb252ZXJ0cyB0aGVzZSB0byBtaW1lIHdvcmRzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IG1pbWVXb3JkRW5jb2Rpbmc9J1EnIEVuY29kaW5nIGZvciB0aGUgbWltZSB3b3JkLCBlaXRoZXIgUSBvciBCXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBzaGFyYWN0ZXIgc2V0XG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIHBvc3NpYmxlIG1pbWUgd29yZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3Jkc0VuY29kZSAoZGF0YSA9ICcnLCBtaW1lV29yZEVuY29kaW5nID0gJ1EnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgcmVnZXggPSAvKFteXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qKD86XFxzK1teXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qXFxzKik/KSsoPz1cXHN8JCkvZ1xuICByZXR1cm4gZGVjb2RlKGNvbnZlcnQoZGF0YSwgZnJvbUNoYXJzZXQpKS5yZXBsYWNlKHJlZ2V4LCBtYXRjaCA9PiBtYXRjaC5sZW5ndGggPyBtaW1lV29yZEVuY29kZShtYXRjaCwgbWltZVdvcmRFbmNvZGluZywgZnJvbUNoYXJzZXQpIDogJycpXG59XG5cbi8qKlxuICogRGVjb2RlIGEgY29tcGxldGUgbWltZSB3b3JkIGVuY29kZWQgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIHdvcmQgZW5jb2RlZCBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmREZWNvZGUgKHN0ciA9ICcnKSB7XG4gIGNvbnN0IG1hdGNoID0gc3RyLm1hdGNoKC9ePVxcPyhbXFx3X1xcLSpdKylcXD8oW1FxQmJdKVxcPyhbXj9dKilcXD89JC9pKVxuICBpZiAoIW1hdGNoKSByZXR1cm4gc3RyXG5cbiAgLy8gUkZDMjIzMSBhZGRlZCBsYW5ndWFnZSB0YWcgdG8gdGhlIGVuY29kaW5nXG4gIC8vIHNlZTogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIyMzEjc2VjdGlvbi01XG4gIC8vIHRoaXMgaW1wbGVtZW50YXRpb24gc2lsZW50bHkgaWdub3JlcyB0aGlzIHRhZ1xuICBjb25zdCBmcm9tQ2hhcnNldCA9IG1hdGNoWzFdLnNwbGl0KCcqJykuc2hpZnQoKVxuICBjb25zdCBlbmNvZGluZyA9IChtYXRjaFsyXSB8fCAnUScpLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKVxuICBjb25zdCByYXdTdHJpbmcgPSAobWF0Y2hbM10gfHwgJycpLnJlcGxhY2UoL18vZywgJyAnKVxuXG4gIGlmIChlbmNvZGluZyA9PT0gJ0InKSB7XG4gICAgcmV0dXJuIGJhc2U2NERlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxuICB9IGVsc2UgaWYgKGVuY29kaW5nID09PSAnUScpIHtcbiAgICByZXR1cm4gbWltZURlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHJcbiAgfVxufVxuXG4vKipcbiAqIERlY29kZSBhIHN0cmluZyB0aGF0IG1pZ2h0IGluY2x1ZGUgb25lIG9yIHNldmVyYWwgbWltZSB3b3Jkc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIGluY2x1ZGluZyBzb21lIG1pbWUgd29yZHMgdGhhdCB3aWxsIGJlIGVuY29kZWRcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRzRGVjb2RlIChzdHIgPSAnJykge1xuICBzdHIgPSBzdHIudG9TdHJpbmcoKS5yZXBsYWNlKC8oPVxcP1teP10rXFw/W1FxQmJdXFw/W14/XStcXD89KVxccysoPz09XFw/W14/XStcXD9bUXFCYl1cXD9bXj9dKlxcPz0pL2csICckMScpXG4gIHN0ciA9IHN0ci5yZXBsYWNlKC9cXD89PVxcP1t1VV1bdFRdW2ZGXS04XFw/W1FxQmJdXFw/L2csICcnKSAvLyBqb2luIGJ5dGVzIG9mIG11bHRpLWJ5dGUgVVRGLThcbiAgc3RyID0gc3RyLnJlcGxhY2UoLz1cXD9bXFx3X1xcLSpdK1xcP1tRcUJiXVxcP1teP10qXFw/PS9nLCBtaW1lV29yZCA9PiBtaW1lV29yZERlY29kZShtaW1lV29yZC5yZXBsYWNlKC9cXHMrL2csICcnKSkpXG5cbiAgcmV0dXJuIHN0clxufVxuXG4vKipcbiAqIEZvbGRzIGxvbmcgbGluZXMsIHVzZWZ1bCBmb3IgZm9sZGluZyBoZWFkZXIgbGluZXMgKGFmdGVyU3BhY2U9ZmFsc2UpIGFuZFxuICogZmxvd2VkIHRleHQgKGFmdGVyU3BhY2U9dHJ1ZSlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBiZSBmb2xkZWRcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gYWZ0ZXJTcGFjZSBJZiB0cnVlLCBsZWF2ZSBhIHNwYWNlIGluIHRoIGVuZCBvZiBhIGxpbmVcbiAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggZm9sZGVkIGxpbmVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb2xkTGluZXMgKHN0ciA9ICcnLCBhZnRlclNwYWNlKSB7XG4gIGxldCBwb3MgPSAwXG4gIGNvbnN0IGxlbiA9IHN0ci5sZW5ndGhcbiAgbGV0IHJlc3VsdCA9ICcnXG4gIGxldCBsaW5lLCBtYXRjaFxuXG4gIHdoaWxlIChwb3MgPCBsZW4pIHtcbiAgICBsaW5lID0gc3RyLnN1YnN0cihwb3MsIE1BWF9MSU5FX0xFTkdUSClcbiAgICBpZiAobGluZS5sZW5ndGggPCBNQVhfTElORV9MRU5HVEgpIHtcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBicmVha1xuICAgIH1cbiAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvXlteXFxuXFxyXSooXFxyP1xcbnxcXHIpLykpKSB7XG4gICAgICBsaW5lID0gbWF0Y2hbMF1cbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxzKylbXlxcc10qJC8pKSAmJiBtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkgPCBsaW5lLmxlbmd0aCkge1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIChhZnRlclNwYWNlID8gKG1hdGNoWzFdIHx8ICcnKS5sZW5ndGggOiAwKSkpXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBzdHIuc3Vic3RyKHBvcyArIGxpbmUubGVuZ3RoKS5tYXRjaCgvXlteXFxzXSsoXFxzKikvKSkpIHtcbiAgICAgIGxpbmUgPSBsaW5lICsgbWF0Y2hbMF0uc3Vic3RyKDAsIG1hdGNoWzBdLmxlbmd0aCAtICghYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpXG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGxpbmVcbiAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICBpZiAocG9zIDwgbGVuKSB7XG4gICAgICByZXN1bHQgKz0gJ1xcclxcbidcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbi8qKlxuICogRW5jb2RlcyBhbmQgZm9sZHMgYSBoZWFkZXIgbGluZSBmb3IgYSBNSU1FIG1lc3NhZ2UgaGVhZGVyLlxuICogU2hvcnRoYW5kIGZvciBtaW1lV29yZHNFbmNvZGUgKyBmb2xkTGluZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSBuYW1lLCB3aWxsIG5vdCBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSB2YWx1ZSBWYWx1ZSB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIENoYXJhY3RlciBzZXQgb2YgdGhlIHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IGVuY29kZWQgYW5kIGZvbGRlZCBoZWFkZXIgbGluZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZUVuY29kZSAoa2V5LCB2YWx1ZSwgZnJvbUNoYXJzZXQpIHtcbiAgdmFyIGVuY29kZWRWYWx1ZSA9IG1pbWVXb3Jkc0VuY29kZSh2YWx1ZSwgJ1EnLCBmcm9tQ2hhcnNldClcbiAgcmV0dXJuIGZvbGRMaW5lcyhrZXkgKyAnOiAnICsgZW5jb2RlZFZhbHVlKVxufVxuXG4vKipcbiAqIFRoZSByZXN1bHQgaXMgbm90IG1pbWUgd29yZCBkZWNvZGVkLCB5b3UgbmVlZCB0byBkbyB5b3VyIG93biBkZWNvZGluZyBiYXNlZFxuICogb24gdGhlIHJ1bGVzIGZvciB0aGUgc3BlY2lmaWMgaGVhZGVyIGtleVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJMaW5lIFNpbmdsZSBoZWFkZXIgbGluZSwgbWlnaHQgaW5jbHVkZSBsaW5lYnJlYWtzIGFzIHdlbGwgaWYgZm9sZGVkXG4gKiBAcmV0dXJuIHtPYmplY3R9IEFuZCBvYmplY3Qgb2Yge2tleSwgdmFsdWV9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkZXJMaW5lRGVjb2RlIChoZWFkZXJMaW5lID0gJycpIHtcbiAgY29uc3QgbGluZSA9IGhlYWRlckxpbmUudG9TdHJpbmcoKS5yZXBsYWNlKC8oPzpcXHI/XFxufFxccilbIFxcdF0qL2csICcgJykudHJpbSgpXG4gIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyooW146XSspOiguKikkLylcblxuICByZXR1cm4ge1xuICAgIGtleTogKChtYXRjaCAmJiBtYXRjaFsxXSkgfHwgJycpLnRyaW0oKSxcbiAgICB2YWx1ZTogKChtYXRjaCAmJiBtYXRjaFsyXSkgfHwgJycpLnRyaW0oKVxuICB9XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgb2YgaGVhZGVyIGxpbmVzLiBEb2VzIG5vdCBkZWNvZGUgbWltZSB3b3JkcyBhcyBldmVyeVxuICogaGVhZGVyIG1pZ2h0IGhhdmUgaXRzIG93biBydWxlcyAoZWcuIGZvcm1hdHRlZCBlbWFpbCBhZGRyZXNzZXMgYW5kIHN1Y2gpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlcnMgSGVhZGVycyBzdHJpbmdcbiAqIEByZXR1cm4ge09iamVjdH0gQW4gb2JqZWN0IG9mIGhlYWRlcnMsIHdoZXJlIGhlYWRlciBrZXlzIGFyZSBvYmplY3Qga2V5cy4gTkIhIFNldmVyYWwgdmFsdWVzIHdpdGggdGhlIHNhbWUga2V5IG1ha2UgdXAgYW4gQXJyYXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVzRGVjb2RlIChoZWFkZXJzKSB7XG4gIGNvbnN0IGxpbmVzID0gaGVhZGVycy5zcGxpdCgvXFxyP1xcbnxcXHIvKVxuICBjb25zdCBoZWFkZXJzT2JqID0ge31cblxuICBmb3IgKGxldCBpID0gbGluZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoaSAmJiBsaW5lc1tpXS5tYXRjaCgvXlxccy8pKSB7XG4gICAgICBsaW5lc1tpIC0gMV0gKz0gJ1xcclxcbicgKyBsaW5lc1tpXVxuICAgICAgbGluZXMuc3BsaWNlKGksIDEpXG4gICAgfVxuICB9XG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3QgaGVhZGVyID0gaGVhZGVyTGluZURlY29kZShsaW5lc1tpXSlcbiAgICBjb25zdCBrZXkgPSBoZWFkZXIua2V5LnRvTG93ZXJDYXNlKClcbiAgICBjb25zdCB2YWx1ZSA9IGhlYWRlci52YWx1ZVxuXG4gICAgaWYgKCFoZWFkZXJzT2JqW2tleV0pIHtcbiAgICAgIGhlYWRlcnNPYmpba2V5XSA9IHZhbHVlXG4gICAgfSBlbHNlIHtcbiAgICAgIGhlYWRlcnNPYmpba2V5XSA9IFtdLmNvbmNhdChoZWFkZXJzT2JqW2tleV0sIHZhbHVlKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBoZWFkZXJzT2JqXG59XG5cbi8qKlxuICogUGFyc2VzIGEgaGVhZGVyIHZhbHVlIHdpdGgga2V5PXZhbHVlIGFyZ3VtZW50cyBpbnRvIGEgc3RydWN0dXJlZFxuICogb2JqZWN0LlxuICpcbiAqICAgcGFyc2VIZWFkZXJWYWx1ZSgnY29udGVudC10eXBlOiB0ZXh0L3BsYWluOyBDSEFSU0VUPSdVVEYtOCcnKSAtPlxuICogICB7XG4gKiAgICAgJ3ZhbHVlJzogJ3RleHQvcGxhaW4nLFxuICogICAgICdwYXJhbXMnOiB7XG4gKiAgICAgICAnY2hhcnNldCc6ICdVVEYtOCdcbiAqICAgICB9XG4gKiAgIH1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEhlYWRlciB2YWx1ZVxuICogQHJldHVybiB7T2JqZWN0fSBIZWFkZXIgdmFsdWUgYXMgYSBwYXJzZWQgc3RydWN0dXJlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhlYWRlclZhbHVlIChzdHIpIHtcbiAgbGV0IHJlc3BvbnNlID0ge1xuICAgIHZhbHVlOiBmYWxzZSxcbiAgICBwYXJhbXM6IHt9XG4gIH1cbiAgbGV0IGtleSA9IGZhbHNlXG4gIGxldCB2YWx1ZSA9ICcnXG4gIGxldCB0eXBlID0gJ3ZhbHVlJ1xuICBsZXQgcXVvdGUgPSBmYWxzZVxuICBsZXQgZXNjYXBlZCA9IGZhbHNlXG4gIGxldCBjaHJcblxuICBmb3IgKGxldCBpID0gMCwgbGVuID0gc3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY2hyID0gc3RyLmNoYXJBdChpKVxuICAgIGlmICh0eXBlID09PSAna2V5Jykge1xuICAgICAgaWYgKGNociA9PT0gJz0nKSB7XG4gICAgICAgIGtleSA9IHZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIHR5cGUgPSAndmFsdWUnXG4gICAgICAgIHZhbHVlID0gJydcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cbiAgICAgIHZhbHVlICs9IGNoclxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZXNjYXBlZCkge1xuICAgICAgICB2YWx1ZSArPSBjaHJcbiAgICAgIH0gZWxzZSBpZiAoY2hyID09PSAnXFxcXCcpIHtcbiAgICAgICAgZXNjYXBlZCA9IHRydWVcbiAgICAgICAgY29udGludWVcbiAgICAgIH0gZWxzZSBpZiAocXVvdGUgJiYgY2hyID09PSBxdW90ZSkge1xuICAgICAgICBxdW90ZSA9IGZhbHNlXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICdcIicpIHtcbiAgICAgICAgcXVvdGUgPSBjaHJcbiAgICAgIH0gZWxzZSBpZiAoIXF1b3RlICYmIGNociA9PT0gJzsnKSB7XG4gICAgICAgIGlmIChrZXkgPT09IGZhbHNlKSB7XG4gICAgICAgICAgcmVzcG9uc2UudmFsdWUgPSB2YWx1ZS50cmltKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlLnRyaW0oKVxuICAgICAgICB9XG4gICAgICAgIHR5cGUgPSAna2V5J1xuICAgICAgICB2YWx1ZSA9ICcnXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSArPSBjaHJcbiAgICAgIH1cbiAgICAgIGVzY2FwZWQgPSBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlID09PSAndmFsdWUnKSB7XG4gICAgaWYgKGtleSA9PT0gZmFsc2UpIHtcbiAgICAgIHJlc3BvbnNlLnZhbHVlID0gdmFsdWUudHJpbSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gdmFsdWUudHJpbSgpXG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbHVlLnRyaW0oKSkge1xuICAgIHJlc3BvbnNlLnBhcmFtc1t2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKV0gPSAnJ1xuICB9XG5cbiAgLy8gaGFuZGxlIHBhcmFtZXRlciB2YWx1ZSBjb250aW51YXRpb25zXG4gIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMjMxI3NlY3Rpb24tM1xuXG4gIC8vIHByZXByb2Nlc3MgdmFsdWVzXG4gIE9iamVjdC5rZXlzKHJlc3BvbnNlLnBhcmFtcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdmFyIGFjdHVhbEtleSwgbnIsIG1hdGNoLCB2YWx1ZVxuICAgIGlmICgobWF0Y2ggPSBrZXkubWF0Y2goLyhcXCooXFxkKyl8XFwqKFxcZCspXFwqfFxcKikkLykpKSB7XG4gICAgICBhY3R1YWxLZXkgPSBrZXkuc3Vic3RyKDAsIG1hdGNoLmluZGV4KVxuICAgICAgbnIgPSBOdW1iZXIobWF0Y2hbMl0gfHwgbWF0Y2hbM10pIHx8IDBcblxuICAgICAgaWYgKCFyZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSB8fCB0eXBlb2YgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldID0ge1xuICAgICAgICAgIGNoYXJzZXQ6IGZhbHNlLFxuICAgICAgICAgIHZhbHVlczogW11cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YWx1ZSA9IHJlc3BvbnNlLnBhcmFtc1trZXldXG5cbiAgICAgIGlmIChuciA9PT0gMCAmJiBtYXRjaFswXS5zdWJzdHIoLTEpID09PSAnKicgJiYgKG1hdGNoID0gdmFsdWUubWF0Y2goL14oW14nXSopJ1teJ10qJyguKikkLykpKSB7XG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldLmNoYXJzZXQgPSBtYXRjaFsxXSB8fCAnaXNvLTg4NTktMSdcbiAgICAgICAgdmFsdWUgPSBtYXRjaFsyXVxuICAgICAgfVxuXG4gICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS52YWx1ZXNbbnJdID0gdmFsdWVcblxuICAgICAgLy8gcmVtb3ZlIHRoZSBvbGQgcmVmZXJlbmNlXG4gICAgICBkZWxldGUgcmVzcG9uc2UucGFyYW1zW2tleV1cbiAgICB9XG4gIH0pXG5cbiAgLy8gY29uY2F0ZW5hdGUgc3BsaXQgcmZjMjIzMSBzdHJpbmdzIGFuZCBjb252ZXJ0IGVuY29kZWQgc3RyaW5ncyB0byBtaW1lIGVuY29kZWQgd29yZHNcbiAgT2JqZWN0LmtleXMocmVzcG9uc2UucGFyYW1zKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICB2YXIgdmFsdWVcbiAgICBpZiAocmVzcG9uc2UucGFyYW1zW2tleV0gJiYgQXJyYXkuaXNBcnJheShyZXNwb25zZS5wYXJhbXNba2V5XS52YWx1ZXMpKSB7XG4gICAgICB2YWx1ZSA9IHJlc3BvbnNlLnBhcmFtc1trZXldLnZhbHVlcy5tYXAoZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICByZXR1cm4gdmFsIHx8ICcnXG4gICAgICB9KS5qb2luKCcnKVxuXG4gICAgICBpZiAocmVzcG9uc2UucGFyYW1zW2tleV0uY2hhcnNldCkge1xuICAgICAgICAvLyBjb252ZXJ0IFwiJUFCXCIgdG8gXCI9P2NoYXJzZXQ/UT89QUI/PVwiXG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gJz0/JyArIHJlc3BvbnNlLnBhcmFtc1trZXldLmNoYXJzZXQgKyAnP1E/JyArIHZhbHVlXG4gICAgICAgICAgLnJlcGxhY2UoL1s9P19cXHNdL2csIGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgICAvLyBmaXggaW52YWxpZGx5IGVuY29kZWQgY2hhcnNcbiAgICAgICAgICAgIHZhciBjID0gcy5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgcmV0dXJuIHMgPT09ICcgJyA/ICdfJyA6ICclJyArIChjLmxlbmd0aCA8IDIgPyAnMCcgOiAnJykgKyBjXG4gICAgICAgICAgfSlcbiAgICAgICAgICAucmVwbGFjZSgvJS9nLCAnPScpICsgJz89JyAvLyBjaGFuZ2UgZnJvbSB1cmxlbmNvZGluZyB0byBwZXJjZW50IGVuY29kaW5nXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBQYXJhbWV0ZXIgVmFsdWUgQ29udGludWF0aW9uIGVuY29kaW5nIChyZmMyMjMxKVxuICogVXNlZnVsIGZvciBzcGxpdHRpbmcgbG9uZyBwYXJhbWV0ZXIgdmFsdWVzLlxuICpcbiAqIEZvciBleGFtcGxlXG4gKiAgICAgIHRpdGxlPVwidW5pY29kZSBzdHJpbmdcIlxuICogYmVjb21lc1xuICogICAgIHRpdGxlKjAqPVwidXRmLTgnJ3VuaWNvZGVcIlxuICogICAgIHRpdGxlKjEqPVwiJTIwc3RyaW5nXCJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge051bWJlcn0gW21heExlbmd0aD01MF0gTWF4IGxlbmd0aCBmb3IgZ2VuZXJhdGVkIGNodW5rc1xuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7QXJyYXl9IEEgbGlzdCBvZiBlbmNvZGVkIGtleXMgYW5kIGhlYWRlcnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnRpbnVhdGlvbkVuY29kZSAoa2V5LCBkYXRhLCBtYXhMZW5ndGgsIGZyb21DaGFyc2V0KSB7XG4gIGNvbnN0IGxpc3QgPSBbXVxuICB2YXIgZW5jb2RlZFN0ciA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gIHZhciBsaW5lXG4gIHZhciBzdGFydFBvcyA9IDBcbiAgdmFyIGlzRW5jb2RlZCA9IGZhbHNlXG5cbiAgbWF4TGVuZ3RoID0gbWF4TGVuZ3RoIHx8IDUwXG5cbiAgLy8gcHJvY2VzcyBhc2NpaSBvbmx5IHRleHRcbiAgaWYgKC9eW1xcdy5cXC0gXSokLy50ZXN0KGRhdGEpKSB7XG4gICAgLy8gY2hlY2sgaWYgY29udmVyc2lvbiBpcyBldmVuIG5lZWRlZFxuICAgIGlmIChlbmNvZGVkU3RyLmxlbmd0aCA8PSBtYXhMZW5ndGgpIHtcbiAgICAgIHJldHVybiBbe1xuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgdmFsdWU6IC9bXFxzXCI7PV0vLnRlc3QoZW5jb2RlZFN0cikgPyAnXCInICsgZW5jb2RlZFN0ciArICdcIicgOiBlbmNvZGVkU3RyXG4gICAgICB9XVxuICAgIH1cblxuICAgIGVuY29kZWRTdHIgPSBlbmNvZGVkU3RyLnJlcGxhY2UobmV3IFJlZ0V4cCgnLnsnICsgbWF4TGVuZ3RoICsgJ30nLCAnZycpLCBmdW5jdGlvbiAoc3RyKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBzdHJcbiAgICAgIH0pXG4gICAgICByZXR1cm4gJydcbiAgICB9KVxuXG4gICAgaWYgKGVuY29kZWRTdHIpIHtcbiAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgIGxpbmU6IGVuY29kZWRTdHJcbiAgICAgIH0pXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIGZpcnN0IGxpbmUgaW5jbHVkZXMgdGhlIGNoYXJzZXQgYW5kIGxhbmd1YWdlIGluZm8gYW5kIG5lZWRzIHRvIGJlIGVuY29kZWRcbiAgICAvLyBldmVuIGlmIGl0IGRvZXMgbm90IGNvbnRhaW4gYW55IHVuaWNvZGUgY2hhcmFjdGVyc1xuICAgIGxpbmUgPSAndXRmLThcXCdcXCcnXG4gICAgaXNFbmNvZGVkID0gdHJ1ZVxuICAgIHN0YXJ0UG9zID0gMFxuICAgIC8vIHByb2Nlc3MgdGV4dCB3aXRoIHVuaWNvZGUgb3Igc3BlY2lhbCBjaGFyc1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBlbmNvZGVkU3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBsZXQgY2hyID0gZW5jb2RlZFN0cltpXVxuXG4gICAgICBpZiAoaXNFbmNvZGVkKSB7XG4gICAgICAgIGNociA9IGVuY29kZVVSSUNvbXBvbmVudChjaHIpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB0cnkgdG8gdXJsZW5jb2RlIGN1cnJlbnQgY2hhclxuICAgICAgICBjaHIgPSBjaHIgPT09ICcgJyA/IGNociA6IGVuY29kZVVSSUNvbXBvbmVudChjaHIpXG4gICAgICAgIC8vIEJ5IGRlZmF1bHQgaXQgaXMgbm90IHJlcXVpcmVkIHRvIGVuY29kZSBhIGxpbmUsIHRoZSBuZWVkXG4gICAgICAgIC8vIG9ubHkgYXBwZWFycyB3aGVuIHRoZSBzdHJpbmcgY29udGFpbnMgdW5pY29kZSBvciBzcGVjaWFsIGNoYXJzXG4gICAgICAgIC8vIGluIHRoaXMgY2FzZSB3ZSBzdGFydCBwcm9jZXNzaW5nIHRoZSBsaW5lIG92ZXIgYW5kIGVuY29kZSBhbGwgY2hhcnNcbiAgICAgICAgaWYgKGNociAhPT0gZW5jb2RlZFN0cltpXSkge1xuICAgICAgICAgIC8vIENoZWNrIGlmIGl0IGlzIGV2ZW4gcG9zc2libGUgdG8gYWRkIHRoZSBlbmNvZGVkIGNoYXIgdG8gdGhlIGxpbmVcbiAgICAgICAgICAvLyBJZiBub3QsIHRoZXJlIGlzIG5vIHJlYXNvbiB0byB1c2UgdGhpcyBsaW5lLCBqdXN0IHB1c2ggaXQgdG8gdGhlIGxpc3RcbiAgICAgICAgICAvLyBhbmQgc3RhcnQgYSBuZXcgbGluZSB3aXRoIHRoZSBjaGFyIHRoYXQgbmVlZHMgZW5jb2RpbmdcbiAgICAgICAgICBpZiAoKGVuY29kZVVSSUNvbXBvbmVudChsaW5lKSArIGNocikubGVuZ3RoID49IG1heExlbmd0aCkge1xuICAgICAgICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgbGluZTogbGluZSxcbiAgICAgICAgICAgICAgZW5jb2RlZDogaXNFbmNvZGVkXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgbGluZSA9ICcnXG4gICAgICAgICAgICBzdGFydFBvcyA9IGkgLSAxXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlzRW5jb2RlZCA9IHRydWVcbiAgICAgICAgICAgIGkgPSBzdGFydFBvc1xuICAgICAgICAgICAgbGluZSA9ICcnXG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBpZiB0aGUgbGluZSBpcyBhbHJlYWR5IHRvbyBsb25nLCBwdXNoIGl0IHRvIHRoZSBsaXN0IGFuZCBzdGFydCBhIG5ldyBvbmVcbiAgICAgIGlmICgobGluZSArIGNocikubGVuZ3RoID49IG1heExlbmd0aCkge1xuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgICAgZW5jb2RlZDogaXNFbmNvZGVkXG4gICAgICAgIH0pXG4gICAgICAgIGxpbmUgPSBjaHIgPSBlbmNvZGVkU3RyW2ldID09PSAnICcgPyAnICcgOiBlbmNvZGVVUklDb21wb25lbnQoZW5jb2RlZFN0cltpXSlcbiAgICAgICAgaWYgKGNociA9PT0gZW5jb2RlZFN0cltpXSkge1xuICAgICAgICAgIGlzRW5jb2RlZCA9IGZhbHNlXG4gICAgICAgICAgc3RhcnRQb3MgPSBpIC0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlzRW5jb2RlZCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGluZSArPSBjaHJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGluZSkge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogbGluZSxcbiAgICAgICAgZW5jb2RlZDogaXNFbmNvZGVkXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaXN0Lm1hcChmdW5jdGlvbiAoaXRlbSwgaSkge1xuICAgIHJldHVybiB7XG4gICAgICAvLyBlbmNvZGVkIGxpbmVzOiB7bmFtZX0qe3BhcnR9KlxuICAgICAgLy8gdW5lbmNvZGVkIGxpbmVzOiB7bmFtZX0qe3BhcnR9XG4gICAgICAvLyBpZiBhbnkgbGluZSBuZWVkcyB0byBiZSBlbmNvZGVkIHRoZW4gdGhlIGZpcnN0IGxpbmUgKHBhcnQ9PTApIGlzIGFsd2F5cyBlbmNvZGVkXG4gICAgICBrZXk6IGtleSArICcqJyArIGkgKyAoaXRlbS5lbmNvZGVkID8gJyonIDogJycpLFxuICAgICAgdmFsdWU6IC9bXFxzXCI7PV0vLnRlc3QoaXRlbS5saW5lKSA/ICdcIicgKyBpdGVtLmxpbmUgKyAnXCInIDogaXRlbS5saW5lXG4gICAgfVxuICB9KVxufVxuXG4vKipcbiAqIFNwbGl0cyBhIG1pbWUgZW5jb2RlZCBzdHJpbmcuIE5lZWRlZCBmb3IgZGl2aWRpbmcgbWltZSB3b3JkcyBpbnRvIHNtYWxsZXIgY2h1bmtzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nIHRvIGJlIHNwbGl0IHVwXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4bGVuIE1heGltdW0gbGVuZ3RoIG9mIGNoYXJhY3RlcnMgZm9yIG9uZSBwYXJ0IChtaW5pbXVtIDEyKVxuICogQHJldHVybiB7QXJyYXl9IFNwbGl0IHN0cmluZ1xuICovXG5mdW5jdGlvbiBfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyAoc3RyLCBtYXhsZW4gPSAxMikge1xuICBjb25zdCBtaW5Xb3JkTGVuZ3RoID0gMTIgLy8gcmVxdWlyZSBhdCBsZWFzdCAxMiBzeW1ib2xzIHRvIGZpdCBwb3NzaWJsZSA0IG9jdGV0IFVURi04IHNlcXVlbmNlc1xuICBjb25zdCBtYXhXb3JkTGVuZ3RoID0gTWF0aC5tYXgobWF4bGVuLCBtaW5Xb3JkTGVuZ3RoKVxuICBjb25zdCBsaW5lcyA9IFtdXG5cbiAgd2hpbGUgKHN0ci5sZW5ndGgpIHtcbiAgICBsZXQgY3VyTGluZSA9IHN0ci5zdWJzdHIoMCwgbWF4V29yZExlbmd0aClcblxuICAgIGNvbnN0IG1hdGNoID0gY3VyTGluZS5tYXRjaCgvPVswLTlBLUZdPyQvaSkgLy8gc2tpcCBpbmNvbXBsZXRlIGVzY2FwZWQgY2hhclxuICAgIGlmIChtYXRjaCkge1xuICAgICAgY3VyTGluZSA9IGN1ckxpbmUuc3Vic3RyKDAsIG1hdGNoLmluZGV4KVxuICAgIH1cblxuICAgIGxldCBkb25lID0gZmFsc2VcbiAgICB3aGlsZSAoIWRvbmUpIHtcbiAgICAgIGxldCBjaHJcbiAgICAgIGRvbmUgPSB0cnVlXG4gICAgICBjb25zdCBtYXRjaCA9IHN0ci5zdWJzdHIoY3VyTGluZS5sZW5ndGgpLm1hdGNoKC9ePShbMC05QS1GXXsyfSkvaSkgLy8gY2hlY2sgaWYgbm90IG1pZGRsZSBvZiBhIHVuaWNvZGUgY2hhciBzZXF1ZW5jZVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNociA9IHBhcnNlSW50KG1hdGNoWzFdLCAxNilcbiAgICAgICAgLy8gaW52YWxpZCBzZXF1ZW5jZSwgbW92ZSBvbmUgY2hhciBiYWNrIGFuYyByZWNoZWNrXG4gICAgICAgIGlmIChjaHIgPCAweEMyICYmIGNociA+IDB4N0YpIHtcbiAgICAgICAgICBjdXJMaW5lID0gY3VyTGluZS5zdWJzdHIoMCwgY3VyTGluZS5sZW5ndGggLSAzKVxuICAgICAgICAgIGRvbmUgPSBmYWxzZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGN1ckxpbmUubGVuZ3RoKSB7XG4gICAgICBsaW5lcy5wdXNoKGN1ckxpbmUpXG4gICAgfVxuICAgIHN0ciA9IHN0ci5zdWJzdHIoY3VyTGluZS5sZW5ndGgpXG4gIH1cblxuICByZXR1cm4gbGluZXNcbn1cblxuZnVuY3Rpb24gX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzIChiYXNlNjRFbmNvZGVkU3RyID0gJycpIHtcbiAgcmV0dXJuIGJhc2U2NEVuY29kZWRTdHIudHJpbSgpLnJlcGxhY2UobmV3IFJlZ0V4cCgnLnsnICsgTUFYX0xJTkVfTEVOR1RIICsgJ30nLCAnZycpLCAnJCZcXHJcXG4nKS50cmltKClcbn1cblxuLyoqXG4gKiBBZGRzIHNvZnQgbGluZSBicmVha3ModGhlIG9uZXMgdGhhdCB3aWxsIGJlIHN0cmlwcGVkIG91dCB3aGVuIGRlY29kaW5nIFFQKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBxcEVuY29kZWRTdHIgU3RyaW5nIGluIFF1b3RlZC1QcmludGFibGUgZW5jb2RpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggZm9yY2VkIGxpbmUgYnJlYWtzXG4gKi9cbmZ1bmN0aW9uIF9hZGRRUFNvZnRMaW5lYnJlYWtzIChxcEVuY29kZWRTdHIgPSAnJykge1xuICBsZXQgcG9zID0gMFxuICBjb25zdCBsZW4gPSBxcEVuY29kZWRTdHIubGVuZ3RoXG4gIGNvbnN0IGxpbmVNYXJnaW4gPSBNYXRoLmZsb29yKE1BWF9MSU5FX0xFTkdUSCAvIDMpXG4gIGxldCByZXN1bHQgPSAnJ1xuICBsZXQgbWF0Y2gsIGxpbmVcblxuICAvLyBpbnNlcnQgc29mdCBsaW5lYnJlYWtzIHdoZXJlIG5lZWRlZFxuICB3aGlsZSAocG9zIDwgbGVuKSB7XG4gICAgbGluZSA9IHFwRW5jb2RlZFN0ci5zdWJzdHIocG9zLCBNQVhfTElORV9MRU5HVEgpXG4gICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goL1xcclxcbi8pKSkge1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAobGluZS5zdWJzdHIoLTEpID09PSAnXFxuJykge1xuICAgICAgLy8gbm90aGluZyB0byBjaGFuZ2UgaGVyZVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9IGVsc2UgaWYgKChtYXRjaCA9IGxpbmUuc3Vic3RyKC1saW5lTWFyZ2luKS5tYXRjaCgvXFxuLio/JC8pKSkge1xuICAgICAgLy8gdHJ1bmNhdGUgdG8gbmVhcmVzdCBsaW5lIGJyZWFrXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gMSkpXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAobGluZS5sZW5ndGggPiBNQVhfTElORV9MRU5HVEggLSBsaW5lTWFyZ2luICYmIChtYXRjaCA9IGxpbmUuc3Vic3RyKC1saW5lTWFyZ2luKS5tYXRjaCgvWyBcXHQuLCE/XVteIFxcdC4sIT9dKiQvKSkpIHtcbiAgICAgIC8vIHRydW5jYXRlIHRvIG5lYXJlc3Qgc3BhY2VcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAxKSlcbiAgICB9IGVsc2UgaWYgKGxpbmUuc3Vic3RyKC0xKSA9PT0gJ1xccicpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDEpXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChsaW5lLm1hdGNoKC89W1xcZGEtZl17MCwyfSQvaSkpIHtcbiAgICAgICAgLy8gcHVzaCBpbmNvbXBsZXRlIGVuY29kaW5nIHNlcXVlbmNlcyB0byB0aGUgbmV4dCBsaW5lXG4gICAgICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC89W1xcZGEtZl17MCwxfSQvaSkpKSB7XG4gICAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gbWF0Y2hbMF0ubGVuZ3RoKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW5zdXJlIHRoYXQgdXRmLTggc2VxdWVuY2VzIGFyZSBub3Qgc3BsaXRcbiAgICAgICAgd2hpbGUgKGxpbmUubGVuZ3RoID4gMyAmJiBsaW5lLmxlbmd0aCA8IGxlbiAtIHBvcyAmJiAhbGluZS5tYXRjaCgvXig/Oj1bXFxkYS1mXXsyfSl7MSw0fSQvaSkgJiYgKG1hdGNoID0gbGluZS5tYXRjaCgvPVtcXGRhLWZdezJ9JC9pZykpKSB7XG4gICAgICAgICAgY29uc3QgY29kZSA9IHBhcnNlSW50KG1hdGNoWzBdLnN1YnN0cigxLCAyKSwgMTYpXG4gICAgICAgICAgaWYgKGNvZGUgPCAxMjgpIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMylcblxuICAgICAgICAgIGlmIChjb2RlID49IDB4QzApIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvcyArIGxpbmUubGVuZ3RoIDwgbGVuICYmIGxpbmUuc3Vic3RyKC0xKSAhPT0gJ1xcbicpIHtcbiAgICAgIGlmIChsaW5lLmxlbmd0aCA9PT0gTUFYX0xJTkVfTEVOR1RIICYmIGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvaSkpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMylcbiAgICAgIH0gZWxzZSBpZiAobGluZS5sZW5ndGggPT09IE1BWF9MSU5FX0xFTkdUSCkge1xuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxuICAgICAgfVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBsaW5lICs9ICc9XFxyXFxuJ1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICB9XG5cbiAgICByZXN1bHQgKz0gbGluZVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5leHBvcnQgeyBkZWNvZGUsIGVuY29kZSwgY29udmVydCB9XG4iXX0=