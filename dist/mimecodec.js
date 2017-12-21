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
 * Encodes a string or an Uint8Array to an UTF-8 MIME Word (rfc2047)
 *
 * @param {String|Uint8Array} data String to be encoded
 * @param {String} mimeWordEncoding='Q' Encoding for the mime word, either Q or B
 * @param {String} [fromCharset='UTF-8'] Source sharacter set
 * @return {String} Single or several mime words joined together
 */
function mimeWordEncode(data) {
  var mimeWordEncoding = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'Q';
  var fromCharset = arguments[2];

  var encodedStr = void 0;

  if (mimeWordEncoding === 'Q') {
    var maxLength = MAX_MIME_WORD_LENGTH;
    encodedStr = mimeEncode(data, fromCharset);
    // https://tools.ietf.org/html/rfc2047#section-5 rule (3)
    encodedStr = encodedStr.replace(/[^a-z0-9!*+\-/=]/ig, function (chr) {
      return chr === ' ' ? '_' : '=' + (chr.charCodeAt(0) < 0x10 ? '0' : '') + chr.charCodeAt(0).toString(16).toUpperCase();
    });
    if (encodedStr.length > maxLength) {
      encodedStr = _splitMimeEncodedString(encodedStr, maxLength).join('?= =?UTF-8?' + mimeWordEncoding + '?');
    }
  } else if (mimeWordEncoding === 'B') {
    encodedStr = typeof data === 'string' ? data : (0, _charset.decode)(data, fromCharset);
    var _maxLength = Math.max(3, (MAX_MIME_WORD_LENGTH - MAX_MIME_WORD_LENGTH % 4) / 4 * 3);
    if (encodedStr.length > _maxLength) {
      // RFC2047 6.3 (2) states that encoded-word must include an integral number of characters, so no chopping unicode sequences
      var parts = [];
      for (var i = 0, len = encodedStr.length; i < len; i += _maxLength) {
        parts.push(base64Encode(encodedStr.substr(i, _maxLength)));
      }
      return '=?UTF-8?' + mimeWordEncoding + '?' + parts.join('?= =?UTF-8?' + mimeWordEncoding + '?') + '?=';
    }
  } else {
    encodedStr = base64Encode(encodedStr);
  }

  return '=?UTF-8?' + mimeWordEncoding + '?' + encodedStr + (encodedStr.substr(-2) === '?=' ? '' : '?=');
}

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMuanMiXSwibmFtZXMiOlsibWltZUVuY29kZSIsIm1pbWVEZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJiYXNlNjREZWNvZGUiLCJxdW90ZWRQcmludGFibGVFbmNvZGUiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsIm1pbWVXb3JkRGVjb2RlIiwibWltZVdvcmRzRGVjb2RlIiwiZm9sZExpbmVzIiwiaGVhZGVyTGluZUVuY29kZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lc0RlY29kZSIsInBhcnNlSGVhZGVyVmFsdWUiLCJjb250aW51YXRpb25FbmNvZGUiLCJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsImRhdGEiLCJmcm9tQ2hhcnNldCIsImJ1ZmZlciIsInJlZHVjZSIsImFnZ3JlZ2F0ZSIsIm9yZCIsImluZGV4IiwiX2NoZWNrUmFuZ2VzIiwibGVuZ3RoIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidG9TdHJpbmciLCJ0b1VwcGVyQ2FzZSIsIm5yIiwicmFuZ2VzIiwidmFsIiwicmFuZ2UiLCJzdHIiLCJlbmNvZGVkQnl0ZXNDb3VudCIsIm1hdGNoIiwiVWludDhBcnJheSIsImkiLCJsZW4iLCJidWZmZXJQb3MiLCJoZXgiLCJzdWJzdHIiLCJjaHIiLCJjaGFyQXQiLCJ0ZXN0IiwicGFyc2VJbnQiLCJjaGFyQ29kZUF0IiwiYnVmIiwiYjY0IiwiX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzIiwibWltZUVuY29kZWRTdHIiLCJyZXBsYWNlIiwic3BhY2VzIiwiX2FkZFFQU29mdExpbmVicmVha3MiLCJyYXdTdHJpbmciLCJtaW1lV29yZEVuY29kaW5nIiwiZW5jb2RlZFN0ciIsIm1heExlbmd0aCIsIl9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nIiwiam9pbiIsIk1hdGgiLCJtYXgiLCJwYXJ0cyIsInB1c2giLCJyZWdleCIsInNwbGl0Iiwic2hpZnQiLCJlbmNvZGluZyIsIm1pbWVXb3JkIiwiYWZ0ZXJTcGFjZSIsInBvcyIsInJlc3VsdCIsImxpbmUiLCJrZXkiLCJ2YWx1ZSIsImVuY29kZWRWYWx1ZSIsImhlYWRlckxpbmUiLCJ0cmltIiwiaGVhZGVycyIsImxpbmVzIiwiaGVhZGVyc09iaiIsInNwbGljZSIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiY29uY2F0IiwicmVzcG9uc2UiLCJwYXJhbXMiLCJ0eXBlIiwicXVvdGUiLCJlc2NhcGVkIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJhY3R1YWxLZXkiLCJOdW1iZXIiLCJjaGFyc2V0IiwidmFsdWVzIiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwicyIsImMiLCJsaXN0Iiwic3RhcnRQb3MiLCJpc0VuY29kZWQiLCJSZWdFeHAiLCJlbmNvZGVVUklDb21wb25lbnQiLCJlbmNvZGVkIiwiaXRlbSIsIm1heGxlbiIsIm1pbldvcmRMZW5ndGgiLCJtYXhXb3JkTGVuZ3RoIiwiY3VyTGluZSIsImRvbmUiLCJiYXNlNjRFbmNvZGVkU3RyIiwicXBFbmNvZGVkU3RyIiwibGluZU1hcmdpbiIsImZsb29yIiwiY29kZSIsImRlY29kZSIsImVuY29kZSIsImNvbnZlcnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztRQWlCZ0JBLFUsR0FBQUEsVTtRQTBCQUMsVSxHQUFBQSxVO1FBMEJBQyxZLEdBQUFBLFk7UUFhQUMsWSxHQUFBQSxZO1FBYUFDLHFCLEdBQUFBLHFCO1FBZ0JBQyxxQixHQUFBQSxxQjtRQWdCQUMsYyxHQUFBQSxjO1FBcUNBQyxlLEdBQUFBLGU7UUFXQUMsYyxHQUFBQSxjO1FBMEJBQyxlLEdBQUFBLGU7UUFnQkFDLFMsR0FBQUEsUztRQTBDQUMsZ0IsR0FBQUEsZ0I7UUFZQUMsZ0IsR0FBQUEsZ0I7UUFpQkFDLGlCLEdBQUFBLGlCO1FBeUNBQyxnQixHQUFBQSxnQjtRQWlJQUMsa0IsR0FBQUEsa0I7O0FBMWNoQjs7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsSUFB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K0MsY0FBVUMsSUFBVjtBQUNEOztBQUVELFNBQU9ELE1BQVA7QUFDRDs7UUFFUWdELE07UUFBUUMsTTtRQUFRQyxPIiwiZmlsZSI6Im1pbWVjb2RlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGVuY29kZSBhcyBlbmNvZGVCYXNlNjQsIGRlY29kZSBhcyBkZWNvZGVCYXNlNjQsIE9VVFBVVF9UWVBFRF9BUlJBWSB9IGZyb20gJ2VtYWlsanMtYmFzZTY0J1xuaW1wb3J0IHsgZW5jb2RlLCBkZWNvZGUsIGNvbnZlcnQgfSBmcm9tICcuL2NoYXJzZXQnXG5cbi8vIExpbmVzIGNhbid0IGJlIGxvbmdlciB0aGFuIDc2ICsgPENSPjxMRj4gPSA3OCBieXRlc1xuLy8gaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NSNzZWN0aW9uLTYuN1xuY29uc3QgTUFYX0xJTkVfTEVOR1RIID0gNzZcbmNvbnN0IE1BWF9NSU1FX1dPUkRfTEVOR1RIID0gNTJcblxuLyoqXG4gKiBFbmNvZGVzIGFsbCBub24gcHJpbnRhYmxlIGFuZCBub24gYXNjaWkgYnl0ZXMgdG8gPVhYIGZvcm0sIHdoZXJlIFhYIGlzIHRoZVxuICogYnl0ZSB2YWx1ZSBpbiBoZXguIFRoaXMgZnVuY3Rpb24gZG9lcyBub3QgY29udmVydCBsaW5lYnJlYWtzIGV0Yy4gaXRcbiAqIG9ubHkgZXNjYXBlcyBjaGFyYWN0ZXIgc2VxdWVuY2VzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBFaXRoZXIgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2UgZW5jb2RpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBlbmNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZUVuY29kZSAoZGF0YSA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgYnVmZmVyID0gY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcbiAgcmV0dXJuIGJ1ZmZlci5yZWR1Y2UoKGFnZ3JlZ2F0ZSwgb3JkLCBpbmRleCkgPT4gX2NoZWNrUmFuZ2VzKG9yZCkgJiZcbiAgICAhKChvcmQgPT09IDB4MjAgfHwgb3JkID09PSAweDA5KSAmJiAoaW5kZXggPT09IGJ1ZmZlci5sZW5ndGggLSAxIHx8IGJ1ZmZlcltpbmRleCArIDFdID09PSAweDBhIHx8IGJ1ZmZlcltpbmRleCArIDFdID09PSAweDBkKSlcbiAgICA/IGFnZ3JlZ2F0ZSArIFN0cmluZy5mcm9tQ2hhckNvZGUob3JkKSAvLyBpZiB0aGUgY2hhciBpcyBpbiBhbGxvd2VkIHJhbmdlLCB0aGVuIGtlZXAgYXMgaXMsIHVubGVzcyBpdCBpcyBhIHdzIGluIHRoZSBlbmQgb2YgYSBsaW5lXG4gICAgOiBhZ2dyZWdhdGUgKyAnPScgKyAob3JkIDwgMHgxMCA/ICcwJyA6ICcnKSArIG9yZC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSwgJycpXG5cbiAgZnVuY3Rpb24gX2NoZWNrUmFuZ2VzIChucikge1xuICAgIGNvbnN0IHJhbmdlcyA9IFsgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDUjc2VjdGlvbi02LjdcbiAgICAgIFsweDA5XSwgLy8gPFRBQj5cbiAgICAgIFsweDBBXSwgLy8gPExGPlxuICAgICAgWzB4MERdLCAvLyA8Q1I+XG4gICAgICBbMHgyMCwgMHgzQ10sIC8vIDxTUD4hXCIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7XG4gICAgICBbMHgzRSwgMHg3RV0gLy8gPj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXFxdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1cbiAgICBdXG4gICAgcmV0dXJuIHJhbmdlcy5yZWR1Y2UoKHZhbCwgcmFuZ2UpID0+IHZhbCB8fCAocmFuZ2UubGVuZ3RoID09PSAxICYmIG5yID09PSByYW5nZVswXSkgfHwgKHJhbmdlLmxlbmd0aCA9PT0gMiAmJiBuciA+PSByYW5nZVswXSAmJiBuciA8PSByYW5nZVsxXSksIGZhbHNlKVxuICB9XG59XG5cbiAgLyoqXG4gICAqIERlY29kZXMgbWltZSBlbmNvZGVkIHN0cmluZyB0byBhbiB1bmljb2RlIHN0cmluZ1xuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2UgZW5jb2RpbmdcbiAgICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gICAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVEZWNvZGUgKHN0ciA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgZW5jb2RlZEJ5dGVzQ291bnQgPSAoc3RyLm1hdGNoKC89W1xcZGEtZkEtRl17Mn0vZykgfHwgW10pLmxlbmd0aFxuICBsZXQgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoc3RyLmxlbmd0aCAtIGVuY29kZWRCeXRlc0NvdW50ICogMilcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3RyLmxlbmd0aCwgYnVmZmVyUG9zID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGhleCA9IHN0ci5zdWJzdHIoaSArIDEsIDIpXG4gICAgY29uc3QgY2hyID0gc3RyLmNoYXJBdChpKVxuICAgIGlmIChjaHIgPT09ICc9JyAmJiBoZXggJiYgL1tcXGRhLWZBLUZdezJ9Ly50ZXN0KGhleCkpIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBwYXJzZUludChoZXgsIDE2KVxuICAgICAgaSArPSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBjaHIuY2hhckNvZGVBdCgwKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZWNvZGUoYnVmZmVyLCBmcm9tQ2hhcnNldClcbn1cblxuICAvKipcbiAgICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiB0eXBlZCBhcnJheSBvZiBnaXZlbiBjaGFyc2V0IGludG8gdW5pY29kZVxuICAgKiBiYXNlNjQgc3RyaW5nLiBBbHNvIGFkZHMgbGluZSBicmVha3NcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgb3IgdHlwZWQgYXJyYXkgdG8gYmUgYmFzZTY0IGVuY29kZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IEluaXRpYWwgY2hhcnNldCwgZS5nLiAnYmluYXJ5Jy4gRGVmYXVsdHMgdG8gJ1VURi04J1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IEJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuICAgKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjRFbmNvZGUgKGRhdGEsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBidWYgPSAodHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnICYmIGZyb21DaGFyc2V0ID09PSAnYmluYXJ5JykgPyBkYXRhIDogY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcbiAgY29uc3QgYjY0ID0gZW5jb2RlQmFzZTY0KGJ1ZilcbiAgcmV0dXJuIF9hZGRCYXNlNjRTb2Z0TGluZWJyZWFrcyhiNjQpXG59XG5cbiAgLyoqXG4gICAqIERlY29kZXMgYSBiYXNlNjQgc3RyaW5nIG9mIGFueSBjaGFyc2V0IGludG8gYW4gdW5pY29kZSBzdHJpbmdcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0ciBCYXNlNjQgZW5jb2RlZCBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBiYXNlNjQgZW5jb2RlZCBzdHJpbmdcbiAgICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gICAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NERlY29kZSAoc3RyLCBmcm9tQ2hhcnNldCkge1xuICByZXR1cm4gZGVjb2RlKGRlY29kZUJhc2U2NChzdHIsIE9VVFBVVF9UWVBFRF9BUlJBWSksIGZyb21DaGFyc2V0KVxufVxuXG4gIC8qKlxuICAgKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgaW50byBhIHF1b3RlZCBwcmludGFibGUgZW5jb2RpbmdcbiAgICogVGhpcyBpcyBhbG1vc3QgdGhlIHNhbWUgYXMgbWltZUVuY29kZSwgZXhjZXB0IGxpbmUgYnJlYWtzIHdpbGwgYmUgY2hhbmdlZFxuICAgKiBhcyB3ZWxsIHRvIGVuc3VyZSB0aGF0IHRoZSBsaW5lcyBhcmUgbmV2ZXIgbG9uZ2VyIHRoYW4gYWxsb3dlZCBsZW5ndGhcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBtaW1lIGVuY29kZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIHN0cmluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAgICovXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVkUHJpbnRhYmxlRW5jb2RlIChkYXRhID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBtaW1lRW5jb2RlZFN0ciA9IG1pbWVFbmNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gICAgLnJlcGxhY2UoL1xccj9cXG58XFxyL2csICdcXHJcXG4nKSAvLyBmaXggbGluZSBicmVha3MsIGVuc3VyZSA8Q1I+PExGPlxuICAgIC5yZXBsYWNlKC9bXFx0IF0rJC9nbSwgc3BhY2VzID0+IHNwYWNlcy5yZXBsYWNlKC8gL2csICc9MjAnKS5yZXBsYWNlKC9cXHQvZywgJz0wOScpKSAvLyByZXBsYWNlIHNwYWNlcyBpbiB0aGUgZW5kIG9mIGxpbmVzXG5cbiAgcmV0dXJuIF9hZGRRUFNvZnRMaW5lYnJlYWtzKG1pbWVFbmNvZGVkU3RyKSAvLyBhZGQgc29mdCBsaW5lIGJyZWFrcyB0byBlbnN1cmUgbGluZSBsZW5ndGhzIHNqb3J0ZXIgdGhhbiA3NiBieXRlc1xufVxuXG4vKipcbiAqIERlY29kZXMgYSBzdHJpbmcgZnJvbSBhIHF1b3RlZCBwcmludGFibGUgZW5jb2RpbmcuIFRoaXMgaXMgYWxtb3N0IHRoZVxuICogc2FtZSBhcyBtaW1lRGVjb2RlLCBleGNlcHQgbGluZSBicmVha3Mgd2lsbCBiZSBjaGFuZ2VkIGFzIHdlbGxcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmcgdG8gZGVjb2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIHN0cmluZ1xuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGRlY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBxdW90ZWRQcmludGFibGVEZWNvZGUgKHN0ciA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgcmF3U3RyaW5nID0gc3RyXG4gICAgLnJlcGxhY2UoL1tcXHQgXSskL2dtLCAnJykgLy8gcmVtb3ZlIGludmFsaWQgd2hpdGVzcGFjZSBmcm9tIHRoZSBlbmQgb2YgbGluZXNcbiAgICAucmVwbGFjZSgvPSg/Olxccj9cXG58JCkvZywgJycpIC8vIHJlbW92ZSBzb2Z0IGxpbmUgYnJlYWtzXG5cbiAgcmV0dXJuIG1pbWVEZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbn1cblxuICAvKipcbiAgICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IHRvIGFuIFVURi04IE1JTUUgV29yZCAocmZjMjA0NylcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWltZVdvcmRFbmNvZGluZz0nUScgRW5jb2RpbmcgZm9yIHRoZSBtaW1lIHdvcmQsIGVpdGhlciBRIG9yIEJcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IFNpbmdsZSBvciBzZXZlcmFsIG1pbWUgd29yZHMgam9pbmVkIHRvZ2V0aGVyXG4gICAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3JkRW5jb2RlIChkYXRhLCBtaW1lV29yZEVuY29kaW5nID0gJ1EnLCBmcm9tQ2hhcnNldCkge1xuICBsZXQgZW5jb2RlZFN0clxuXG4gIGlmIChtaW1lV29yZEVuY29kaW5nID09PSAnUScpIHtcbiAgICBjb25zdCBtYXhMZW5ndGggPSBNQVhfTUlNRV9XT1JEX0xFTkdUSFxuICAgIGVuY29kZWRTdHIgPSBtaW1lRW5jb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ3I3NlY3Rpb24tNSBydWxlICgzKVxuICAgIGVuY29kZWRTdHIgPSBlbmNvZGVkU3RyLnJlcGxhY2UoL1teYS16MC05ISorXFwtLz1dL2lnLCBjaHIgPT4gY2hyID09PSAnICcgPyAnXycgOiAoJz0nICsgKGNoci5jaGFyQ29kZUF0KDApIDwgMHgxMCA/ICcwJyA6ICcnKSArIGNoci5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpKSlcbiAgICBpZiAoZW5jb2RlZFN0ci5sZW5ndGggPiBtYXhMZW5ndGgpIHtcbiAgICAgIGVuY29kZWRTdHIgPSBfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyhlbmNvZGVkU3RyLCBtYXhMZW5ndGgpLmpvaW4oJz89ID0/VVRGLTg/JyArIG1pbWVXb3JkRW5jb2RpbmcgKyAnPycpXG4gICAgfVxuICB9IGVsc2UgaWYgKG1pbWVXb3JkRW5jb2RpbmcgPT09ICdCJykge1xuICAgIGVuY29kZWRTdHIgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIGNvbnN0IG1heExlbmd0aCA9IE1hdGgubWF4KDMsIChNQVhfTUlNRV9XT1JEX0xFTkdUSCAtIE1BWF9NSU1FX1dPUkRfTEVOR1RIICUgNCkgLyA0ICogMylcbiAgICBpZiAoZW5jb2RlZFN0ci5sZW5ndGggPiBtYXhMZW5ndGgpIHtcbiAgICAgIC8vIFJGQzIwNDcgNi4zICgyKSBzdGF0ZXMgdGhhdCBlbmNvZGVkLXdvcmQgbXVzdCBpbmNsdWRlIGFuIGludGVncmFsIG51bWJlciBvZiBjaGFyYWN0ZXJzLCBzbyBubyBjaG9wcGluZyB1bmljb2RlIHNlcXVlbmNlc1xuICAgICAgY29uc3QgcGFydHMgPSBbXVxuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGVuY29kZWRTdHIubGVuZ3RoOyBpIDwgbGVuOyBpICs9IG1heExlbmd0aCkge1xuICAgICAgICBwYXJ0cy5wdXNoKGJhc2U2NEVuY29kZShlbmNvZGVkU3RyLnN1YnN0cihpLCBtYXhMZW5ndGgpKSlcbiAgICAgIH1cbiAgICAgIHJldHVybiAnPT9VVEYtOD8nICsgbWltZVdvcmRFbmNvZGluZyArICc/JyArIHBhcnRzLmpvaW4oJz89ID0/VVRGLTg/JyArIG1pbWVXb3JkRW5jb2RpbmcgKyAnPycpICsgJz89J1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBlbmNvZGVkU3RyID0gYmFzZTY0RW5jb2RlKGVuY29kZWRTdHIpXG4gIH1cblxuICByZXR1cm4gJz0/VVRGLTg/JyArIG1pbWVXb3JkRW5jb2RpbmcgKyAnPycgKyBlbmNvZGVkU3RyICsgKGVuY29kZWRTdHIuc3Vic3RyKC0yKSA9PT0gJz89JyA/ICcnIDogJz89Jylcbn1cblxuLyoqXG4gKiBGaW5kcyB3b3JkIHNlcXVlbmNlcyB3aXRoIG5vbiBhc2NpaSB0ZXh0IGFuZCBjb252ZXJ0cyB0aGVzZSB0byBtaW1lIHdvcmRzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IG1pbWVXb3JkRW5jb2Rpbmc9J1EnIEVuY29kaW5nIGZvciB0aGUgbWltZSB3b3JkLCBlaXRoZXIgUSBvciBCXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBzaGFyYWN0ZXIgc2V0XG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIHBvc3NpYmxlIG1pbWUgd29yZHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3Jkc0VuY29kZSAoZGF0YSA9ICcnLCBtaW1lV29yZEVuY29kaW5nID0gJ1EnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgcmVnZXggPSAvKFteXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qKD86XFxzK1teXFxzXFx1MDA4MC1cXHVGRkZGXSpbXFx1MDA4MC1cXHVGRkZGXStbXlxcc1xcdTAwODAtXFx1RkZGRl0qXFxzKik/KSsvZ1xuICByZXR1cm4gZGVjb2RlKGNvbnZlcnQoZGF0YSwgZnJvbUNoYXJzZXQpKS5yZXBsYWNlKHJlZ2V4LCBtYXRjaCA9PiBtYXRjaC5sZW5ndGggPyBtaW1lV29yZEVuY29kZShtYXRjaCwgbWltZVdvcmRFbmNvZGluZywgZnJvbUNoYXJzZXQpIDogJycpXG59XG5cbi8qKlxuICogRGVjb2RlIGEgY29tcGxldGUgbWltZSB3b3JkIGVuY29kZWQgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIHdvcmQgZW5jb2RlZCBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmREZWNvZGUgKHN0ciA9ICcnKSB7XG4gIGNvbnN0IG1hdGNoID0gc3RyLm1hdGNoKC9ePVxcPyhbXFx3X1xcLSpdKylcXD8oW1FxQmJdKVxcPyhbXj9dKylcXD89JC9pKVxuICBpZiAoIW1hdGNoKSByZXR1cm4gc3RyXG5cbiAgLy8gUkZDMjIzMSBhZGRlZCBsYW5ndWFnZSB0YWcgdG8gdGhlIGVuY29kaW5nXG4gIC8vIHNlZTogaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIyMzEjc2VjdGlvbi01XG4gIC8vIHRoaXMgaW1wbGVtZW50YXRpb24gc2lsZW50bHkgaWdub3JlcyB0aGlzIHRhZ1xuICBjb25zdCBmcm9tQ2hhcnNldCA9IG1hdGNoWzFdLnNwbGl0KCcqJykuc2hpZnQoKVxuICBjb25zdCBlbmNvZGluZyA9IChtYXRjaFsyXSB8fCAnUScpLnRvU3RyaW5nKCkudG9VcHBlckNhc2UoKVxuICBjb25zdCByYXdTdHJpbmcgPSAobWF0Y2hbM10gfHwgJycpLnJlcGxhY2UoL18vZywgJyAnKVxuXG4gIGlmIChlbmNvZGluZyA9PT0gJ0InKSB7XG4gICAgcmV0dXJuIGJhc2U2NERlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxuICB9IGVsc2UgaWYgKGVuY29kaW5nID09PSAnUScpIHtcbiAgICByZXR1cm4gbWltZURlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHJcbiAgfVxufVxuXG4vKipcbiAqIERlY29kZSBhIHN0cmluZyB0aGF0IG1pZ2h0IGluY2x1ZGUgb25lIG9yIHNldmVyYWwgbWltZSB3b3Jkc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIGluY2x1ZGluZyBzb21lIG1pbWUgd29yZHMgdGhhdCB3aWxsIGJlIGVuY29kZWRcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRzRGVjb2RlIChzdHIgPSAnJykge1xuICBzdHIgPSBzdHIudG9TdHJpbmcoKS5yZXBsYWNlKC8oPVxcP1teP10rXFw/W1FxQmJdXFw/W14/XStcXD89KVxccysoPz09XFw/W14/XStcXD9bUXFCYl1cXD9bXj9dKlxcPz0pL2csICckMScpXG4gIHN0ciA9IHN0ci5yZXBsYWNlKC9cXD89PVxcP1t1VV1bdFRdW2ZGXS04XFw/W1FxQmJdXFw/L2csICcnKSAvLyBqb2luIGJ5dGVzIG9mIG11bHRpLWJ5dGUgVVRGLThcbiAgc3RyID0gc3RyLnJlcGxhY2UoLz1cXD9bXFx3X1xcLSpdK1xcP1tRcUJiXVxcP1teP10rXFw/PS9nLCBtaW1lV29yZCA9PiBtaW1lV29yZERlY29kZShtaW1lV29yZC5yZXBsYWNlKC9cXHMrL2csICcnKSkpXG5cbiAgcmV0dXJuIHN0clxufVxuXG4vKipcbiAqIEZvbGRzIGxvbmcgbGluZXMsIHVzZWZ1bCBmb3IgZm9sZGluZyBoZWFkZXIgbGluZXMgKGFmdGVyU3BhY2U9ZmFsc2UpIGFuZFxuICogZmxvd2VkIHRleHQgKGFmdGVyU3BhY2U9dHJ1ZSlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBiZSBmb2xkZWRcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gYWZ0ZXJTcGFjZSBJZiB0cnVlLCBsZWF2ZSBhIHNwYWNlIGluIHRoIGVuZCBvZiBhIGxpbmVcbiAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggZm9sZGVkIGxpbmVzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb2xkTGluZXMgKHN0ciA9ICcnLCBhZnRlclNwYWNlKSB7XG4gIGxldCBwb3MgPSAwXG4gIGNvbnN0IGxlbiA9IHN0ci5sZW5ndGhcbiAgbGV0IHJlc3VsdCA9ICcnXG4gIGxldCBsaW5lLCBtYXRjaFxuXG4gIHdoaWxlIChwb3MgPCBsZW4pIHtcbiAgICBsaW5lID0gc3RyLnN1YnN0cihwb3MsIE1BWF9MSU5FX0xFTkdUSClcbiAgICBpZiAobGluZS5sZW5ndGggPCBNQVhfTElORV9MRU5HVEgpIHtcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBicmVha1xuICAgIH1cbiAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvXlteXFxuXFxyXSooXFxyP1xcbnxcXHIpLykpKSB7XG4gICAgICBsaW5lID0gbWF0Y2hbMF1cbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC8oXFxzKylbXlxcc10qJC8pKSAmJiBtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkgPCBsaW5lLmxlbmd0aCkge1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIChhZnRlclNwYWNlID8gKG1hdGNoWzFdIHx8ICcnKS5sZW5ndGggOiAwKSkpXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBzdHIuc3Vic3RyKHBvcyArIGxpbmUubGVuZ3RoKS5tYXRjaCgvXlteXFxzXSsoXFxzKikvKSkpIHtcbiAgICAgIGxpbmUgPSBsaW5lICsgbWF0Y2hbMF0uc3Vic3RyKDAsIG1hdGNoWzBdLmxlbmd0aCAtICghYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpXG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGxpbmVcbiAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICBpZiAocG9zIDwgbGVuKSB7XG4gICAgICByZXN1bHQgKz0gJ1xcclxcbidcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbiAgLyoqXG4gICAqIEVuY29kZXMgYW5kIGZvbGRzIGEgaGVhZGVyIGxpbmUgZm9yIGEgTUlNRSBtZXNzYWdlIGhlYWRlci5cbiAgICogU2hvcnRoYW5kIGZvciBtaW1lV29yZHNFbmNvZGUgKyBmb2xkTGluZXNcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleSBLZXkgbmFtZSwgd2lsbCBub3QgYmUgZW5jb2RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSB2YWx1ZSBWYWx1ZSB0byBiZSBlbmNvZGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gQ2hhcmFjdGVyIHNldCBvZiB0aGUgdmFsdWVcbiAgICogQHJldHVybiB7U3RyaW5nfSBlbmNvZGVkIGFuZCBmb2xkZWQgaGVhZGVyIGxpbmVcbiAgICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZUVuY29kZSAoa2V5LCB2YWx1ZSwgZnJvbUNoYXJzZXQpIHtcbiAgdmFyIGVuY29kZWRWYWx1ZSA9IG1pbWVXb3Jkc0VuY29kZSh2YWx1ZSwgJ1EnLCBmcm9tQ2hhcnNldClcbiAgcmV0dXJuIGZvbGRMaW5lcyhrZXkgKyAnOiAnICsgZW5jb2RlZFZhbHVlKVxufVxuXG4vKipcbiAqIFRoZSByZXN1bHQgaXMgbm90IG1pbWUgd29yZCBkZWNvZGVkLCB5b3UgbmVlZCB0byBkbyB5b3VyIG93biBkZWNvZGluZyBiYXNlZFxuICogb24gdGhlIHJ1bGVzIGZvciB0aGUgc3BlY2lmaWMgaGVhZGVyIGtleVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJMaW5lIFNpbmdsZSBoZWFkZXIgbGluZSwgbWlnaHQgaW5jbHVkZSBsaW5lYnJlYWtzIGFzIHdlbGwgaWYgZm9sZGVkXG4gKiBAcmV0dXJuIHtPYmplY3R9IEFuZCBvYmplY3Qgb2Yge2tleSwgdmFsdWV9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkZXJMaW5lRGVjb2RlIChoZWFkZXJMaW5lID0gJycpIHtcbiAgY29uc3QgbGluZSA9IGhlYWRlckxpbmUudG9TdHJpbmcoKS5yZXBsYWNlKC8oPzpcXHI/XFxufFxccilbIFxcdF0qL2csICcgJykudHJpbSgpXG4gIGNvbnN0IG1hdGNoID0gbGluZS5tYXRjaCgvXlxccyooW146XSspOiguKikkLylcblxuICByZXR1cm4ge1xuICAgIGtleTogKChtYXRjaCAmJiBtYXRjaFsxXSkgfHwgJycpLnRyaW0oKSxcbiAgICB2YWx1ZTogKChtYXRjaCAmJiBtYXRjaFsyXSkgfHwgJycpLnRyaW0oKVxuICB9XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYmxvY2sgb2YgaGVhZGVyIGxpbmVzLiBEb2VzIG5vdCBkZWNvZGUgbWltZSB3b3JkcyBhcyBldmVyeVxuICogaGVhZGVyIG1pZ2h0IGhhdmUgaXRzIG93biBydWxlcyAoZWcuIGZvcm1hdHRlZCBlbWFpbCBhZGRyZXNzZXMgYW5kIHN1Y2gpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlcnMgSGVhZGVycyBzdHJpbmdcbiAqIEByZXR1cm4ge09iamVjdH0gQW4gb2JqZWN0IG9mIGhlYWRlcnMsIHdoZXJlIGhlYWRlciBrZXlzIGFyZSBvYmplY3Qga2V5cy4gTkIhIFNldmVyYWwgdmFsdWVzIHdpdGggdGhlIHNhbWUga2V5IG1ha2UgdXAgYW4gQXJyYXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVzRGVjb2RlIChoZWFkZXJzKSB7XG4gIGNvbnN0IGxpbmVzID0gaGVhZGVycy5zcGxpdCgvXFxyP1xcbnxcXHIvKVxuICBjb25zdCBoZWFkZXJzT2JqID0ge31cblxuICBmb3IgKGxldCBpID0gbGluZXMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAoaSAmJiBsaW5lc1tpXS5tYXRjaCgvXlxccy8pKSB7XG4gICAgICBsaW5lc1tpIC0gMV0gKz0gJ1xcclxcbicgKyBsaW5lc1tpXVxuICAgICAgbGluZXMuc3BsaWNlKGksIDEpXG4gICAgfVxuICB9XG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IGxpbmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY29uc3QgaGVhZGVyID0gaGVhZGVyTGluZURlY29kZShsaW5lc1tpXSlcbiAgICBjb25zdCBrZXkgPSBoZWFkZXIua2V5LnRvTG93ZXJDYXNlKClcbiAgICBjb25zdCB2YWx1ZSA9IGhlYWRlci52YWx1ZVxuXG4gICAgaWYgKCFoZWFkZXJzT2JqW2tleV0pIHtcbiAgICAgIGhlYWRlcnNPYmpba2V5XSA9IHZhbHVlXG4gICAgfSBlbHNlIHtcbiAgICAgIGhlYWRlcnNPYmpba2V5XSA9IFtdLmNvbmNhdChoZWFkZXJzT2JqW2tleV0sIHZhbHVlKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBoZWFkZXJzT2JqXG59XG5cbi8qKlxuICogUGFyc2VzIGEgaGVhZGVyIHZhbHVlIHdpdGgga2V5PXZhbHVlIGFyZ3VtZW50cyBpbnRvIGEgc3RydWN0dXJlZFxuICogb2JqZWN0LlxuICpcbiAqICAgcGFyc2VIZWFkZXJWYWx1ZSgnY29udGVudC10eXBlOiB0ZXh0L3BsYWluOyBDSEFSU0VUPSdVVEYtOCcnKSAtPlxuICogICB7XG4gKiAgICAgJ3ZhbHVlJzogJ3RleHQvcGxhaW4nLFxuICogICAgICdwYXJhbXMnOiB7XG4gKiAgICAgICAnY2hhcnNldCc6ICdVVEYtOCdcbiAqICAgICB9XG4gKiAgIH1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIEhlYWRlciB2YWx1ZVxuICogQHJldHVybiB7T2JqZWN0fSBIZWFkZXIgdmFsdWUgYXMgYSBwYXJzZWQgc3RydWN0dXJlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUhlYWRlclZhbHVlIChzdHIpIHtcbiAgbGV0IHJlc3BvbnNlID0ge1xuICAgIHZhbHVlOiBmYWxzZSxcbiAgICBwYXJhbXM6IHt9XG4gIH1cbiAgbGV0IGtleSA9IGZhbHNlXG4gIGxldCB2YWx1ZSA9ICcnXG4gIGxldCB0eXBlID0gJ3ZhbHVlJ1xuICBsZXQgcXVvdGUgPSBmYWxzZVxuICBsZXQgZXNjYXBlZCA9IGZhbHNlXG4gIGxldCBjaHJcblxuICBmb3IgKGxldCBpID0gMCwgbGVuID0gc3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgY2hyID0gc3RyLmNoYXJBdChpKVxuICAgIGlmICh0eXBlID09PSAna2V5Jykge1xuICAgICAgaWYgKGNociA9PT0gJz0nKSB7XG4gICAgICAgIGtleSA9IHZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIHR5cGUgPSAndmFsdWUnXG4gICAgICAgIHZhbHVlID0gJydcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cbiAgICAgIHZhbHVlICs9IGNoclxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZXNjYXBlZCkge1xuICAgICAgICB2YWx1ZSArPSBjaHJcbiAgICAgIH0gZWxzZSBpZiAoY2hyID09PSAnXFxcXCcpIHtcbiAgICAgICAgZXNjYXBlZCA9IHRydWVcbiAgICAgICAgY29udGludWVcbiAgICAgIH0gZWxzZSBpZiAocXVvdGUgJiYgY2hyID09PSBxdW90ZSkge1xuICAgICAgICBxdW90ZSA9IGZhbHNlXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICdcIicpIHtcbiAgICAgICAgcXVvdGUgPSBjaHJcbiAgICAgIH0gZWxzZSBpZiAoIXF1b3RlICYmIGNociA9PT0gJzsnKSB7XG4gICAgICAgIGlmIChrZXkgPT09IGZhbHNlKSB7XG4gICAgICAgICAgcmVzcG9uc2UudmFsdWUgPSB2YWx1ZS50cmltKClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlLnRyaW0oKVxuICAgICAgICB9XG4gICAgICAgIHR5cGUgPSAna2V5J1xuICAgICAgICB2YWx1ZSA9ICcnXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWx1ZSArPSBjaHJcbiAgICAgIH1cbiAgICAgIGVzY2FwZWQgPSBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlID09PSAndmFsdWUnKSB7XG4gICAgaWYgKGtleSA9PT0gZmFsc2UpIHtcbiAgICAgIHJlc3BvbnNlLnZhbHVlID0gdmFsdWUudHJpbSgpXG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gdmFsdWUudHJpbSgpXG4gICAgfVxuICB9IGVsc2UgaWYgKHZhbHVlLnRyaW0oKSkge1xuICAgIHJlc3BvbnNlLnBhcmFtc1t2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKV0gPSAnJ1xuICB9XG5cbiAgLy8gaGFuZGxlIHBhcmFtZXRlciB2YWx1ZSBjb250aW51YXRpb25zXG4gIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMjMxI3NlY3Rpb24tM1xuXG4gIC8vIHByZXByb2Nlc3MgdmFsdWVzXG4gIE9iamVjdC5rZXlzKHJlc3BvbnNlLnBhcmFtcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdmFyIGFjdHVhbEtleSwgbnIsIG1hdGNoLCB2YWx1ZVxuICAgIGlmICgobWF0Y2ggPSBrZXkubWF0Y2goLyhcXCooXFxkKyl8XFwqKFxcZCspXFwqfFxcKikkLykpKSB7XG4gICAgICBhY3R1YWxLZXkgPSBrZXkuc3Vic3RyKDAsIG1hdGNoLmluZGV4KVxuICAgICAgbnIgPSBOdW1iZXIobWF0Y2hbMl0gfHwgbWF0Y2hbM10pIHx8IDBcblxuICAgICAgaWYgKCFyZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSB8fCB0eXBlb2YgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldID0ge1xuICAgICAgICAgIGNoYXJzZXQ6IGZhbHNlLFxuICAgICAgICAgIHZhbHVlczogW11cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YWx1ZSA9IHJlc3BvbnNlLnBhcmFtc1trZXldXG5cbiAgICAgIGlmIChuciA9PT0gMCAmJiBtYXRjaFswXS5zdWJzdHIoLTEpID09PSAnKicgJiYgKG1hdGNoID0gdmFsdWUubWF0Y2goL14oW14nXSopJ1teJ10qJyguKikkLykpKSB7XG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldLmNoYXJzZXQgPSBtYXRjaFsxXSB8fCAnaXNvLTg4NTktMSdcbiAgICAgICAgdmFsdWUgPSBtYXRjaFsyXVxuICAgICAgfVxuXG4gICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS52YWx1ZXNbbnJdID0gdmFsdWVcblxuICAgICAgLy8gcmVtb3ZlIHRoZSBvbGQgcmVmZXJlbmNlXG4gICAgICBkZWxldGUgcmVzcG9uc2UucGFyYW1zW2tleV1cbiAgICB9XG4gIH0pXG5cbiAgICAgIC8vIGNvbmNhdGVuYXRlIHNwbGl0IHJmYzIyMzEgc3RyaW5ncyBhbmQgY29udmVydCBlbmNvZGVkIHN0cmluZ3MgdG8gbWltZSBlbmNvZGVkIHdvcmRzXG4gIE9iamVjdC5rZXlzKHJlc3BvbnNlLnBhcmFtcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdmFyIHZhbHVlXG4gICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldICYmIEFycmF5LmlzQXJyYXkocmVzcG9uc2UucGFyYW1zW2tleV0udmFsdWVzKSkge1xuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XS52YWx1ZXMubWFwKGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgcmV0dXJuIHZhbCB8fCAnJ1xuICAgICAgfSkuam9pbignJylcblxuICAgICAgaWYgKHJlc3BvbnNlLnBhcmFtc1trZXldLmNoYXJzZXQpIHtcbiAgICAgICAgLy8gY29udmVydCBcIiVBQlwiIHRvIFwiPT9jaGFyc2V0P1E/PUFCPz1cIlxuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9ICc9PycgKyByZXNwb25zZS5wYXJhbXNba2V5XS5jaGFyc2V0ICsgJz9RPycgKyB2YWx1ZVxuICAgICAgICAgIC5yZXBsYWNlKC9bPT9fXFxzXS9nLCBmdW5jdGlvbiAocykge1xuICAgICAgICAgICAgLy8gZml4IGludmFsaWRseSBlbmNvZGVkIGNoYXJzXG4gICAgICAgICAgICB2YXIgYyA9IHMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNilcbiAgICAgICAgICAgIHJldHVybiBzID09PSAnICcgPyAnXycgOiAnJScgKyAoYy5sZW5ndGggPCAyID8gJzAnIDogJycpICsgY1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLnJlcGxhY2UoLyUvZywgJz0nKSArICc/PScgLy8gY2hhbmdlIGZyb20gdXJsZW5jb2RpbmcgdG8gcGVyY2VudCBlbmNvZGluZ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZVxuICAgICAgfVxuICAgIH1cbiAgfSlcblxuICByZXR1cm4gcmVzcG9uc2Vcbn1cblxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gYW4gVVRGLTggUGFyYW1ldGVyIFZhbHVlIENvbnRpbnVhdGlvbiBlbmNvZGluZyAocmZjMjIzMSlcbiAqIFVzZWZ1bCBmb3Igc3BsaXR0aW5nIGxvbmcgcGFyYW1ldGVyIHZhbHVlcy5cbiAqXG4gKiBGb3IgZXhhbXBsZVxuICogICAgICB0aXRsZT1cInVuaWNvZGUgc3RyaW5nXCJcbiAqIGJlY29tZXNcbiAqICAgICB0aXRsZSowKj1cInV0Zi04Jyd1bmljb2RlXCJcbiAqICAgICB0aXRsZSoxKj1cIiUyMHN0cmluZ1wiXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtOdW1iZXJ9IFttYXhMZW5ndGg9NTBdIE1heCBsZW5ndGggZm9yIGdlbmVyYXRlZCBjaHVua3NcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIHNoYXJhY3RlciBzZXRcbiAqIEByZXR1cm4ge0FycmF5fSBBIGxpc3Qgb2YgZW5jb2RlZCBrZXlzIGFuZCBoZWFkZXJzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb250aW51YXRpb25FbmNvZGUgKGtleSwgZGF0YSwgbWF4TGVuZ3RoLCBmcm9tQ2hhcnNldCkge1xuICBjb25zdCBsaXN0ID0gW11cbiAgdmFyIGVuY29kZWRTdHIgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBkYXRhIDogZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICB2YXIgbGluZVxuICB2YXIgc3RhcnRQb3MgPSAwXG4gIHZhciBpc0VuY29kZWQgPSBmYWxzZVxuXG4gIG1heExlbmd0aCA9IG1heExlbmd0aCB8fCA1MFxuXG4gICAgICAvLyBwcm9jZXNzIGFzY2lpIG9ubHkgdGV4dFxuICBpZiAoL15bXFx3LlxcLSBdKiQvLnRlc3QoZGF0YSkpIHtcbiAgICAgICAgICAvLyBjaGVjayBpZiBjb252ZXJzaW9uIGlzIGV2ZW4gbmVlZGVkXG4gICAgaWYgKGVuY29kZWRTdHIubGVuZ3RoIDw9IG1heExlbmd0aCkge1xuICAgICAgcmV0dXJuIFt7XG4gICAgICAgIGtleToga2V5LFxuICAgICAgICB2YWx1ZTogL1tcXHNcIjs9XS8udGVzdChlbmNvZGVkU3RyKSA/ICdcIicgKyBlbmNvZGVkU3RyICsgJ1wiJyA6IGVuY29kZWRTdHJcbiAgICAgIH1dXG4gICAgfVxuXG4gICAgZW5jb2RlZFN0ciA9IGVuY29kZWRTdHIucmVwbGFjZShuZXcgUmVnRXhwKCcueycgKyBtYXhMZW5ndGggKyAnfScsICdnJyksIGZ1bmN0aW9uIChzdHIpIHtcbiAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgIGxpbmU6IHN0clxuICAgICAgfSlcbiAgICAgIHJldHVybiAnJ1xuICAgIH0pXG5cbiAgICBpZiAoZW5jb2RlZFN0cikge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogZW5jb2RlZFN0clxuICAgICAgfSlcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gZmlyc3QgbGluZSBpbmNsdWRlcyB0aGUgY2hhcnNldCBhbmQgbGFuZ3VhZ2UgaW5mbyBhbmQgbmVlZHMgdG8gYmUgZW5jb2RlZFxuICAgIC8vIGV2ZW4gaWYgaXQgZG9lcyBub3QgY29udGFpbiBhbnkgdW5pY29kZSBjaGFyYWN0ZXJzXG4gICAgbGluZSA9ICd1dGYtOFxcJ1xcJydcbiAgICBpc0VuY29kZWQgPSB0cnVlXG4gICAgc3RhcnRQb3MgPSAwXG4gICAgLy8gcHJvY2VzcyB0ZXh0IHdpdGggdW5pY29kZSBvciBzcGVjaWFsIGNoYXJzXG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGVuY29kZWRTdHIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGxldCBjaHIgPSBlbmNvZGVkU3RyW2ldXG5cbiAgICAgIGlmIChpc0VuY29kZWQpIHtcbiAgICAgICAgY2hyID0gZW5jb2RlVVJJQ29tcG9uZW50KGNocilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHRyeSB0byB1cmxlbmNvZGUgY3VycmVudCBjaGFyXG4gICAgICAgIGNociA9IGNociA9PT0gJyAnID8gY2hyIDogZW5jb2RlVVJJQ29tcG9uZW50KGNocilcbiAgICAgICAgLy8gQnkgZGVmYXVsdCBpdCBpcyBub3QgcmVxdWlyZWQgdG8gZW5jb2RlIGEgbGluZSwgdGhlIG5lZWRcbiAgICAgICAgLy8gb25seSBhcHBlYXJzIHdoZW4gdGhlIHN0cmluZyBjb250YWlucyB1bmljb2RlIG9yIHNwZWNpYWwgY2hhcnNcbiAgICAgICAgLy8gaW4gdGhpcyBjYXNlIHdlIHN0YXJ0IHByb2Nlc3NpbmcgdGhlIGxpbmUgb3ZlciBhbmQgZW5jb2RlIGFsbCBjaGFyc1xuICAgICAgICBpZiAoY2hyICE9PSBlbmNvZGVkU3RyW2ldKSB7XG4gICAgICAgICAgLy8gQ2hlY2sgaWYgaXQgaXMgZXZlbiBwb3NzaWJsZSB0byBhZGQgdGhlIGVuY29kZWQgY2hhciB0byB0aGUgbGluZVxuICAgICAgICAgIC8vIElmIG5vdCwgdGhlcmUgaXMgbm8gcmVhc29uIHRvIHVzZSB0aGlzIGxpbmUsIGp1c3QgcHVzaCBpdCB0byB0aGUgbGlzdFxuICAgICAgICAgIC8vIGFuZCBzdGFydCBhIG5ldyBsaW5lIHdpdGggdGhlIGNoYXIgdGhhdCBuZWVkcyBlbmNvZGluZ1xuICAgICAgICAgIGlmICgoZW5jb2RlVVJJQ29tcG9uZW50KGxpbmUpICsgY2hyKS5sZW5ndGggPj0gbWF4TGVuZ3RoKSB7XG4gICAgICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgICAgICBsaW5lOiBsaW5lLFxuICAgICAgICAgICAgICBlbmNvZGVkOiBpc0VuY29kZWRcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBsaW5lID0gJydcbiAgICAgICAgICAgIHN0YXJ0UG9zID0gaSAtIDFcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaXNFbmNvZGVkID0gdHJ1ZVxuICAgICAgICAgICAgaSA9IHN0YXJ0UG9zXG4gICAgICAgICAgICBsaW5lID0gJydcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgICAgICAgICAgLy8gaWYgdGhlIGxpbmUgaXMgYWxyZWFkeSB0b28gbG9uZywgcHVzaCBpdCB0byB0aGUgbGlzdCBhbmQgc3RhcnQgYSBuZXcgb25lXG4gICAgICBpZiAoKGxpbmUgKyBjaHIpLmxlbmd0aCA+PSBtYXhMZW5ndGgpIHtcbiAgICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgICBsaW5lOiBsaW5lLFxuICAgICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgICB9KVxuICAgICAgICBsaW5lID0gY2hyID0gZW5jb2RlZFN0cltpXSA9PT0gJyAnID8gJyAnIDogZW5jb2RlVVJJQ29tcG9uZW50KGVuY29kZWRTdHJbaV0pXG4gICAgICAgIGlmIChjaHIgPT09IGVuY29kZWRTdHJbaV0pIHtcbiAgICAgICAgICBpc0VuY29kZWQgPSBmYWxzZVxuICAgICAgICAgIHN0YXJ0UG9zID0gaSAtIDFcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpc0VuY29kZWQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxpbmUgKz0gY2hyXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxpbmUpIHtcbiAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGlzdC5tYXAoZnVuY3Rpb24gKGl0ZW0sIGkpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAvLyBlbmNvZGVkIGxpbmVzOiB7bmFtZX0qe3BhcnR9KlxuICAgICAgICAgICAgICAvLyB1bmVuY29kZWQgbGluZXM6IHtuYW1lfSp7cGFydH1cbiAgICAgICAgICAgICAgLy8gaWYgYW55IGxpbmUgbmVlZHMgdG8gYmUgZW5jb2RlZCB0aGVuIHRoZSBmaXJzdCBsaW5lIChwYXJ0PT0wKSBpcyBhbHdheXMgZW5jb2RlZFxuICAgICAga2V5OiBrZXkgKyAnKicgKyBpICsgKGl0ZW0uZW5jb2RlZCA/ICcqJyA6ICcnKSxcbiAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGl0ZW0ubGluZSkgPyAnXCInICsgaXRlbS5saW5lICsgJ1wiJyA6IGl0ZW0ubGluZVxuICAgIH1cbiAgfSlcbn1cblxuLyoqXG4gKiBTcGxpdHMgYSBtaW1lIGVuY29kZWQgc3RyaW5nLiBOZWVkZWQgZm9yIGRpdmlkaW5nIG1pbWUgd29yZHMgaW50byBzbWFsbGVyIGNodW5rc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZyB0byBiZSBzcGxpdCB1cFxuICogQHBhcmFtIHtOdW1iZXJ9IG1heGxlbiBNYXhpbXVtIGxlbmd0aCBvZiBjaGFyYWN0ZXJzIGZvciBvbmUgcGFydCAobWluaW11bSAxMilcbiAqIEByZXR1cm4ge0FycmF5fSBTcGxpdCBzdHJpbmdcbiAqL1xuZnVuY3Rpb24gX3NwbGl0TWltZUVuY29kZWRTdHJpbmcgKHN0ciwgbWF4bGVuID0gMTIpIHtcbiAgY29uc3QgbWluV29yZExlbmd0aCA9IDEyIC8vIHJlcXVpcmUgYXQgbGVhc3QgMTIgc3ltYm9scyB0byBmaXQgcG9zc2libGUgNCBvY3RldCBVVEYtOCBzZXF1ZW5jZXNcbiAgY29uc3QgbWF4V29yZExlbmd0aCA9IE1hdGgubWF4KG1heGxlbiwgbWluV29yZExlbmd0aClcbiAgY29uc3QgbGluZXMgPSBbXVxuXG4gIHdoaWxlIChzdHIubGVuZ3RoKSB7XG4gICAgbGV0IGN1ckxpbmUgPSBzdHIuc3Vic3RyKDAsIG1heFdvcmRMZW5ndGgpXG5cbiAgICBjb25zdCBtYXRjaCA9IGN1ckxpbmUubWF0Y2goLz1bMC05QS1GXT8kL2kpIC8vIHNraXAgaW5jb21wbGV0ZSBlc2NhcGVkIGNoYXJcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGN1ckxpbmUgPSBjdXJMaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleClcbiAgICB9XG5cbiAgICBsZXQgZG9uZSA9IGZhbHNlXG4gICAgd2hpbGUgKCFkb25lKSB7XG4gICAgICBsZXQgY2hyXG4gICAgICBkb25lID0gdHJ1ZVxuICAgICAgY29uc3QgbWF0Y2ggPSBzdHIuc3Vic3RyKGN1ckxpbmUubGVuZ3RoKS5tYXRjaCgvXj0oWzAtOUEtRl17Mn0pL2kpIC8vIGNoZWNrIGlmIG5vdCBtaWRkbGUgb2YgYSB1bmljb2RlIGNoYXIgc2VxdWVuY2VcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBjaHIgPSBwYXJzZUludChtYXRjaFsxXSwgMTYpXG4gICAgICAgIC8vIGludmFsaWQgc2VxdWVuY2UsIG1vdmUgb25lIGNoYXIgYmFjayBhbmMgcmVjaGVja1xuICAgICAgICBpZiAoY2hyIDwgMHhDMiAmJiBjaHIgPiAweDdGKSB7XG4gICAgICAgICAgY3VyTGluZSA9IGN1ckxpbmUuc3Vic3RyKDAsIGN1ckxpbmUubGVuZ3RoIC0gMylcbiAgICAgICAgICBkb25lID0gZmFsc2VcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjdXJMaW5lLmxlbmd0aCkge1xuICAgICAgbGluZXMucHVzaChjdXJMaW5lKVxuICAgIH1cbiAgICBzdHIgPSBzdHIuc3Vic3RyKGN1ckxpbmUubGVuZ3RoKVxuICB9XG5cbiAgcmV0dXJuIGxpbmVzXG59XG5cbmZ1bmN0aW9uIF9hZGRCYXNlNjRTb2Z0TGluZWJyZWFrcyAoYmFzZTY0RW5jb2RlZFN0ciA9ICcnKSB7XG4gIHJldHVybiBiYXNlNjRFbmNvZGVkU3RyLnRyaW0oKS5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIE1BWF9MSU5FX0xFTkdUSCArICd9JywgJ2cnKSwgJyQmXFxyXFxuJykudHJpbSgpXG59XG5cbiAgLyoqXG4gICAqIEFkZHMgc29mdCBsaW5lIGJyZWFrcyh0aGUgb25lcyB0aGF0IHdpbGwgYmUgc3RyaXBwZWQgb3V0IHdoZW4gZGVjb2RpbmcgUVApXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBxcEVuY29kZWRTdHIgU3RyaW5nIGluIFF1b3RlZC1QcmludGFibGUgZW5jb2RpbmdcbiAgICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBmb3JjZWQgbGluZSBicmVha3NcbiAgICovXG5mdW5jdGlvbiBfYWRkUVBTb2Z0TGluZWJyZWFrcyAocXBFbmNvZGVkU3RyID0gJycpIHtcbiAgbGV0IHBvcyA9IDBcbiAgY29uc3QgbGVuID0gcXBFbmNvZGVkU3RyLmxlbmd0aFxuICBjb25zdCBsaW5lTWFyZ2luID0gTWF0aC5mbG9vcihNQVhfTElORV9MRU5HVEggLyAzKVxuICBsZXQgcmVzdWx0ID0gJydcbiAgbGV0IG1hdGNoLCBsaW5lXG5cbiAgICAgIC8vIGluc2VydCBzb2Z0IGxpbmVicmVha3Mgd2hlcmUgbmVlZGVkXG4gIHdoaWxlIChwb3MgPCBsZW4pIHtcbiAgICBsaW5lID0gcXBFbmNvZGVkU3RyLnN1YnN0cihwb3MsIE1BWF9MSU5FX0xFTkdUSClcbiAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvXFxyXFxuLykpKSB7XG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbWF0Y2guaW5kZXggKyBtYXRjaFswXS5sZW5ndGgpXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH1cblxuICAgIGlmIChsaW5lLnN1YnN0cigtMSkgPT09ICdcXG4nKSB7XG4gICAgICAvLyBub3RoaW5nIHRvIGNoYW5nZSBoZXJlXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gbGluZS5zdWJzdHIoLWxpbmVNYXJnaW4pLm1hdGNoKC9cXG4uKj8kLykpKSB7XG4gICAgICAvLyB0cnVuY2F0ZSB0byBuZWFyZXN0IGxpbmUgYnJlYWtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAxKSlcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmIChsaW5lLmxlbmd0aCA+IE1BWF9MSU5FX0xFTkdUSCAtIGxpbmVNYXJnaW4gJiYgKG1hdGNoID0gbGluZS5zdWJzdHIoLWxpbmVNYXJnaW4pLm1hdGNoKC9bIFxcdC4sIT9dW14gXFx0LiwhP10qJC8pKSkge1xuICAgICAgLy8gdHJ1bmNhdGUgdG8gbmVhcmVzdCBzcGFjZVxuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIDEpKVxuICAgIH0gZWxzZSBpZiAobGluZS5zdWJzdHIoLTEpID09PSAnXFxyJykge1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMSlcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGxpbmUubWF0Y2goLz1bXFxkYS1mXXswLDJ9JC9pKSkge1xuICAgICAgICAvLyBwdXNoIGluY29tcGxldGUgZW5jb2Rpbmcgc2VxdWVuY2VzIHRvIHRoZSBuZXh0IGxpbmVcbiAgICAgICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goLz1bXFxkYS1mXXswLDF9JC9pKSkpIHtcbiAgICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSBtYXRjaFswXS5sZW5ndGgpXG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbnN1cmUgdGhhdCB1dGYtOCBzZXF1ZW5jZXMgYXJlIG5vdCBzcGxpdFxuICAgICAgICB3aGlsZSAobGluZS5sZW5ndGggPiAzICYmIGxpbmUubGVuZ3RoIDwgbGVuIC0gcG9zICYmICFsaW5lLm1hdGNoKC9eKD86PVtcXGRhLWZdezJ9KXsxLDR9JC9pKSAmJiAobWF0Y2ggPSBsaW5lLm1hdGNoKC89W1xcZGEtZl17Mn0kL2lnKSkpIHtcbiAgICAgICAgICBjb25zdCBjb2RlID0gcGFyc2VJbnQobWF0Y2hbMF0uc3Vic3RyKDEsIDIpLCAxNilcbiAgICAgICAgICBpZiAoY29kZSA8IDEyOCkge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAzKVxuXG4gICAgICAgICAgaWYgKGNvZGUgPj0gMHhDMCkge1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocG9zICsgbGluZS5sZW5ndGggPCBsZW4gJiYgbGluZS5zdWJzdHIoLTEpICE9PSAnXFxuJykge1xuICAgICAgaWYgKGxpbmUubGVuZ3RoID09PSBNQVhfTElORV9MRU5HVEggJiYgbGluZS5tYXRjaCgvPVtcXGRhLWZdezJ9JC9pKSkge1xuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAzKVxuICAgICAgfSBlbHNlIGlmIChsaW5lLmxlbmd0aCA9PT0gTUFYX0xJTkVfTEVOR1RIKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDEpXG4gICAgICB9XG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGxpbmUgKz0gJz1cXHJcXG4nXG4gICAgfSBlbHNlIHtcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgIH1cblxuICAgIHJlc3VsdCArPSBsaW5lXG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbmV4cG9ydCB7IGRlY29kZSwgZW5jb2RlLCBjb252ZXJ0IH1cbiJdfQ==