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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMuanMiXSwibmFtZXMiOlsibWltZUVuY29kZSIsIm1pbWVEZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJiYXNlNjREZWNvZGUiLCJxdW90ZWRQcmludGFibGVFbmNvZGUiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsIm1pbWVXb3JkRGVjb2RlIiwibWltZVdvcmRzRGVjb2RlIiwiZm9sZExpbmVzIiwiaGVhZGVyTGluZUVuY29kZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lc0RlY29kZSIsInBhcnNlSGVhZGVyVmFsdWUiLCJjb250aW51YXRpb25FbmNvZGUiLCJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsIk1BWF9CNjRfTUlNRV9XT1JEX0JZVEVfTEVOR1RIIiwiZGF0YSIsImZyb21DaGFyc2V0IiwiYnVmZmVyIiwicmVkdWNlIiwiYWdncmVnYXRlIiwib3JkIiwiaW5kZXgiLCJfY2hlY2tSYW5nZXMiLCJsZW5ndGgiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJ0b1N0cmluZyIsInRvVXBwZXJDYXNlIiwibnIiLCJyYW5nZXMiLCJ2YWwiLCJyYW5nZSIsInN0ciIsImVuY29kZWRCeXRlc0NvdW50IiwibWF0Y2giLCJVaW50OEFycmF5IiwiaSIsImxlbiIsImJ1ZmZlclBvcyIsImhleCIsInN1YnN0ciIsImNociIsImNoYXJBdCIsInRlc3QiLCJwYXJzZUludCIsImNoYXJDb2RlQXQiLCJidWYiLCJiNjQiLCJfYWRkQmFzZTY0U29mdExpbmVicmVha3MiLCJtaW1lRW5jb2RlZFN0ciIsInJlcGxhY2UiLCJzcGFjZXMiLCJfYWRkUVBTb2Z0TGluZWJyZWFrcyIsInJhd1N0cmluZyIsIm1pbWVXb3JkRW5jb2RpbmciLCJwYXJ0cyIsImVuY29kZWRTdHIiLCJxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMiLCJfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyIsImoiLCJzdWJzdHJpbmciLCJwdXNoIiwibWFwIiwicHJlZml4Iiwic3VmZml4IiwicCIsImpvaW4iLCJ0cmltIiwicUVuY29kZSIsInJlZ2V4Iiwic3BsaXQiLCJzaGlmdCIsImVuY29kaW5nIiwibWltZVdvcmQiLCJhZnRlclNwYWNlIiwicG9zIiwicmVzdWx0IiwibGluZSIsImtleSIsInZhbHVlIiwiZW5jb2RlZFZhbHVlIiwiaGVhZGVyTGluZSIsImhlYWRlcnMiLCJsaW5lcyIsImhlYWRlcnNPYmoiLCJzcGxpY2UiLCJoZWFkZXIiLCJ0b0xvd2VyQ2FzZSIsImNvbmNhdCIsInJlc3BvbnNlIiwicGFyYW1zIiwidHlwZSIsInF1b3RlIiwiZXNjYXBlZCIsIk9iamVjdCIsImtleXMiLCJmb3JFYWNoIiwiYWN0dWFsS2V5IiwiTnVtYmVyIiwiY2hhcnNldCIsInZhbHVlcyIsIkFycmF5IiwiaXNBcnJheSIsInMiLCJjIiwibWF4TGVuZ3RoIiwibGlzdCIsInN0YXJ0UG9zIiwiaXNFbmNvZGVkIiwiUmVnRXhwIiwiZW5jb2RlVVJJQ29tcG9uZW50IiwiZW5jb2RlZCIsIml0ZW0iLCJtYXhsZW4iLCJtaW5Xb3JkTGVuZ3RoIiwibWF4V29yZExlbmd0aCIsIk1hdGgiLCJtYXgiLCJjdXJMaW5lIiwiZG9uZSIsImJhc2U2NEVuY29kZWRTdHIiLCJxcEVuY29kZWRTdHIiLCJsaW5lTWFyZ2luIiwiZmxvb3IiLCJjb2RlIiwiZGVjb2RlIiwiZW5jb2RlIiwiY29udmVydCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O1FBbUJnQkEsVSxHQUFBQSxVO1FBMEJBQyxVLEdBQUFBLFU7UUEwQkFDLFksR0FBQUEsWTtRQWFBQyxZLEdBQUFBLFk7UUFhQUMscUIsR0FBQUEscUI7UUFnQkFDLHFCLEdBQUFBLHFCO1FBaUJBQyxjLEdBQUFBLGM7UUFnREFDLGUsR0FBQUEsZTtRQVdBQyxjLEdBQUFBLGM7UUEwQkFDLGUsR0FBQUEsZTtRQWdCQUMsUyxHQUFBQSxTO1FBMENBQyxnQixHQUFBQSxn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T0EsS0FBS3JDLE1BQUwsQ0FBWSxDQUFaLEVBQWVxQyxLQUFLdEQsTUFBTCxHQUFjLENBQTdCLENBQVA7QUFDRCxPQUZELE1BRU8sSUFBSXNELEtBQUt0RCxNQUFMLEtBQWdCWCxlQUFwQixFQUFxQztBQUMxQ2lFLGVBQU9BLEtBQUtyQyxNQUFMLENBQVksQ0FBWixFQUFlcUMsS0FBS3RELE1BQUwsR0FBYyxDQUE3QixDQUFQO0FBQ0Q7QUFDRG9ELGFBQU9FLEtBQUt0RCxNQUFaO0FBQ0FzRCxjQUFRLE9BQVI7QUFDRCxLQVJELE1BUU87QUFDTEYsYUFBT0UsS0FBS3RELE1BQVo7QUFDRDs7QUFFRHFELGNBQVVDLElBQVY7QUFDRDs7QUFFRCxTQUFPRCxNQUFQO0FBQ0Q7O1FBRVFpRCxNO1FBQVFDLE07UUFBUUMsTyIsImZpbGUiOiJtaW1lY29kZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlbmNvZGUgYXMgZW5jb2RlQmFzZTY0LCBkZWNvZGUgYXMgZGVjb2RlQmFzZTY0LCBPVVRQVVRfVFlQRURfQVJSQVkgfSBmcm9tICdlbWFpbGpzLWJhc2U2NCdcbmltcG9ydCB7IGVuY29kZSwgZGVjb2RlLCBjb252ZXJ0IH0gZnJvbSAnLi9jaGFyc2V0J1xuaW1wb3J0IHsgcGlwZSB9IGZyb20gJ3JhbWRhJ1xuXG4vLyBMaW5lcyBjYW4ndCBiZSBsb25nZXIgdGhhbiA3NiArIDxDUj48TEY+ID0gNzggYnl0ZXNcbi8vIGh0dHA6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDUjc2VjdGlvbi02LjdcbmNvbnN0IE1BWF9MSU5FX0xFTkdUSCA9IDc2XG5jb25zdCBNQVhfTUlNRV9XT1JEX0xFTkdUSCA9IDUyXG5jb25zdCBNQVhfQjY0X01JTUVfV09SRF9CWVRFX0xFTkdUSCA9IDM5XG5cbi8qKlxuICogRW5jb2RlcyBhbGwgbm9uIHByaW50YWJsZSBhbmQgbm9uIGFzY2lpIGJ5dGVzIHRvID1YWCBmb3JtLCB3aGVyZSBYWCBpcyB0aGVcbiAqIGJ5dGUgdmFsdWUgaW4gaGV4LiBUaGlzIGZ1bmN0aW9uIGRvZXMgbm90IGNvbnZlcnQgbGluZWJyZWFrcyBldGMuIGl0XG4gKiBvbmx5IGVzY2FwZXMgY2hhcmFjdGVyIHNlcXVlbmNlc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgRWl0aGVyIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXlcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIGVuY29kaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVFbmNvZGUgKGRhdGEgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IGJ1ZmZlciA9IGNvbnZlcnQoZGF0YSwgZnJvbUNoYXJzZXQpXG4gIHJldHVybiBidWZmZXIucmVkdWNlKChhZ2dyZWdhdGUsIG9yZCwgaW5kZXgpID0+XG4gICAgX2NoZWNrUmFuZ2VzKG9yZCkgJiYgISgob3JkID09PSAweDIwIHx8IG9yZCA9PT0gMHgwOSkgJiYgKGluZGV4ID09PSBidWZmZXIubGVuZ3RoIC0gMSB8fCBidWZmZXJbaW5kZXggKyAxXSA9PT0gMHgwYSB8fCBidWZmZXJbaW5kZXggKyAxXSA9PT0gMHgwZCkpXG4gICAgICA/IGFnZ3JlZ2F0ZSArIFN0cmluZy5mcm9tQ2hhckNvZGUob3JkKSAvLyBpZiB0aGUgY2hhciBpcyBpbiBhbGxvd2VkIHJhbmdlLCB0aGVuIGtlZXAgYXMgaXMsIHVubGVzcyBpdCBpcyBhIHdzIGluIHRoZSBlbmQgb2YgYSBsaW5lXG4gICAgICA6IGFnZ3JlZ2F0ZSArICc9JyArIChvcmQgPCAweDEwID8gJzAnIDogJycpICsgb3JkLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpLCAnJylcblxuICBmdW5jdGlvbiBfY2hlY2tSYW5nZXMgKG5yKSB7XG4gICAgY29uc3QgcmFuZ2VzID0gWyAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NSNzZWN0aW9uLTYuN1xuICAgICAgWzB4MDldLCAvLyA8VEFCPlxuICAgICAgWzB4MEFdLCAvLyA8TEY+XG4gICAgICBbMHgwRF0sIC8vIDxDUj5cbiAgICAgIFsweDIwLCAweDNDXSwgLy8gPFNQPiFcIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5OjtcbiAgICAgIFsweDNFLCAweDdFXSAvLyA+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fVxuICAgIF1cbiAgICByZXR1cm4gcmFuZ2VzLnJlZHVjZSgodmFsLCByYW5nZSkgPT4gdmFsIHx8IChyYW5nZS5sZW5ndGggPT09IDEgJiYgbnIgPT09IHJhbmdlWzBdKSB8fCAocmFuZ2UubGVuZ3RoID09PSAyICYmIG5yID49IHJhbmdlWzBdICYmIG5yIDw9IHJhbmdlWzFdKSwgZmFsc2UpXG4gIH1cbn1cblxuLyoqXG4gKiBEZWNvZGVzIG1pbWUgZW5jb2RlZCBzdHJpbmcgdG8gYW4gdW5pY29kZSBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIGVuY29kaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVEZWNvZGUgKHN0ciA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgZW5jb2RlZEJ5dGVzQ291bnQgPSAoc3RyLm1hdGNoKC89W1xcZGEtZkEtRl17Mn0vZykgfHwgW10pLmxlbmd0aFxuICBsZXQgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoc3RyLmxlbmd0aCAtIGVuY29kZWRCeXRlc0NvdW50ICogMilcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3RyLmxlbmd0aCwgYnVmZmVyUG9zID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGhleCA9IHN0ci5zdWJzdHIoaSArIDEsIDIpXG4gICAgY29uc3QgY2hyID0gc3RyLmNoYXJBdChpKVxuICAgIGlmIChjaHIgPT09ICc9JyAmJiBoZXggJiYgL1tcXGRhLWZBLUZdezJ9Ly50ZXN0KGhleCkpIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBwYXJzZUludChoZXgsIDE2KVxuICAgICAgaSArPSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBjaHIuY2hhckNvZGVBdCgwKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZWNvZGUoYnVmZmVyLCBmcm9tQ2hhcnNldClcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIHR5cGVkIGFycmF5IG9mIGdpdmVuIGNoYXJzZXQgaW50byB1bmljb2RlXG4gKiBiYXNlNjQgc3RyaW5nLiBBbHNvIGFkZHMgbGluZSBicmVha3NcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyBvciB0eXBlZCBhcnJheSB0byBiZSBiYXNlNjQgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IEluaXRpYWwgY2hhcnNldCwgZS5nLiAnYmluYXJ5Jy4gRGVmYXVsdHMgdG8gJ1VURi04J1xuICogQHJldHVybiB7U3RyaW5nfSBCYXNlNjQgZW5jb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NEVuY29kZSAoZGF0YSwgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IGJ1ZiA9ICh0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycgJiYgZnJvbUNoYXJzZXQgPT09ICdiaW5hcnknKSA/IGRhdGEgOiBjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KVxuICBjb25zdCBiNjQgPSBlbmNvZGVCYXNlNjQoYnVmKVxuICByZXR1cm4gX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzKGI2NClcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgYmFzZTY0IHN0cmluZyBvZiBhbnkgY2hhcnNldCBpbnRvIGFuIHVuaWNvZGUgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBCYXNlNjQgZW5jb2RlZCBzdHJpbmdcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgYmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NERlY29kZSAoc3RyLCBmcm9tQ2hhcnNldCkge1xuICByZXR1cm4gZGVjb2RlKGRlY29kZUJhc2U2NChzdHIsIE9VVFBVVF9UWVBFRF9BUlJBWSksIGZyb21DaGFyc2V0KVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSBpbnRvIGEgcXVvdGVkIHByaW50YWJsZSBlbmNvZGluZ1xuICogVGhpcyBpcyBhbG1vc3QgdGhlIHNhbWUgYXMgbWltZUVuY29kZSwgZXhjZXB0IGxpbmUgYnJlYWtzIHdpbGwgYmUgY2hhbmdlZFxuICogYXMgd2VsbCB0byBlbnN1cmUgdGhhdCB0aGUgbGluZXMgYXJlIG5ldmVyIGxvbmdlciB0aGFuIGFsbG93ZWQgbGVuZ3RoXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBtaW1lIGVuY29kZVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBlbmNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVkUHJpbnRhYmxlRW5jb2RlIChkYXRhID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBtaW1lRW5jb2RlZFN0ciA9IG1pbWVFbmNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gICAgLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICdcXHJcXG4nKSAvLyBmaXggbGluZSBicmVha3MsIGVuc3VyZSA8Q1I+PExGPlxuICAgIC5yZXBsYWNlKC9bXFx0IF0rJC9nbSwgc3BhY2VzID0+IHNwYWNlcy5yZXBsYWNlKC8gL2csICc9MjAnKS5yZXBsYWNlKC9cXHQvZywgJz0wOScpKSAvLyByZXBsYWNlIHNwYWNlcyBpbiB0aGUgZW5kIG9mIGxpbmVzXG5cbiAgcmV0dXJuIF9hZGRRUFNvZnRMaW5lYnJlYWtzKG1pbWVFbmNvZGVkU3RyKSAvLyBhZGQgc29mdCBsaW5lIGJyZWFrcyB0byBlbnN1cmUgbGluZSBsZW5ndGhzIHNqb3J0ZXIgdGhhbiA3NiBieXRlc1xufVxuXG4vKipcbiAqIERlY29kZXMgYSBzdHJpbmcgZnJvbSBhIHF1b3RlZCBwcmludGFibGUgZW5jb2RpbmcuIFRoaXMgaXMgYWxtb3N0IHRoZVxuICogc2FtZSBhcyBtaW1lRGVjb2RlLCBleGNlcHQgbGluZSBicmVha3Mgd2lsbCBiZSBjaGFuZ2VkIGFzIHdlbGxcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmcgdG8gZGVjb2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIHN0cmluZ1xuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGRlY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBxdW90ZWRQcmludGFibGVEZWNvZGUgKHN0ciA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgcmF3U3RyaW5nID0gc3RyXG4gICAgLnJlcGxhY2UoL1tcXHQgXSskL2dtLCAnJykgLy8gcmVtb3ZlIGludmFsaWQgd2hpdGVzcGFjZSBmcm9tIHRoZSBlbmQgb2YgbGluZXNcbiAgICAucmVwbGFjZSgvPSg/Olxccj9cXG58JCkvZywgJycpIC8vIHJlbW92ZSBzb2Z0IGxpbmUgYnJlYWtzXG5cbiAgcmV0dXJuIG1pbWVEZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gYW4gVVRGLTggTUlNRSBXb3JkXG4gKiAgIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ3XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IG1pbWVXb3JkRW5jb2Rpbmc9J1EnIEVuY29kaW5nIGZvciB0aGUgbWltZSB3b3JkLCBlaXRoZXIgUSBvciBCXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBzaGFyYWN0ZXIgc2V0XG4gKiBAcmV0dXJuIHtTdHJpbmd9IFNpbmdsZSBvciBzZXZlcmFsIG1pbWUgd29yZHMgam9pbmVkIHRvZ2V0aGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZEVuY29kZSAoZGF0YSwgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGxldCBwYXJ0cyA9IFtdXG4gIGNvbnN0IHN0ciA9ICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpID8gZGF0YSA6IGRlY29kZShkYXRhLCBmcm9tQ2hhcnNldClcblxuICBpZiAobWltZVdvcmRFbmNvZGluZyA9PT0gJ1EnKSB7XG4gICAgY29uc3Qgc3RyID0gKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIGxldCBlbmNvZGVkU3RyID0gcGlwZShtaW1lRW5jb2RlLCBxRW5jb2RlRm9yYmlkZGVuSGVhZGVyQ2hhcnMpKHN0cilcbiAgICBwYXJ0cyA9IGVuY29kZWRTdHIubGVuZ3RoIDwgTUFYX01JTUVfV09SRF9MRU5HVEggPyBbZW5jb2RlZFN0cl0gOiBfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyhlbmNvZGVkU3RyLCBNQVhfTUlNRV9XT1JEX0xFTkdUSClcbiAgfSBlbHNlIHtcbiAgICAvLyBGaXRzIGFzIG11Y2ggYXMgcG9zc2libGUgaW50byBldmVyeSBsaW5lIHdpdGhvdXQgYnJlYWtpbmcgdXRmLTggbXVsdGlieXRlIGNoYXJhY3RlcnMnIG9jdGV0cyB1cCBhY3Jvc3MgbGluZXNcbiAgICBsZXQgaiA9IDBcbiAgICBsZXQgaSA9IDBcbiAgICB3aGlsZSAoaSA8IHN0ci5sZW5ndGgpIHtcbiAgICAgIGlmIChlbmNvZGUoc3RyLnN1YnN0cmluZyhqLCBpKSkubGVuZ3RoID4gTUFYX0I2NF9NSU1FX1dPUkRfQllURV9MRU5HVEgpIHtcbiAgICAgICAgLy8gd2Ugd2VudCBvbmUgY2hhcmFjdGVyIHRvbyBmYXIsIHN1YnN0cmluZyBhdCB0aGUgY2hhciBiZWZvcmVcbiAgICAgICAgcGFydHMucHVzaChzdHIuc3Vic3RyaW5nKGosIGkgLSAxKSlcbiAgICAgICAgaiA9IGkgLSAxXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpKytcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gYWRkIHRoZSByZW1haW5kZXIgb2YgdGhlIHN0cmluZ1xuICAgIHN0ci5zdWJzdHJpbmcoaikgJiYgcGFydHMucHVzaChzdHIuc3Vic3RyaW5nKGopKVxuICAgIHBhcnRzID0gcGFydHMubWFwKGVuY29kZSkubWFwKGVuY29kZUJhc2U2NClcbiAgfVxuXG4gIGNvbnN0IHByZWZpeCA9ICc9P1VURi04PycgKyBtaW1lV29yZEVuY29kaW5nICsgJz8nXG4gIGNvbnN0IHN1ZmZpeCA9ICc/PSAnXG4gIHJldHVybiBwYXJ0cy5tYXAocCA9PiBwcmVmaXggKyBwICsgc3VmZml4KS5qb2luKCcnKS50cmltKClcbn1cblxuLyoqXG4gKiBRLUVuY29kZXMgcmVtYWluaW5nIGZvcmJpZGRlbiBoZWFkZXIgY2hhcnNcbiAqICAgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDcjc2VjdGlvbi01XG4gKi9cbmNvbnN0IHFFbmNvZGVGb3JiaWRkZW5IZWFkZXJDaGFycyA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgY29uc3QgcUVuY29kZSA9IGNociA9PiBjaHIgPT09ICcgJyA/ICdfJyA6ICgnPScgKyAoY2hyLmNoYXJDb2RlQXQoMCkgPCAweDEwID8gJzAnIDogJycpICsgY2hyLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvW15hLXowLTkhKitcXC0vPV0vaWcsIHFFbmNvZGUpXG59XG5cbi8qKlxuICogRmluZHMgd29yZCBzZXF1ZW5jZXMgd2l0aCBub24gYXNjaWkgdGV4dCBhbmQgY29udmVydHMgdGhlc2UgdG8gbWltZSB3b3Jkc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBwb3NzaWJsZSBtaW1lIHdvcmRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZHNFbmNvZGUgKGRhdGEgPSAnJywgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IHJlZ2V4ID0gLyhbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKig/OlxccytbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKlxccyopPykrL2dcbiAgcmV0dXJuIGRlY29kZShjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KSkucmVwbGFjZShyZWdleCwgbWF0Y2ggPT4gbWF0Y2gubGVuZ3RoID8gbWltZVdvcmRFbmNvZGUobWF0Y2gsIG1pbWVXb3JkRW5jb2RpbmcsIGZyb21DaGFyc2V0KSA6ICcnKVxufVxuXG4vKipcbiAqIERlY29kZSBhIGNvbXBsZXRlIG1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSB3b3JkIGVuY29kZWQgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3JkRGVjb2RlIChzdHIgPSAnJykge1xuICBjb25zdCBtYXRjaCA9IHN0ci5tYXRjaCgvXj1cXD8oW1xcd19cXC0qXSspXFw/KFtRcUJiXSlcXD8oW14/XSspXFw/PSQvaSlcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIHN0clxuXG4gIC8vIFJGQzIyMzEgYWRkZWQgbGFuZ3VhZ2UgdGFnIHRvIHRoZSBlbmNvZGluZ1xuICAvLyBzZWU6IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMjMxI3NlY3Rpb24tNVxuICAvLyB0aGlzIGltcGxlbWVudGF0aW9uIHNpbGVudGx5IGlnbm9yZXMgdGhpcyB0YWdcbiAgY29uc3QgZnJvbUNoYXJzZXQgPSBtYXRjaFsxXS5zcGxpdCgnKicpLnNoaWZ0KClcbiAgY29uc3QgZW5jb2RpbmcgPSAobWF0Y2hbMl0gfHwgJ1EnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKClcbiAgY29uc3QgcmF3U3RyaW5nID0gKG1hdGNoWzNdIHx8ICcnKS5yZXBsYWNlKC9fL2csICcgJylcblxuICBpZiAoZW5jb2RpbmcgPT09ICdCJykge1xuICAgIHJldHVybiBiYXNlNjREZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIGlmIChlbmNvZGluZyA9PT0gJ1EnKSB7XG4gICAgcmV0dXJuIG1pbWVEZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyXG4gIH1cbn1cblxuLyoqXG4gKiBEZWNvZGUgYSBzdHJpbmcgdGhhdCBtaWdodCBpbmNsdWRlIG9uZSBvciBzZXZlcmFsIG1pbWUgd29yZHNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyBpbmNsdWRpbmcgc29tZSBtaW1lIHdvcmRzIHRoYXQgd2lsbCBiZSBlbmNvZGVkXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3Jkc0RlY29kZSAoc3RyID0gJycpIHtcbiAgc3RyID0gc3RyLnRvU3RyaW5nKCkucmVwbGFjZSgvKD1cXD9bXj9dK1xcP1tRcUJiXVxcP1teP10rXFw/PSlcXHMrKD89PVxcP1teP10rXFw/W1FxQmJdXFw/W14/XSpcXD89KS9nLCAnJDEnKVxuICBzdHIgPSBzdHIucmVwbGFjZSgvXFw/PT1cXD9bdVVdW3RUXVtmRl0tOFxcP1tRcUJiXVxcPy9nLCAnJykgLy8gam9pbiBieXRlcyBvZiBtdWx0aS1ieXRlIFVURi04XG4gIHN0ciA9IHN0ci5yZXBsYWNlKC89XFw/W1xcd19cXC0qXStcXD9bUXFCYl1cXD9bXj9dK1xcPz0vZywgbWltZVdvcmQgPT4gbWltZVdvcmREZWNvZGUobWltZVdvcmQucmVwbGFjZSgvXFxzKy9nLCAnJykpKVxuXG4gIHJldHVybiBzdHJcbn1cblxuLyoqXG4gKiBGb2xkcyBsb25nIGxpbmVzLCB1c2VmdWwgZm9yIGZvbGRpbmcgaGVhZGVyIGxpbmVzIChhZnRlclNwYWNlPWZhbHNlKSBhbmRcbiAqIGZsb3dlZCB0ZXh0IChhZnRlclNwYWNlPXRydWUpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gYmUgZm9sZGVkXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGFmdGVyU3BhY2UgSWYgdHJ1ZSwgbGVhdmUgYSBzcGFjZSBpbiB0aCBlbmQgb2YgYSBsaW5lXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIGZvbGRlZCBsaW5lc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZm9sZExpbmVzIChzdHIgPSAnJywgYWZ0ZXJTcGFjZSkge1xuICBsZXQgcG9zID0gMFxuICBjb25zdCBsZW4gPSBzdHIubGVuZ3RoXG4gIGxldCByZXN1bHQgPSAnJ1xuICBsZXQgbGluZSwgbWF0Y2hcblxuICB3aGlsZSAocG9zIDwgbGVuKSB7XG4gICAgbGluZSA9IHN0ci5zdWJzdHIocG9zLCBNQVhfTElORV9MRU5HVEgpXG4gICAgaWYgKGxpbmUubGVuZ3RoIDwgTUFYX0xJTkVfTEVOR1RIKSB7XG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goL15bXlxcblxccl0qKFxccj9cXG58XFxyKS8pKSkge1xuICAgICAgbGluZSA9IG1hdGNoWzBdXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvKFxccyspW15cXHNdKiQvKSkgJiYgbWF0Y2hbMF0ubGVuZ3RoIC0gKGFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApIDwgbGluZS5sZW5ndGgpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpKVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gc3RyLnN1YnN0cihwb3MgKyBsaW5lLmxlbmd0aCkubWF0Y2goL15bXlxcc10rKFxccyopLykpKSB7XG4gICAgICBsaW5lID0gbGluZSArIG1hdGNoWzBdLnN1YnN0cigwLCBtYXRjaFswXS5sZW5ndGggLSAoIWFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApKVxuICAgIH1cblxuICAgIHJlc3VsdCArPSBsaW5lXG4gICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgaWYgKHBvcyA8IGxlbikge1xuICAgICAgcmVzdWx0ICs9ICdcXHJcXG4nXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4vKipcbiAqIEVuY29kZXMgYW5kIGZvbGRzIGEgaGVhZGVyIGxpbmUgZm9yIGEgTUlNRSBtZXNzYWdlIGhlYWRlci5cbiAqIFNob3J0aGFuZCBmb3IgbWltZVdvcmRzRW5jb2RlICsgZm9sZExpbmVzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGtleSBLZXkgbmFtZSwgd2lsbCBub3QgYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gdmFsdWUgVmFsdWUgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBDaGFyYWN0ZXIgc2V0IG9mIHRoZSB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfSBlbmNvZGVkIGFuZCBmb2xkZWQgaGVhZGVyIGxpbmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVFbmNvZGUgKGtleSwgdmFsdWUsIGZyb21DaGFyc2V0KSB7XG4gIHZhciBlbmNvZGVkVmFsdWUgPSBtaW1lV29yZHNFbmNvZGUodmFsdWUsICdRJywgZnJvbUNoYXJzZXQpXG4gIHJldHVybiBmb2xkTGluZXMoa2V5ICsgJzogJyArIGVuY29kZWRWYWx1ZSlcbn1cblxuLyoqXG4gKiBUaGUgcmVzdWx0IGlzIG5vdCBtaW1lIHdvcmQgZGVjb2RlZCwgeW91IG5lZWQgdG8gZG8geW91ciBvd24gZGVjb2RpbmcgYmFzZWRcbiAqIG9uIHRoZSBydWxlcyBmb3IgdGhlIHNwZWNpZmljIGhlYWRlciBrZXlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVyTGluZSBTaW5nbGUgaGVhZGVyIGxpbmUsIG1pZ2h0IGluY2x1ZGUgbGluZWJyZWFrcyBhcyB3ZWxsIGlmIGZvbGRlZFxuICogQHJldHVybiB7T2JqZWN0fSBBbmQgb2JqZWN0IG9mIHtrZXksIHZhbHVlfVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZURlY29kZSAoaGVhZGVyTGluZSA9ICcnKSB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkZXJMaW5lLnRvU3RyaW5nKCkucmVwbGFjZSgvKD86XFxyP1xcbnxcXHIpWyBcXHRdKi9nLCAnICcpLnRyaW0oKVxuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqKFteOl0rKTooLiopJC8pXG5cbiAgcmV0dXJuIHtcbiAgICBrZXk6ICgobWF0Y2ggJiYgbWF0Y2hbMV0pIHx8ICcnKS50cmltKCksXG4gICAgdmFsdWU6ICgobWF0Y2ggJiYgbWF0Y2hbMl0pIHx8ICcnKS50cmltKClcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlcyBhIGJsb2NrIG9mIGhlYWRlciBsaW5lcy4gRG9lcyBub3QgZGVjb2RlIG1pbWUgd29yZHMgYXMgZXZlcnlcbiAqIGhlYWRlciBtaWdodCBoYXZlIGl0cyBvd24gcnVsZXMgKGVnLiBmb3JtYXR0ZWQgZW1haWwgYWRkcmVzc2VzIGFuZCBzdWNoKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJzIEhlYWRlcnMgc3RyaW5nXG4gKiBAcmV0dXJuIHtPYmplY3R9IEFuIG9iamVjdCBvZiBoZWFkZXJzLCB3aGVyZSBoZWFkZXIga2V5cyBhcmUgb2JqZWN0IGtleXMuIE5CISBTZXZlcmFsIHZhbHVlcyB3aXRoIHRoZSBzYW1lIGtleSBtYWtlIHVwIGFuIEFycmF5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkZXJMaW5lc0RlY29kZSAoaGVhZGVycykge1xuICBjb25zdCBsaW5lcyA9IGhlYWRlcnMuc3BsaXQoL1xccj9cXG58XFxyLylcbiAgY29uc3QgaGVhZGVyc09iaiA9IHt9XG5cbiAgZm9yIChsZXQgaSA9IGxpbmVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGkgJiYgbGluZXNbaV0ubWF0Y2goL15cXHMvKSkge1xuICAgICAgbGluZXNbaSAtIDFdICs9ICdcXHJcXG4nICsgbGluZXNbaV1cbiAgICAgIGxpbmVzLnNwbGljZShpLCAxKVxuICAgIH1cbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGhlYWRlciA9IGhlYWRlckxpbmVEZWNvZGUobGluZXNbaV0pXG4gICAgY29uc3Qga2V5ID0gaGVhZGVyLmtleS50b0xvd2VyQ2FzZSgpXG4gICAgY29uc3QgdmFsdWUgPSBoZWFkZXIudmFsdWVcblxuICAgIGlmICghaGVhZGVyc09ialtrZXldKSB7XG4gICAgICBoZWFkZXJzT2JqW2tleV0gPSB2YWx1ZVxuICAgIH0gZWxzZSB7XG4gICAgICBoZWFkZXJzT2JqW2tleV0gPSBbXS5jb25jYXQoaGVhZGVyc09ialtrZXldLCB2YWx1ZSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaGVhZGVyc09ialxufVxuXG4vKipcbiAqIFBhcnNlcyBhIGhlYWRlciB2YWx1ZSB3aXRoIGtleT12YWx1ZSBhcmd1bWVudHMgaW50byBhIHN0cnVjdHVyZWRcbiAqIG9iamVjdC5cbiAqXG4gKiAgIHBhcnNlSGVhZGVyVmFsdWUoJ2NvbnRlbnQtdHlwZTogdGV4dC9wbGFpbjsgQ0hBUlNFVD0nVVRGLTgnJykgLT5cbiAqICAge1xuICogICAgICd2YWx1ZSc6ICd0ZXh0L3BsYWluJyxcbiAqICAgICAncGFyYW1zJzoge1xuICogICAgICAgJ2NoYXJzZXQnOiAnVVRGLTgnXG4gKiAgICAgfVxuICogICB9XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBIZWFkZXIgdmFsdWVcbiAqIEByZXR1cm4ge09iamVjdH0gSGVhZGVyIHZhbHVlIGFzIGEgcGFyc2VkIHN0cnVjdHVyZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIZWFkZXJWYWx1ZSAoc3RyKSB7XG4gIGxldCByZXNwb25zZSA9IHtcbiAgICB2YWx1ZTogZmFsc2UsXG4gICAgcGFyYW1zOiB7fVxuICB9XG4gIGxldCBrZXkgPSBmYWxzZVxuICBsZXQgdmFsdWUgPSAnJ1xuICBsZXQgdHlwZSA9ICd2YWx1ZSdcbiAgbGV0IHF1b3RlID0gZmFsc2VcbiAgbGV0IGVzY2FwZWQgPSBmYWxzZVxuICBsZXQgY2hyXG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNociA9IHN0ci5jaGFyQXQoaSlcbiAgICBpZiAodHlwZSA9PT0gJ2tleScpIHtcbiAgICAgIGlmIChjaHIgPT09ICc9Jykge1xuICAgICAgICBrZXkgPSB2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKVxuICAgICAgICB0eXBlID0gJ3ZhbHVlJ1xuICAgICAgICB2YWx1ZSA9ICcnXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICB2YWx1ZSArPSBjaHJcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVzY2FwZWQpIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9IGVsc2UgaWYgKGNociA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGVzY2FwZWQgPSB0cnVlXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9IGVsc2UgaWYgKHF1b3RlICYmIGNociA9PT0gcXVvdGUpIHtcbiAgICAgICAgcXVvdGUgPSBmYWxzZVxuICAgICAgfSBlbHNlIGlmICghcXVvdGUgJiYgY2hyID09PSAnXCInKSB7XG4gICAgICAgIHF1b3RlID0gY2hyXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICc7Jykge1xuICAgICAgICBpZiAoa2V5ID09PSBmYWxzZSkge1xuICAgICAgICAgIHJlc3BvbnNlLnZhbHVlID0gdmFsdWUudHJpbSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZS50cmltKClcbiAgICAgICAgfVxuICAgICAgICB0eXBlID0gJ2tleSdcbiAgICAgICAgdmFsdWUgPSAnJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9XG4gICAgICBlc2NhcGVkID0gZmFsc2VcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZSA9PT0gJ3ZhbHVlJykge1xuICAgIGlmIChrZXkgPT09IGZhbHNlKSB7XG4gICAgICByZXNwb25zZS52YWx1ZSA9IHZhbHVlLnRyaW0oKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlLnRyaW0oKVxuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZS50cmltKCkpIHtcbiAgICByZXNwb25zZS5wYXJhbXNbdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCldID0gJydcbiAgfVxuXG4gIC8vIGhhbmRsZSBwYXJhbWV0ZXIgdmFsdWUgY29udGludWF0aW9uc1xuICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjIzMSNzZWN0aW9uLTNcblxuICAvLyBwcmVwcm9jZXNzIHZhbHVlc1xuICBPYmplY3Qua2V5cyhyZXNwb25zZS5wYXJhbXMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHZhciBhY3R1YWxLZXksIG5yLCBtYXRjaCwgdmFsdWVcbiAgICBpZiAoKG1hdGNoID0ga2V5Lm1hdGNoKC8oXFwqKFxcZCspfFxcKihcXGQrKVxcKnxcXCopJC8pKSkge1xuICAgICAgYWN0dWFsS2V5ID0ga2V5LnN1YnN0cigwLCBtYXRjaC5pbmRleClcbiAgICAgIG5yID0gTnVtYmVyKG1hdGNoWzJdIHx8IG1hdGNoWzNdKSB8fCAwXG5cbiAgICAgIGlmICghcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gfHwgdHlwZW9mIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSA9IHtcbiAgICAgICAgICBjaGFyc2V0OiBmYWxzZSxcbiAgICAgICAgICB2YWx1ZXM6IFtdXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XVxuXG4gICAgICBpZiAobnIgPT09IDAgJiYgbWF0Y2hbMF0uc3Vic3RyKC0xKSA9PT0gJyonICYmIChtYXRjaCA9IHZhbHVlLm1hdGNoKC9eKFteJ10qKSdbXiddKicoLiopJC8pKSkge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS5jaGFyc2V0ID0gbWF0Y2hbMV0gfHwgJ2lzby04ODU5LTEnXG4gICAgICAgIHZhbHVlID0gbWF0Y2hbMl1cbiAgICAgIH1cblxuICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0udmFsdWVzW25yXSA9IHZhbHVlXG5cbiAgICAgIC8vIHJlbW92ZSB0aGUgb2xkIHJlZmVyZW5jZVxuICAgICAgZGVsZXRlIHJlc3BvbnNlLnBhcmFtc1trZXldXG4gICAgfVxuICB9KVxuXG4gIC8vIGNvbmNhdGVuYXRlIHNwbGl0IHJmYzIyMzEgc3RyaW5ncyBhbmQgY29udmVydCBlbmNvZGVkIHN0cmluZ3MgdG8gbWltZSBlbmNvZGVkIHdvcmRzXG4gIE9iamVjdC5rZXlzKHJlc3BvbnNlLnBhcmFtcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdmFyIHZhbHVlXG4gICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldICYmIEFycmF5LmlzQXJyYXkocmVzcG9uc2UucGFyYW1zW2tleV0udmFsdWVzKSkge1xuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XS52YWx1ZXMubWFwKGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgcmV0dXJuIHZhbCB8fCAnJ1xuICAgICAgfSkuam9pbignJylcblxuICAgICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldLmNoYXJzZXQpIHtcbiAgICAgICAgLy8gY29udmVydCBcIiVBQlwiIHRvIFwiPT9jaGFyc2V0P1E/PUFCPz1cIlxuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9ICc9PycgKyByZXNwb25zZS5wYXJhbXNba2V5XS5jaGFyc2V0ICsgJz9RPycgKyB2YWx1ZVxuICAgICAgICAgIC5yZXBsYWNlKC9bPT9fXFxzXS9nLCBmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgLy8gZml4IGludmFsaWRseSBlbmNvZGVkIGNoYXJzXG4gICAgICAgICAgICB2YXIgYyA9IHMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNilcbiAgICAgICAgICAgIHJldHVybiBzID09PSAnICcgPyAnXycgOiAnJScgKyAoYy5sZW5ndGggPCAyID8gJzAnIDogJycpICsgY1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnJlcGxhY2UoLyUvZywgJz0nKSArICc/PScgLy8gY2hhbmdlIGZyb20gdXJsZW5jb2RpbmcgdG8gcGVyY2VudCBlbmNvZGluZ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gcmVzcG9uc2Vcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gYW4gVVRGLTggUGFyYW1ldGVyIFZhbHVlIENvbnRpbnVhdGlvbiBlbmNvZGluZyAocmZjMjIzMSlcbiAqIFVzZWZ1bCBmb3Igc3BsaXR0aW5nIGxvbmcgcGFyYW1ldGVyIHZhbHVlcy5cbiAqXG4gKiBGb3IgZXhhbXBsZVxuICogICAgICB0aXRsZT1cInVuaWNvZGUgc3RyaW5nXCJcbiAqIGJlY29tZXNcbiAqICAgICB0aXRsZSowKj1cInV0Zi04Jyd1bmljb2RlXCJcbiAqICAgICB0aXRsZSoxKj1cIiUyMHN0cmluZ1wiXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtOdW1iZXJ9IFttYXhMZW5ndGg9NTBdIE1heCBsZW5ndGggZm9yIGdlbmVyYXRlZCBjaHVua3NcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIHNoYXJhY3RlciBzZXRcbiAqIEByZXR1cm4ge0FycmF5fSBBIGxpc3Qgb2YgZW5jb2RlZCBrZXlzIGFuZCBoZWFkZXJzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb250aW51YXRpb25FbmNvZGUgKGtleSwgZGF0YSwgbWF4TGVuZ3RoLCBmcm9tQ2hhcnNldCkge1xuICBjb25zdCBsaXN0ID0gW11cbiAgdmFyIGVuY29kZWRTdHIgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICB2YXIgbGluZVxuICB2YXIgc3RhcnRQb3MgPSAwXG4gIHZhciBpc0VuY29kZWQgPSBmYWxzZVxuXG4gIG1heExlbmd0aCA9IG1heExlbmd0aCB8fCA1MFxuXG4gIC8vIHByb2Nlc3MgYXNjaWkgb25seSB0ZXh0XG4gIGlmICgvXltcXHcuXFwtIF0qJC8udGVzdChkYXRhKSkge1xuICAgIC8vIGNoZWNrIGlmIGNvbnZlcnNpb24gaXMgZXZlbiBuZWVkZWRcbiAgICBpZiAoZW5jb2RlZFN0ci5sZW5ndGggPD0gbWF4TGVuZ3RoKSB7XG4gICAgICByZXR1cm4gW3tcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGVuY29kZWRTdHIpID8gJ1wiJyArIGVuY29kZWRTdHIgKyAnXCInIDogZW5jb2RlZFN0clxuICAgICAgfV1cbiAgICB9XG5cbiAgICBlbmNvZGVkU3RyID0gZW5jb2RlZFN0ci5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIG1heExlbmd0aCArICd9JywgJ2cnKSwgZnVuY3Rpb24gKHN0cikge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogc3RyXG4gICAgICB9KVxuICAgICAgcmV0dXJuICcnXG4gICAgfSlcblxuICAgIGlmIChlbmNvZGVkU3RyKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBlbmNvZGVkU3RyXG4gICAgICB9KVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBmaXJzdCBsaW5lIGluY2x1ZGVzIHRoZSBjaGFyc2V0IGFuZCBsYW5ndWFnZSBpbmZvIGFuZCBuZWVkcyB0byBiZSBlbmNvZGVkXG4gICAgLy8gZXZlbiBpZiBpdCBkb2VzIG5vdCBjb250YWluIGFueSB1bmljb2RlIGNoYXJhY3RlcnNcbiAgICBsaW5lID0gJ3V0Zi04XFwnXFwnJ1xuICAgIGlzRW5jb2RlZCA9IHRydWVcbiAgICBzdGFydFBvcyA9IDBcbiAgICAvLyBwcm9jZXNzIHRleHQgd2l0aCB1bmljb2RlIG9yIHNwZWNpYWwgY2hhcnNcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZW5jb2RlZFN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGNociA9IGVuY29kZWRTdHJbaV1cblxuICAgICAgaWYgKGlzRW5jb2RlZCkge1xuICAgICAgICBjaHIgPSBlbmNvZGVVUklDb21wb25lbnQoY2hyKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdHJ5IHRvIHVybGVuY29kZSBjdXJyZW50IGNoYXJcbiAgICAgICAgY2hyID0gY2hyID09PSAnICcgPyBjaHIgOiBlbmNvZGVVUklDb21wb25lbnQoY2hyKVxuICAgICAgICAvLyBCeSBkZWZhdWx0IGl0IGlzIG5vdCByZXF1aXJlZCB0byBlbmNvZGUgYSBsaW5lLCB0aGUgbmVlZFxuICAgICAgICAvLyBvbmx5IGFwcGVhcnMgd2hlbiB0aGUgc3RyaW5nIGNvbnRhaW5zIHVuaWNvZGUgb3Igc3BlY2lhbCBjaGFyc1xuICAgICAgICAvLyBpbiB0aGlzIGNhc2Ugd2Ugc3RhcnQgcHJvY2Vzc2luZyB0aGUgbGluZSBvdmVyIGFuZCBlbmNvZGUgYWxsIGNoYXJzXG4gICAgICAgIGlmIChjaHIgIT09IGVuY29kZWRTdHJbaV0pIHtcbiAgICAgICAgICAvLyBDaGVjayBpZiBpdCBpcyBldmVuIHBvc3NpYmxlIHRvIGFkZCB0aGUgZW5jb2RlZCBjaGFyIHRvIHRoZSBsaW5lXG4gICAgICAgICAgLy8gSWYgbm90LCB0aGVyZSBpcyBubyByZWFzb24gdG8gdXNlIHRoaXMgbGluZSwganVzdCBwdXNoIGl0IHRvIHRoZSBsaXN0XG4gICAgICAgICAgLy8gYW5kIHN0YXJ0IGEgbmV3IGxpbmUgd2l0aCB0aGUgY2hhciB0aGF0IG5lZWRzIGVuY29kaW5nXG4gICAgICAgICAgaWYgKChlbmNvZGVVUklDb21wb25lbnQobGluZSkgKyBjaHIpLmxlbmd0aCA+PSBtYXhMZW5ndGgpIHtcbiAgICAgICAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGxpbmUgPSAnJ1xuICAgICAgICAgICAgc3RhcnRQb3MgPSBpIC0gMVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpc0VuY29kZWQgPSB0cnVlXG4gICAgICAgICAgICBpID0gc3RhcnRQb3NcbiAgICAgICAgICAgIGxpbmUgPSAnJ1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gaWYgdGhlIGxpbmUgaXMgYWxyZWFkeSB0b28gbG9uZywgcHVzaCBpdCB0byB0aGUgbGlzdCBhbmQgc3RhcnQgYSBuZXcgb25lXG4gICAgICBpZiAoKGxpbmUgKyBjaHIpLmxlbmd0aCA+PSBtYXhMZW5ndGgpIHtcbiAgICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgICBsaW5lOiBsaW5lLFxuICAgICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgICB9KVxuICAgICAgICBsaW5lID0gY2hyID0gZW5jb2RlZFN0cltpXSA9PT0gJyAnID8gJyAnIDogZW5jb2RlVVJJQ29tcG9uZW50KGVuY29kZWRTdHJbaV0pXG4gICAgICAgIGlmIChjaHIgPT09IGVuY29kZWRTdHJbaV0pIHtcbiAgICAgICAgICBpc0VuY29kZWQgPSBmYWxzZVxuICAgICAgICAgIHN0YXJ0UG9zID0gaSAtIDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpc0VuY29kZWQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpbmUgKz0gY2hyXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxpbmUpIHtcbiAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGlzdC5tYXAoZnVuY3Rpb24gKGl0ZW0sIGkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLy8gZW5jb2RlZCBsaW5lczoge25hbWV9KntwYXJ0fSpcbiAgICAgIC8vIHVuZW5jb2RlZCBsaW5lczoge25hbWV9KntwYXJ0fVxuICAgICAgLy8gaWYgYW55IGxpbmUgbmVlZHMgdG8gYmUgZW5jb2RlZCB0aGVuIHRoZSBmaXJzdCBsaW5lIChwYXJ0PT0wKSBpcyBhbHdheXMgZW5jb2RlZFxuICAgICAga2V5OiBrZXkgKyAnKicgKyBpICsgKGl0ZW0uZW5jb2RlZCA/ICcqJyA6ICcnKSxcbiAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGl0ZW0ubGluZSkgPyAnXCInICsgaXRlbS5saW5lICsgJ1wiJyA6IGl0ZW0ubGluZVxuICAgIH1cbiAgfSlcbn1cblxuLyoqXG4gKiBTcGxpdHMgYSBtaW1lIGVuY29kZWQgc3RyaW5nLiBOZWVkZWQgZm9yIGRpdmlkaW5nIG1pbWUgd29yZHMgaW50byBzbWFsbGVyIGNodW5rc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZyB0byBiZSBzcGxpdCB1cFxuICogQHBhcmFtIHtOdW1iZXJ9IG1heGxlbiBNYXhpbXVtIGxlbmd0aCBvZiBjaGFyYWN0ZXJzIGZvciBvbmUgcGFydCAobWluaW11bSAxMilcbiAqIEByZXR1cm4ge0FycmF5fSBTcGxpdCBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gX3NwbGl0TWltZUVuY29kZWRTdHJpbmcgKHN0ciwgbWF4bGVuID0gMTIpIHtcbiAgY29uc3QgbWluV29yZExlbmd0aCA9IDEyIC8vIHJlcXVpcmUgYXQgbGVhc3QgMTIgc3ltYm9scyB0byBmaXQgcG9zc2libGUgNCBvY3RldCBVVEYtOCBzZXF1ZW5jZXNcbiAgY29uc3QgbWF4V29yZExlbmd0aCA9IE1hdGgubWF4KG1heGxlbiwgbWluV29yZExlbmd0aClcbiAgY29uc3QgbGluZXMgPSBbXVxuXG4gIHdoaWxlIChzdHIubGVuZ3RoKSB7XG4gICAgbGV0IGN1ckxpbmUgPSBzdHIuc3Vic3RyKDAsIG1heFdvcmRMZW5ndGgpXG5cbiAgICBjb25zdCBtYXRjaCA9IGN1ckxpbmUubWF0Y2goLz1bMC05QS1GXT8kL2kpIC8vIHNraXAgaW5jb21wbGV0ZSBlc2NhcGVkIGNoYXJcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGN1ckxpbmUgPSBjdXJMaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleClcbiAgICB9XG5cbiAgICBsZXQgZG9uZSA9IGZhbHNlXG4gICAgd2hpbGUgKCFkb25lKSB7XG4gICAgICBsZXQgY2hyXG4gICAgICBkb25lID0gdHJ1ZVxuICAgICAgY29uc3QgbWF0Y2ggPSBzdHIuc3Vic3RyKGN1ckxpbmUubGVuZ3RoKS5tYXRjaCgvXj0oWzAtOUEtRl17Mn0pL2kpIC8vIGNoZWNrIGlmIG5vdCBtaWRkbGUgb2YgYSB1bmljb2RlIGNoYXIgc2VxdWVuY2VcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBjaHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTYpXG4gICAgICAgIC8vIGludmFsaWQgc2VxdWVuY2UsIG1vdmUgb25lIGNoYXIgYmFjayBhbmMgcmVjaGVja1xuICAgICAgICBpZiAoY2hyIDwgMHhDMiAmJiBjaHIgPiAweDdGKSB7XG4gICAgICAgICAgY3VyTGluZSA9IGN1ckxpbmUuc3Vic3RyKDAsIGN1ckxpbmUubGVuZ3RoIC0gMylcbiAgICAgICAgICBkb25lID0gZmFsc2VcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjdXJMaW5lLmxlbmd0aCkge1xuICAgICAgbGluZXMucHVzaChjdXJMaW5lKVxuICAgIH1cbiAgICBzdHIgPSBzdHIuc3Vic3RyKGN1ckxpbmUubGVuZ3RoKVxuICB9XG5cbiAgcmV0dXJuIGxpbmVzXG59XG5cbmZ1bmN0aW9uIF9hZGRCYXNlNjRTb2Z0TGluZWJyZWFrcyAoYmFzZTY0RW5jb2RlZFN0ciA9ICcnKSB7XG4gIHJldHVybiBiYXNlNjRFbmNvZGVkU3RyLnRyaW0oKS5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIE1BWF9MSU5FX0xFTkdUSCArICd9JywgJ2cnKSwgJyQmXFxyXFxuJykudHJpbSgpXG59XG5cbi8qKlxuICogQWRkcyBzb2Z0IGxpbmUgYnJlYWtzKHRoZSBvbmVzIHRoYXQgd2lsbCBiZSBzdHJpcHBlZCBvdXQgd2hlbiBkZWNvZGluZyBRUClcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcXBFbmNvZGVkU3RyIFN0cmluZyBpbiBRdW90ZWQtUHJpbnRhYmxlIGVuY29kaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIGZvcmNlZCBsaW5lIGJyZWFrc1xuICovXG5mdW5jdGlvbiBfYWRkUVBTb2Z0TGluZWJyZWFrcyAocXBFbmNvZGVkU3RyID0gJycpIHtcbiAgbGV0IHBvcyA9IDBcbiAgY29uc3QgbGVuID0gcXBFbmNvZGVkU3RyLmxlbmd0aFxuICBjb25zdCBsaW5lTWFyZ2luID0gTWF0aC5mbG9vcihNQVhfTElORV9MRU5HVEggLyAzKVxuICBsZXQgcmVzdWx0ID0gJydcbiAgbGV0IG1hdGNoLCBsaW5lXG5cbiAgLy8gaW5zZXJ0IHNvZnQgbGluZWJyZWFrcyB3aGVyZSBuZWVkZWRcbiAgd2hpbGUgKHBvcyA8IGxlbikge1xuICAgIGxpbmUgPSBxcEVuY29kZWRTdHIuc3Vic3RyKHBvcywgTUFYX0xJTkVfTEVOR1RIKVxuICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC9cXHJcXG4vKSkpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGxpbmUuc3Vic3RyKC0xKSA9PT0gJ1xcbicpIHtcbiAgICAgIC8vIG5vdGhpbmcgdG8gY2hhbmdlIGhlcmVcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1xcbi4qPyQvKSkpIHtcbiAgICAgIC8vIHRydW5jYXRlIHRvIG5lYXJlc3QgbGluZSBicmVha1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIDEpKVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9IGVsc2UgaWYgKGxpbmUubGVuZ3RoID4gTUFYX0xJTkVfTEVOR1RIIC0gbGluZU1hcmdpbiAmJiAobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1sgXFx0LiwhP11bXiBcXHQuLCE/XSokLykpKSB7XG4gICAgICAvLyB0cnVuY2F0ZSB0byBuZWFyZXN0IHNwYWNlXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gMSkpXG4gICAgfSBlbHNlIGlmIChsaW5lLnN1YnN0cigtMSkgPT09ICdcXHInKSB7XG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMn0kL2kpKSB7XG4gICAgICAgIC8vIHB1c2ggaW5jb21wbGV0ZSBlbmNvZGluZyBzZXF1ZW5jZXMgdG8gdGhlIG5leHQgbGluZVxuICAgICAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMX0kL2kpKSkge1xuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVuc3VyZSB0aGF0IHV0Zi04IHNlcXVlbmNlcyBhcmUgbm90IHNwbGl0XG4gICAgICAgIHdoaWxlIChsaW5lLmxlbmd0aCA+IDMgJiYgbGluZS5sZW5ndGggPCBsZW4gLSBwb3MgJiYgIWxpbmUubWF0Y2goL14oPzo9W1xcZGEtZl17Mn0pezEsNH0kL2kpICYmIChtYXRjaCA9IGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvaWcpKSkge1xuICAgICAgICAgIGNvbnN0IGNvZGUgPSBwYXJzZUludChtYXRjaFswXS5zdWJzdHIoMSwgMiksIDE2KVxuICAgICAgICAgIGlmIChjb2RlIDwgMTI4KSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDMpXG5cbiAgICAgICAgICBpZiAoY29kZSA+PSAweEMwKSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3MgKyBsaW5lLmxlbmd0aCA8IGxlbiAmJiBsaW5lLnN1YnN0cigtMSkgIT09ICdcXG4nKSB7XG4gICAgICBpZiAobGluZS5sZW5ndGggPT09IE1BWF9MSU5FX0xFTkdUSCAmJiBsaW5lLm1hdGNoKC89W1xcZGEtZl17Mn0kL2kpKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDMpXG4gICAgICB9IGVsc2UgaWYgKGxpbmUubGVuZ3RoID09PSBNQVhfTElORV9MRU5HVEgpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMSlcbiAgICAgIH1cbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgbGluZSArPSAnPVxcclxcbidcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGxpbmVcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuZXhwb3J0IHsgZGVjb2RlLCBlbmNvZGUsIGNvbnZlcnQgfVxuIl19