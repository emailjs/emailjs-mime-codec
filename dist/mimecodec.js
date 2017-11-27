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
 * @param {String|Uint8Array} data String to be base64 encoded
 * @param {String} [fromCharset='UTF-8']
 * @return {String} Base64 encoded string
 */
function base64Encode(data, fromCharset) {
  var buf = fromCharset !== 'binary' && typeof data !== 'string' ? (0, _charset.convert)(data || '', fromCharset) : data;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMuanMiXSwibmFtZXMiOlsibWltZUVuY29kZSIsIm1pbWVEZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJiYXNlNjREZWNvZGUiLCJxdW90ZWRQcmludGFibGVFbmNvZGUiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsIm1pbWVXb3JkRGVjb2RlIiwibWltZVdvcmRzRGVjb2RlIiwiZm9sZExpbmVzIiwiaGVhZGVyTGluZUVuY29kZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lc0RlY29kZSIsInBhcnNlSGVhZGVyVmFsdWUiLCJjb250aW51YXRpb25FbmNvZGUiLCJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsImRhdGEiLCJmcm9tQ2hhcnNldCIsImJ1ZmZlciIsInJlZHVjZSIsImFnZ3JlZ2F0ZSIsIm9yZCIsImluZGV4IiwiX2NoZWNrUmFuZ2VzIiwibGVuZ3RoIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidG9TdHJpbmciLCJ0b1VwcGVyQ2FzZSIsIm5yIiwicmFuZ2VzIiwidmFsIiwicmFuZ2UiLCJzdHIiLCJlbmNvZGVkQnl0ZXNDb3VudCIsIm1hdGNoIiwiVWludDhBcnJheSIsImkiLCJsZW4iLCJidWZmZXJQb3MiLCJoZXgiLCJzdWJzdHIiLCJjaHIiLCJjaGFyQXQiLCJ0ZXN0IiwicGFyc2VJbnQiLCJjaGFyQ29kZUF0IiwiYnVmIiwiYjY0IiwiX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzIiwibWltZUVuY29kZWRTdHIiLCJyZXBsYWNlIiwic3BhY2VzIiwiX2FkZFFQU29mdExpbmVicmVha3MiLCJyYXdTdHJpbmciLCJtaW1lV29yZEVuY29kaW5nIiwiZW5jb2RlZFN0ciIsIm1heExlbmd0aCIsIl9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nIiwiam9pbiIsIk1hdGgiLCJtYXgiLCJwYXJ0cyIsInB1c2giLCJyZWdleCIsInNwbGl0Iiwic2hpZnQiLCJlbmNvZGluZyIsIm1pbWVXb3JkIiwiYWZ0ZXJTcGFjZSIsInBvcyIsInJlc3VsdCIsImxpbmUiLCJrZXkiLCJ2YWx1ZSIsImVuY29kZWRWYWx1ZSIsImhlYWRlckxpbmUiLCJ0cmltIiwiaGVhZGVycyIsImxpbmVzIiwiaGVhZGVyc09iaiIsInNwbGljZSIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiY29uY2F0IiwicmVzcG9uc2UiLCJwYXJhbXMiLCJ0eXBlIiwicXVvdGUiLCJlc2NhcGVkIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJhY3R1YWxLZXkiLCJOdW1iZXIiLCJjaGFyc2V0IiwidmFsdWVzIiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwicyIsImMiLCJsaXN0Iiwic3RhcnRQb3MiLCJpc0VuY29kZWQiLCJSZWdFeHAiLCJlbmNvZGVVUklDb21wb25lbnQiLCJlbmNvZGVkIiwiaXRlbSIsIm1heGxlbiIsIm1pbldvcmRMZW5ndGgiLCJtYXhXb3JkTGVuZ3RoIiwiY3VyTGluZSIsImRvbmUiLCJiYXNlNjRFbmNvZGVkU3RyIiwicXBFbmNvZGVkU3RyIiwibGluZU1hcmdpbiIsImZsb29yIiwiY29kZSIsImRlY29kZSIsImVuY29kZSIsImNvbnZlcnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztRQWlCZ0JBLFUsR0FBQUEsVTtRQTBCQUMsVSxHQUFBQSxVO1FBMEJBQyxZLEdBQUFBLFk7UUFhQUMsWSxHQUFBQSxZO1FBYUFDLHFCLEdBQUFBLHFCO1FBZ0JBQyxxQixHQUFBQSxxQjtRQWdCQUMsYyxHQUFBQSxjO1FBcUNBQyxlLEdBQUFBLGU7UUFXQUMsYyxHQUFBQSxjO1FBMEJBQyxlLEdBQUFBLGU7UUFnQkFDLFMsR0FBQUEsUztRQTBDQUMsZ0IsR0FBQUEsZ0I7UUFZQUMsZ0IsR0FBQUEsZ0I7UUFpQkFDLGlCLEdBQUFBLGlCO1FBeUNBQyxnQixHQUFBQSxnQjtRQWlJQUMsa0IsR0FBQUEsa0I7O0FBMWNoQjs7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsSUFB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SUFBVjtBQUNEOztBQUVELFNBQU9ELE1BQVA7QUFDRDs7UUFFUWdELE07UUFBUUMsTTtRQUFRQyxPIiwiZmlsZSI6Im1pbWVjb2RlYy5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGVuY29kZSBhcyBlbmNvZGVCYXNlNjQsIGRlY29kZSBhcyBkZWNvZGVCYXNlNjQsIE9VVFBVVF9UWVBFRF9BUlJBWSB9IGZyb20gJ2VtYWlsanMtYmFzZTY0J1xuaW1wb3J0IHsgZW5jb2RlLCBkZWNvZGUsIGNvbnZlcnQgfSBmcm9tICcuL2NoYXJzZXQnXG5cbi8vIExpbmVzIGNhbid0IGJlIGxvbmdlciB0aGFuIDc2ICsgPENSPjxMRj4gPSA3OCBieXRlc1xuLy8gaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NSNzZWN0aW9uLTYuN1xuY29uc3QgTUFYX0xJTkVfTEVOR1RIID0gNzZcbmNvbnN0IE1BWF9NSU1FX1dPUkRfTEVOR1RIID0gNTJcblxuLyoqXG4gKiBFbmNvZGVzIGFsbCBub24gcHJpbnRhYmxlIGFuZCBub24gYXNjaWkgYnl0ZXMgdG8gPVhYIGZvcm0sIHdoZXJlIFhYIGlzIHRoZVxuICogYnl0ZSB2YWx1ZSBpbiBoZXguIFRoaXMgZnVuY3Rpb24gZG9lcyBub3QgY29udmVydCBsaW5lYnJlYWtzIGV0Yy4gaXRcbiAqIG9ubHkgZXNjYXBlcyBjaGFyYWN0ZXIgc2VxdWVuY2VzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBFaXRoZXIgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2UgZW5jb2RpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBlbmNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZUVuY29kZSAoZGF0YSA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgYnVmZmVyID0gY29udmVydChkYXRhLCBmcm9tQ2hhcnNldClcbiAgcmV0dXJuIGJ1ZmZlci5yZWR1Y2UoKGFnZ3JlZ2F0ZSwgb3JkLCBpbmRleCkgPT4gX2NoZWNrUmFuZ2VzKG9yZCkgJiZcbiAgICAhKChvcmQgPT09IDB4MjAgfHwgb3JkID09PSAweDA5KSAmJiAoaW5kZXggPT09IGJ1ZmZlci5sZW5ndGggLSAxIHx8IGJ1ZmZlcltpbmRleCArIDFdID09PSAweDBhIHx8IGJ1ZmZlcltpbmRleCArIDFdID09PSAweDBkKSlcbiAgICA/IGFnZ3JlZ2F0ZSArIFN0cmluZy5mcm9tQ2hhckNvZGUob3JkKSAvLyBpZiB0aGUgY2hhciBpcyBpbiBhbGxvd2VkIHJhbmdlLCB0aGVuIGtlZXAgYXMgaXMsIHVubGVzcyBpdCBpcyBhIHdzIGluIHRoZSBlbmQgb2YgYSBsaW5lXG4gICAgOiBhZ2dyZWdhdGUgKyAnPScgKyAob3JkIDwgMHgxMCA/ICcwJyA6ICcnKSArIG9yZC50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSwgJycpXG5cbiAgZnVuY3Rpb24gX2NoZWNrUmFuZ2VzIChucikge1xuICAgIGNvbnN0IHJhbmdlcyA9IFsgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDUjc2VjdGlvbi02LjdcbiAgICAgIFsweDA5XSwgLy8gPFRBQj5cbiAgICAgIFsweDBBXSwgLy8gPExGPlxuICAgICAgWzB4MERdLCAvLyA8Q1I+XG4gICAgICBbMHgyMCwgMHgzQ10sIC8vIDxTUD4hXCIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7XG4gICAgICBbMHgzRSwgMHg3RV0gLy8gPj9AQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVpbXFxdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1cbiAgICBdXG4gICAgcmV0dXJuIHJhbmdlcy5yZWR1Y2UoKHZhbCwgcmFuZ2UpID0+IHZhbCB8fCAocmFuZ2UubGVuZ3RoID09PSAxICYmIG5yID09PSByYW5nZVswXSkgfHwgKHJhbmdlLmxlbmd0aCA9PT0gMiAmJiBuciA+PSByYW5nZVswXSAmJiBuciA8PSByYW5nZVsxXSksIGZhbHNlKVxuICB9XG59XG5cbiAgLyoqXG4gICAqIERlY29kZXMgbWltZSBlbmNvZGVkIHN0cmluZyB0byBhbiB1bmljb2RlIHN0cmluZ1xuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2UgZW5jb2RpbmdcbiAgICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gICAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVEZWNvZGUgKHN0ciA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgZW5jb2RlZEJ5dGVzQ291bnQgPSAoc3RyLm1hdGNoKC89W1xcZGEtZkEtRl17Mn0vZykgfHwgW10pLmxlbmd0aFxuICBsZXQgYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkoc3RyLmxlbmd0aCAtIGVuY29kZWRCeXRlc0NvdW50ICogMilcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3RyLmxlbmd0aCwgYnVmZmVyUG9zID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgbGV0IGhleCA9IHN0ci5zdWJzdHIoaSArIDEsIDIpXG4gICAgY29uc3QgY2hyID0gc3RyLmNoYXJBdChpKVxuICAgIGlmIChjaHIgPT09ICc9JyAmJiBoZXggJiYgL1tcXGRhLWZBLUZdezJ9Ly50ZXN0KGhleCkpIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBwYXJzZUludChoZXgsIDE2KVxuICAgICAgaSArPSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIGJ1ZmZlcltidWZmZXJQb3MrK10gPSBjaHIuY2hhckNvZGVBdCgwKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZWNvZGUoYnVmZmVyLCBmcm9tQ2hhcnNldClcbn1cblxuICAvKipcbiAgICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiB0eXBlZCBhcnJheSBvZiBnaXZlbiBjaGFyc2V0IGludG8gdW5pY29kZVxuICAgKiBiYXNlNjQgc3RyaW5nLiBBbHNvIGFkZHMgbGluZSBicmVha3NcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBTdHJpbmcgdG8gYmUgYmFzZTY0IGVuY29kZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXVxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IEJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuICAgKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjRFbmNvZGUgKGRhdGEsIGZyb21DaGFyc2V0KSB7XG4gIGNvbnN0IGJ1ZiA9IChmcm9tQ2hhcnNldCAhPT0gJ2JpbmFyeScgJiYgdHlwZW9mIGRhdGEgIT09ICdzdHJpbmcnKSA/IGNvbnZlcnQoZGF0YSB8fCAnJywgZnJvbUNoYXJzZXQpIDogZGF0YVxuICBjb25zdCBiNjQgPSBlbmNvZGVCYXNlNjQoYnVmKVxuICByZXR1cm4gX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzKGI2NClcbn1cblxuICAvKipcbiAgICogRGVjb2RlcyBhIGJhc2U2NCBzdHJpbmcgb2YgYW55IGNoYXJzZXQgaW50byBhbiB1bmljb2RlIHN0cmluZ1xuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gc3RyIEJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIE9yaWdpbmFsIGNoYXJzZXQgb2YgdGhlIGJhc2U2NCBlbmNvZGVkIHN0cmluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAgICovXG5leHBvcnQgZnVuY3Rpb24gYmFzZTY0RGVjb2RlIChzdHIsIGZyb21DaGFyc2V0KSB7XG4gIHJldHVybiBkZWNvZGUoZGVjb2RlQmFzZTY0KHN0ciwgT1VUUFVUX1RZUEVEX0FSUkFZKSwgZnJvbUNoYXJzZXQpXG59XG5cbiAgLyoqXG4gICAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSBpbnRvIGEgcXVvdGVkIHByaW50YWJsZSBlbmNvZGluZ1xuICAgKiBUaGlzIGlzIGFsbW9zdCB0aGUgc2FtZSBhcyBtaW1lRW5jb2RlLCBleGNlcHQgbGluZSBicmVha3Mgd2lsbCBiZSBjaGFuZ2VkXG4gICAqIGFzIHdlbGwgdG8gZW5zdXJlIHRoYXQgdGhlIGxpbmVzIGFyZSBuZXZlciBsb25nZXIgdGhhbiBhbGxvd2VkIGxlbmd0aFxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyBvciBhbiBVaW50OEFycmF5IHRvIG1pbWUgZW5jb2RlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgc3RyaW5nXG4gICAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBlbmNvZGVkIHN0cmluZ1xuICAgKi9cbmV4cG9ydCBmdW5jdGlvbiBxdW90ZWRQcmludGFibGVFbmNvZGUgKGRhdGEgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IG1pbWVFbmNvZGVkU3RyID0gbWltZUVuY29kZShkYXRhLCBmcm9tQ2hhcnNldClcbiAgICAucmVwbGFjZSgvXFxyP1xcbnxcXHIvZywgJ1xcclxcbicpIC8vIGZpeCBsaW5lIGJyZWFrcywgZW5zdXJlIDxDUj48TEY+XG4gICAgLnJlcGxhY2UoL1tcXHQgXSskL2dtLCBzcGFjZXMgPT4gc3BhY2VzLnJlcGxhY2UoLyAvZywgJz0yMCcpLnJlcGxhY2UoL1xcdC9nLCAnPTA5JykpIC8vIHJlcGxhY2Ugc3BhY2VzIGluIHRoZSBlbmQgb2YgbGluZXNcblxuICByZXR1cm4gX2FkZFFQU29mdExpbmVicmVha3MobWltZUVuY29kZWRTdHIpIC8vIGFkZCBzb2Z0IGxpbmUgYnJlYWtzIHRvIGVuc3VyZSBsaW5lIGxlbmd0aHMgc2pvcnRlciB0aGFuIDc2IGJ5dGVzXG59XG5cbi8qKlxuICogRGVjb2RlcyBhIHN0cmluZyBmcm9tIGEgcXVvdGVkIHByaW50YWJsZSBlbmNvZGluZy4gVGhpcyBpcyBhbG1vc3QgdGhlXG4gKiBzYW1lIGFzIG1pbWVEZWNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWQgYXMgd2VsbFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZyB0byBkZWNvZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IE1pbWUgZGVjb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlZFByaW50YWJsZURlY29kZSAoc3RyID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCByYXdTdHJpbmcgPSBzdHJcbiAgICAucmVwbGFjZSgvW1xcdCBdKyQvZ20sICcnKSAvLyByZW1vdmUgaW52YWxpZCB3aGl0ZXNwYWNlIGZyb20gdGhlIGVuZCBvZiBsaW5lc1xuICAgIC5yZXBsYWNlKC89KD86XFxyP1xcbnwkKS9nLCAnJykgLy8gcmVtb3ZlIHNvZnQgbGluZSBicmVha3NcblxuICByZXR1cm4gbWltZURlY29kZShyYXdTdHJpbmcsIGZyb21DaGFyc2V0KVxufVxuXG4gIC8qKlxuICAgKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gYW4gVVRGLTggTUlNRSBXb3JkIChyZmMyMDQ3KVxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBzaGFyYWN0ZXIgc2V0XG4gICAqIEByZXR1cm4ge1N0cmluZ30gU2luZ2xlIG9yIHNldmVyYWwgbWltZSB3b3JkcyBqb2luZWQgdG9nZXRoZXJcbiAgICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRFbmNvZGUgKGRhdGEsIG1pbWVXb3JkRW5jb2RpbmcgPSAnUScsIGZyb21DaGFyc2V0KSB7XG4gIGxldCBlbmNvZGVkU3RyXG5cbiAgaWYgKG1pbWVXb3JkRW5jb2RpbmcgPT09ICdRJykge1xuICAgIGNvbnN0IG1heExlbmd0aCA9IE1BWF9NSU1FX1dPUkRfTEVOR1RIXG4gICAgZW5jb2RlZFN0ciA9IG1pbWVFbmNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gICAgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIwNDcjc2VjdGlvbi01IHJ1bGUgKDMpXG4gICAgZW5jb2RlZFN0ciA9IGVuY29kZWRTdHIucmVwbGFjZSgvW15hLXowLTkhKitcXC0vPV0vaWcsIGNociA9PiBjaHIgPT09ICcgJyA/ICdfJyA6ICgnPScgKyAoY2hyLmNoYXJDb2RlQXQoMCkgPCAweDEwID8gJzAnIDogJycpICsgY2hyLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkpKVxuICAgIGlmIChlbmNvZGVkU3RyLmxlbmd0aCA+IG1heExlbmd0aCkge1xuICAgICAgZW5jb2RlZFN0ciA9IF9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nKGVuY29kZWRTdHIsIG1heExlbmd0aCkuam9pbignPz0gPT9VVEYtOD8nICsgbWltZVdvcmRFbmNvZGluZyArICc/JylcbiAgICB9XG4gIH0gZWxzZSBpZiAobWltZVdvcmRFbmNvZGluZyA9PT0gJ0InKSB7XG4gICAgZW5jb2RlZFN0ciA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gICAgY29uc3QgbWF4TGVuZ3RoID0gTWF0aC5tYXgoMywgKE1BWF9NSU1FX1dPUkRfTEVOR1RIIC0gTUFYX01JTUVfV09SRF9MRU5HVEggJSA0KSAvIDQgKiAzKVxuICAgIGlmIChlbmNvZGVkU3RyLmxlbmd0aCA+IG1heExlbmd0aCkge1xuICAgICAgLy8gUkZDMjA0NyA2LjMgKDIpIHN0YXRlcyB0aGF0IGVuY29kZWQtd29yZCBtdXN0IGluY2x1ZGUgYW4gaW50ZWdyYWwgbnVtYmVyIG9mIGNoYXJhY3RlcnMsIHNvIG5vIGNob3BwaW5nIHVuaWNvZGUgc2VxdWVuY2VzXG4gICAgICBjb25zdCBwYXJ0cyA9IFtdXG4gICAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gZW5jb2RlZFN0ci5sZW5ndGg7IGkgPCBsZW47IGkgKz0gbWF4TGVuZ3RoKSB7XG4gICAgICAgIHBhcnRzLnB1c2goYmFzZTY0RW5jb2RlKGVuY29kZWRTdHIuc3Vic3RyKGksIG1heExlbmd0aCkpKVxuICAgICAgfVxuICAgICAgcmV0dXJuICc9P1VURi04PycgKyBtaW1lV29yZEVuY29kaW5nICsgJz8nICsgcGFydHMuam9pbignPz0gPT9VVEYtOD8nICsgbWltZVdvcmRFbmNvZGluZyArICc/JykgKyAnPz0nXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGVuY29kZWRTdHIgPSBiYXNlNjRFbmNvZGUoZW5jb2RlZFN0cilcbiAgfVxuXG4gIHJldHVybiAnPT9VVEYtOD8nICsgbWltZVdvcmRFbmNvZGluZyArICc/JyArIGVuY29kZWRTdHIgKyAoZW5jb2RlZFN0ci5zdWJzdHIoLTIpID09PSAnPz0nID8gJycgOiAnPz0nKVxufVxuXG4vKipcbiAqIEZpbmRzIHdvcmQgc2VxdWVuY2VzIHdpdGggbm9uIGFzY2lpIHRleHQgYW5kIGNvbnZlcnRzIHRoZXNlIHRvIG1pbWUgd29yZHNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gbWltZVdvcmRFbmNvZGluZz0nUScgRW5jb2RpbmcgZm9yIHRoZSBtaW1lIHdvcmQsIGVpdGhlciBRIG9yIEJcbiAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIHNoYXJhY3RlciBzZXRcbiAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggcG9zc2libGUgbWltZSB3b3Jkc1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWltZVdvcmRzRW5jb2RlIChkYXRhID0gJycsIG1pbWVXb3JkRW5jb2RpbmcgPSAnUScsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCByZWdleCA9IC8oW15cXHNcXHUwMDgwLVxcdUZGRkZdKltcXHUwMDgwLVxcdUZGRkZdK1teXFxzXFx1MDA4MC1cXHVGRkZGXSooPzpcXHMrW15cXHNcXHUwMDgwLVxcdUZGRkZdKltcXHUwMDgwLVxcdUZGRkZdK1teXFxzXFx1MDA4MC1cXHVGRkZGXSpcXHMqKT8pKy9nXG4gIHJldHVybiBkZWNvZGUoY29udmVydChkYXRhLCBmcm9tQ2hhcnNldCkpLnJlcGxhY2UocmVnZXgsIG1hdGNoID0+IG1hdGNoLmxlbmd0aCA/IG1pbWVXb3JkRW5jb2RlKG1hdGNoLCBtaW1lV29yZEVuY29kaW5nLCBmcm9tQ2hhcnNldCkgOiAnJylcbn1cblxuLyoqXG4gKiBEZWNvZGUgYSBjb21wbGV0ZSBtaW1lIHdvcmQgZW5jb2RlZCBzdHJpbmdcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZERlY29kZSAoc3RyID0gJycpIHtcbiAgY29uc3QgbWF0Y2ggPSBzdHIubWF0Y2goL149XFw/KFtcXHdfXFwtKl0rKVxcPyhbUXFCYl0pXFw/KFteP10rKVxcPz0kL2kpXG4gIGlmICghbWF0Y2gpIHJldHVybiBzdHJcblxuICAvLyBSRkMyMjMxIGFkZGVkIGxhbmd1YWdlIHRhZyB0byB0aGUgZW5jb2RpbmdcbiAgLy8gc2VlOiBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjIzMSNzZWN0aW9uLTVcbiAgLy8gdGhpcyBpbXBsZW1lbnRhdGlvbiBzaWxlbnRseSBpZ25vcmVzIHRoaXMgdGFnXG4gIGNvbnN0IGZyb21DaGFyc2V0ID0gbWF0Y2hbMV0uc3BsaXQoJyonKS5zaGlmdCgpXG4gIGNvbnN0IGVuY29kaW5nID0gKG1hdGNoWzJdIHx8ICdRJykudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpXG4gIGNvbnN0IHJhd1N0cmluZyA9IChtYXRjaFszXSB8fCAnJykucmVwbGFjZSgvXy9nLCAnICcpXG5cbiAgaWYgKGVuY29kaW5nID09PSAnQicpIHtcbiAgICByZXR1cm4gYmFzZTY0RGVjb2RlKHJhd1N0cmluZywgZnJvbUNoYXJzZXQpXG4gIH0gZWxzZSBpZiAoZW5jb2RpbmcgPT09ICdRJykge1xuICAgIHJldHVybiBtaW1lRGVjb2RlKHJhd1N0cmluZywgZnJvbUNoYXJzZXQpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIHN0clxuICB9XG59XG5cbi8qKlxuICogRGVjb2RlIGEgc3RyaW5nIHRoYXQgbWlnaHQgaW5jbHVkZSBvbmUgb3Igc2V2ZXJhbCBtaW1lIHdvcmRzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgaW5jbHVkaW5nIHNvbWUgbWltZSB3b3JkcyB0aGF0IHdpbGwgYmUgZW5jb2RlZFxuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHVuaWNvZGUgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZHNEZWNvZGUgKHN0ciA9ICcnKSB7XG4gIHN0ciA9IHN0ci50b1N0cmluZygpLnJlcGxhY2UoLyg9XFw/W14/XStcXD9bUXFCYl1cXD9bXj9dK1xcPz0pXFxzKyg/PT1cXD9bXj9dK1xcP1tRcUJiXVxcP1teP10qXFw/PSkvZywgJyQxJylcbiAgc3RyID0gc3RyLnJlcGxhY2UoL1xcPz09XFw/W3VVXVt0VF1bZkZdLThcXD9bUXFCYl1cXD8vZywgJycpIC8vIGpvaW4gYnl0ZXMgb2YgbXVsdGktYnl0ZSBVVEYtOFxuICBzdHIgPSBzdHIucmVwbGFjZSgvPVxcP1tcXHdfXFwtKl0rXFw/W1FxQmJdXFw/W14/XStcXD89L2csIG1pbWVXb3JkID0+IG1pbWVXb3JkRGVjb2RlKG1pbWVXb3JkLnJlcGxhY2UoL1xccysvZywgJycpKSlcblxuICByZXR1cm4gc3RyXG59XG5cbi8qKlxuICogRm9sZHMgbG9uZyBsaW5lcywgdXNlZnVsIGZvciBmb2xkaW5nIGhlYWRlciBsaW5lcyAoYWZ0ZXJTcGFjZT1mYWxzZSkgYW5kXG4gKiBmbG93ZWQgdGV4dCAoYWZ0ZXJTcGFjZT10cnVlKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIGJlIGZvbGRlZFxuICogQHBhcmFtIHtCb29sZWFufSBhZnRlclNwYWNlIElmIHRydWUsIGxlYXZlIGEgc3BhY2UgaW4gdGggZW5kIG9mIGEgbGluZVxuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBmb2xkZWQgbGluZXNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvbGRMaW5lcyAoc3RyID0gJycsIGFmdGVyU3BhY2UpIHtcbiAgbGV0IHBvcyA9IDBcbiAgY29uc3QgbGVuID0gc3RyLmxlbmd0aFxuICBsZXQgcmVzdWx0ID0gJydcbiAgbGV0IGxpbmUsIG1hdGNoXG5cbiAgd2hpbGUgKHBvcyA8IGxlbikge1xuICAgIGxpbmUgPSBzdHIuc3Vic3RyKHBvcywgTUFYX0xJTkVfTEVOR1RIKVxuICAgIGlmIChsaW5lLmxlbmd0aCA8IE1BWF9MSU5FX0xFTkdUSCkge1xuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC9eW15cXG5cXHJdKihcXHI/XFxufFxccikvKSkpIHtcbiAgICAgIGxpbmUgPSBtYXRjaFswXVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9IGVsc2UgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goLyhcXHMrKVteXFxzXSokLykpICYmIG1hdGNoWzBdLmxlbmd0aCAtIChhZnRlclNwYWNlID8gKG1hdGNoWzFdIHx8ICcnKS5sZW5ndGggOiAwKSA8IGxpbmUubGVuZ3RoKSB7XG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gKGFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApKSlcbiAgICB9IGVsc2UgaWYgKChtYXRjaCA9IHN0ci5zdWJzdHIocG9zICsgbGluZS5sZW5ndGgpLm1hdGNoKC9eW15cXHNdKyhcXHMqKS8pKSkge1xuICAgICAgbGluZSA9IGxpbmUgKyBtYXRjaFswXS5zdWJzdHIoMCwgbWF0Y2hbMF0ubGVuZ3RoIC0gKCFhZnRlclNwYWNlID8gKG1hdGNoWzFdIHx8ICcnKS5sZW5ndGggOiAwKSlcbiAgICB9XG5cbiAgICByZXN1bHQgKz0gbGluZVxuICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgIGlmIChwb3MgPCBsZW4pIHtcbiAgICAgIHJlc3VsdCArPSAnXFxyXFxuJ1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuICAvKipcbiAgICogRW5jb2RlcyBhbmQgZm9sZHMgYSBoZWFkZXIgbGluZSBmb3IgYSBNSU1FIG1lc3NhZ2UgaGVhZGVyLlxuICAgKiBTaG9ydGhhbmQgZm9yIG1pbWVXb3Jkc0VuY29kZSArIGZvbGRMaW5lc1xuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5IEtleSBuYW1lLCB3aWxsIG5vdCBiZSBlbmNvZGVkXG4gICAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IHZhbHVlIFZhbHVlIHRvIGJlIGVuY29kZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBDaGFyYWN0ZXIgc2V0IG9mIHRoZSB2YWx1ZVxuICAgKiBAcmV0dXJuIHtTdHJpbmd9IGVuY29kZWQgYW5kIGZvbGRlZCBoZWFkZXIgbGluZVxuICAgKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkZXJMaW5lRW5jb2RlIChrZXksIHZhbHVlLCBmcm9tQ2hhcnNldCkge1xuICB2YXIgZW5jb2RlZFZhbHVlID0gbWltZVdvcmRzRW5jb2RlKHZhbHVlLCAnUScsIGZyb21DaGFyc2V0KVxuICByZXR1cm4gZm9sZExpbmVzKGtleSArICc6ICcgKyBlbmNvZGVkVmFsdWUpXG59XG5cbi8qKlxuICogVGhlIHJlc3VsdCBpcyBub3QgbWltZSB3b3JkIGRlY29kZWQsIHlvdSBuZWVkIHRvIGRvIHlvdXIgb3duIGRlY29kaW5nIGJhc2VkXG4gKiBvbiB0aGUgcnVsZXMgZm9yIHRoZSBzcGVjaWZpYyBoZWFkZXIga2V5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGhlYWRlckxpbmUgU2luZ2xlIGhlYWRlciBsaW5lLCBtaWdodCBpbmNsdWRlIGxpbmVicmVha3MgYXMgd2VsbCBpZiBmb2xkZWRcbiAqIEByZXR1cm4ge09iamVjdH0gQW5kIG9iamVjdCBvZiB7a2V5LCB2YWx1ZX1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVEZWNvZGUgKGhlYWRlckxpbmUgPSAnJykge1xuICBjb25zdCBsaW5lID0gaGVhZGVyTGluZS50b1N0cmluZygpLnJlcGxhY2UoLyg/Olxccj9cXG58XFxyKVsgXFx0XSovZywgJyAnKS50cmltKClcbiAgY29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eXFxzKihbXjpdKyk6KC4qKSQvKVxuXG4gIHJldHVybiB7XG4gICAga2V5OiAoKG1hdGNoICYmIG1hdGNoWzFdKSB8fCAnJykudHJpbSgpLFxuICAgIHZhbHVlOiAoKG1hdGNoICYmIG1hdGNoWzJdKSB8fCAnJykudHJpbSgpXG4gIH1cbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBibG9jayBvZiBoZWFkZXIgbGluZXMuIERvZXMgbm90IGRlY29kZSBtaW1lIHdvcmRzIGFzIGV2ZXJ5XG4gKiBoZWFkZXIgbWlnaHQgaGF2ZSBpdHMgb3duIHJ1bGVzIChlZy4gZm9ybWF0dGVkIGVtYWlsIGFkZHJlc3NlcyBhbmQgc3VjaClcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVycyBIZWFkZXJzIHN0cmluZ1xuICogQHJldHVybiB7T2JqZWN0fSBBbiBvYmplY3Qgb2YgaGVhZGVycywgd2hlcmUgaGVhZGVyIGtleXMgYXJlIG9iamVjdCBrZXlzLiBOQiEgU2V2ZXJhbCB2YWx1ZXMgd2l0aCB0aGUgc2FtZSBrZXkgbWFrZSB1cCBhbiBBcnJheVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZXNEZWNvZGUgKGhlYWRlcnMpIHtcbiAgY29uc3QgbGluZXMgPSBoZWFkZXJzLnNwbGl0KC9cXHI/XFxufFxcci8pXG4gIGNvbnN0IGhlYWRlcnNPYmogPSB7fVxuXG4gIGZvciAobGV0IGkgPSBsaW5lcy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIGlmIChpICYmIGxpbmVzW2ldLm1hdGNoKC9eXFxzLykpIHtcbiAgICAgIGxpbmVzW2kgLSAxXSArPSAnXFxyXFxuJyArIGxpbmVzW2ldXG4gICAgICBsaW5lcy5zcGxpY2UoaSwgMSlcbiAgICB9XG4gIH1cblxuICBmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjb25zdCBoZWFkZXIgPSBoZWFkZXJMaW5lRGVjb2RlKGxpbmVzW2ldKVxuICAgIGNvbnN0IGtleSA9IGhlYWRlci5rZXkudG9Mb3dlckNhc2UoKVxuICAgIGNvbnN0IHZhbHVlID0gaGVhZGVyLnZhbHVlXG5cbiAgICBpZiAoIWhlYWRlcnNPYmpba2V5XSkge1xuICAgICAgaGVhZGVyc09ialtrZXldID0gdmFsdWVcbiAgICB9IGVsc2Uge1xuICAgICAgaGVhZGVyc09ialtrZXldID0gW10uY29uY2F0KGhlYWRlcnNPYmpba2V5XSwgdmFsdWUpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGhlYWRlcnNPYmpcbn1cblxuLyoqXG4gKiBQYXJzZXMgYSBoZWFkZXIgdmFsdWUgd2l0aCBrZXk9dmFsdWUgYXJndW1lbnRzIGludG8gYSBzdHJ1Y3R1cmVkXG4gKiBvYmplY3QuXG4gKlxuICogICBwYXJzZUhlYWRlclZhbHVlKCdjb250ZW50LXR5cGU6IHRleHQvcGxhaW47IENIQVJTRVQ9J1VURi04JycpIC0+XG4gKiAgIHtcbiAqICAgICAndmFsdWUnOiAndGV4dC9wbGFpbicsXG4gKiAgICAgJ3BhcmFtcyc6IHtcbiAqICAgICAgICdjaGFyc2V0JzogJ1VURi04J1xuICogICAgIH1cbiAqICAgfVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgSGVhZGVyIHZhbHVlXG4gKiBAcmV0dXJuIHtPYmplY3R9IEhlYWRlciB2YWx1ZSBhcyBhIHBhcnNlZCBzdHJ1Y3R1cmVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlSGVhZGVyVmFsdWUgKHN0cikge1xuICBsZXQgcmVzcG9uc2UgPSB7XG4gICAgdmFsdWU6IGZhbHNlLFxuICAgIHBhcmFtczoge31cbiAgfVxuICBsZXQga2V5ID0gZmFsc2VcbiAgbGV0IHZhbHVlID0gJydcbiAgbGV0IHR5cGUgPSAndmFsdWUnXG4gIGxldCBxdW90ZSA9IGZhbHNlXG4gIGxldCBlc2NhcGVkID0gZmFsc2VcbiAgbGV0IGNoclxuXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBzdHIubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBjaHIgPSBzdHIuY2hhckF0KGkpXG4gICAgaWYgKHR5cGUgPT09ICdrZXknKSB7XG4gICAgICBpZiAoY2hyID09PSAnPScpIHtcbiAgICAgICAga2V5ID0gdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgdHlwZSA9ICd2YWx1ZSdcbiAgICAgICAgdmFsdWUgPSAnJ1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgICAgdmFsdWUgKz0gY2hyXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChlc2NhcGVkKSB7XG4gICAgICAgIHZhbHVlICs9IGNoclxuICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICdcXFxcJykge1xuICAgICAgICBlc2NhcGVkID0gdHJ1ZVxuICAgICAgICBjb250aW51ZVxuICAgICAgfSBlbHNlIGlmIChxdW90ZSAmJiBjaHIgPT09IHF1b3RlKSB7XG4gICAgICAgIHF1b3RlID0gZmFsc2VcbiAgICAgIH0gZWxzZSBpZiAoIXF1b3RlICYmIGNociA9PT0gJ1wiJykge1xuICAgICAgICBxdW90ZSA9IGNoclxuICAgICAgfSBlbHNlIGlmICghcXVvdGUgJiYgY2hyID09PSAnOycpIHtcbiAgICAgICAgaWYgKGtleSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICByZXNwb25zZS52YWx1ZSA9IHZhbHVlLnRyaW0oKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gdmFsdWUudHJpbSgpXG4gICAgICAgIH1cbiAgICAgICAgdHlwZSA9ICdrZXknXG4gICAgICAgIHZhbHVlID0gJydcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlICs9IGNoclxuICAgICAgfVxuICAgICAgZXNjYXBlZCA9IGZhbHNlXG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGUgPT09ICd2YWx1ZScpIHtcbiAgICBpZiAoa2V5ID09PSBmYWxzZSkge1xuICAgICAgcmVzcG9uc2UudmFsdWUgPSB2YWx1ZS50cmltKClcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZS50cmltKClcbiAgICB9XG4gIH0gZWxzZSBpZiAodmFsdWUudHJpbSgpKSB7XG4gICAgcmVzcG9uc2UucGFyYW1zW3ZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpXSA9ICcnXG4gIH1cblxuICAvLyBoYW5kbGUgcGFyYW1ldGVyIHZhbHVlIGNvbnRpbnVhdGlvbnNcbiAgLy8gaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIyMzEjc2VjdGlvbi0zXG5cbiAgLy8gcHJlcHJvY2VzcyB2YWx1ZXNcbiAgT2JqZWN0LmtleXMocmVzcG9uc2UucGFyYW1zKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICB2YXIgYWN0dWFsS2V5LCBuciwgbWF0Y2gsIHZhbHVlXG4gICAgaWYgKChtYXRjaCA9IGtleS5tYXRjaCgvKFxcKihcXGQrKXxcXCooXFxkKylcXCp8XFwqKSQvKSkpIHtcbiAgICAgIGFjdHVhbEtleSA9IGtleS5zdWJzdHIoMCwgbWF0Y2guaW5kZXgpXG4gICAgICBuciA9IE51bWJlcihtYXRjaFsyXSB8fCBtYXRjaFszXSkgfHwgMFxuXG4gICAgICBpZiAoIXJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldIHx8IHR5cGVvZiByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gPSB7XG4gICAgICAgICAgY2hhcnNldDogZmFsc2UsXG4gICAgICAgICAgdmFsdWVzOiBbXVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhbHVlID0gcmVzcG9uc2UucGFyYW1zW2tleV1cblxuICAgICAgaWYgKG5yID09PSAwICYmIG1hdGNoWzBdLnN1YnN0cigtMSkgPT09ICcqJyAmJiAobWF0Y2ggPSB2YWx1ZS5tYXRjaCgvXihbXiddKiknW14nXSonKC4qKSQvKSkpIHtcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0uY2hhcnNldCA9IG1hdGNoWzFdIHx8ICdpc28tODg1OS0xJ1xuICAgICAgICB2YWx1ZSA9IG1hdGNoWzJdXG4gICAgICB9XG5cbiAgICAgIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldLnZhbHVlc1tucl0gPSB2YWx1ZVxuXG4gICAgICAvLyByZW1vdmUgdGhlIG9sZCByZWZlcmVuY2VcbiAgICAgIGRlbGV0ZSByZXNwb25zZS5wYXJhbXNba2V5XVxuICAgIH1cbiAgfSlcblxuICAgICAgLy8gY29uY2F0ZW5hdGUgc3BsaXQgcmZjMjIzMSBzdHJpbmdzIGFuZCBjb252ZXJ0IGVuY29kZWQgc3RyaW5ncyB0byBtaW1lIGVuY29kZWQgd29yZHNcbiAgT2JqZWN0LmtleXMocmVzcG9uc2UucGFyYW1zKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICB2YXIgdmFsdWVcbiAgICBpZiAocmVzcG9uc2UucGFyYW1zW2tleV0gJiYgQXJyYXkuaXNBcnJheShyZXNwb25zZS5wYXJhbXNba2V5XS52YWx1ZXMpKSB7XG4gICAgICB2YWx1ZSA9IHJlc3BvbnNlLnBhcmFtc1trZXldLnZhbHVlcy5tYXAoZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICByZXR1cm4gdmFsIHx8ICcnXG4gICAgICB9KS5qb2luKCcnKVxuXG4gICAgICBpZiAocmVzcG9uc2UucGFyYW1zW2tleV0uY2hhcnNldCkge1xuICAgICAgICAvLyBjb252ZXJ0IFwiJUFCXCIgdG8gXCI9P2NoYXJzZXQ/UT89QUI/PVwiXG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gJz0/JyArIHJlc3BvbnNlLnBhcmFtc1trZXldLmNoYXJzZXQgKyAnP1E/JyArIHZhbHVlXG4gICAgICAgICAgLnJlcGxhY2UoL1s9P19cXHNdL2csIGZ1bmN0aW9uIChzKSB7XG4gICAgICAgICAgICAvLyBmaXggaW52YWxpZGx5IGVuY29kZWQgY2hhcnNcbiAgICAgICAgICAgIHZhciBjID0gcy5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KVxuICAgICAgICAgICAgcmV0dXJuIHMgPT09ICcgJyA/ICdfJyA6ICclJyArIChjLmxlbmd0aCA8IDIgPyAnMCcgOiAnJykgKyBjXG4gICAgICAgICAgfSlcbiAgICAgICAgICAucmVwbGFjZSgvJS9nLCAnPScpICsgJz89JyAvLyBjaGFuZ2UgZnJvbSB1cmxlbmNvZGluZyB0byBwZXJjZW50IGVuY29kaW5nXG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlXG4gICAgICB9XG4gICAgfVxuICB9KVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuXG4vKipcbiAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBQYXJhbWV0ZXIgVmFsdWUgQ29udGludWF0aW9uIGVuY29kaW5nIChyZmMyMjMxKVxuICogVXNlZnVsIGZvciBzcGxpdHRpbmcgbG9uZyBwYXJhbWV0ZXIgdmFsdWVzLlxuICpcbiAqIEZvciBleGFtcGxlXG4gKiAgICAgIHRpdGxlPVwidW5pY29kZSBzdHJpbmdcIlxuICogYmVjb21lc1xuICogICAgIHRpdGxlKjAqPVwidXRmLTgnJ3VuaWNvZGVcIlxuICogICAgIHRpdGxlKjEqPVwiJTIwc3RyaW5nXCJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcGFyYW0ge051bWJlcn0gW21heExlbmd0aD01MF0gTWF4IGxlbmd0aCBmb3IgZ2VuZXJhdGVkIGNodW5rc1xuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7QXJyYXl9IEEgbGlzdCBvZiBlbmNvZGVkIGtleXMgYW5kIGhlYWRlcnNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnRpbnVhdGlvbkVuY29kZSAoa2V5LCBkYXRhLCBtYXhMZW5ndGgsIGZyb21DaGFyc2V0KSB7XG4gIGNvbnN0IGxpc3QgPSBbXVxuICB2YXIgZW5jb2RlZFN0ciA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBkZWNvZGUoZGF0YSwgZnJvbUNoYXJzZXQpXG4gIHZhciBsaW5lXG4gIHZhciBzdGFydFBvcyA9IDBcbiAgdmFyIGlzRW5jb2RlZCA9IGZhbHNlXG5cbiAgbWF4TGVuZ3RoID0gbWF4TGVuZ3RoIHx8IDUwXG5cbiAgICAgIC8vIHByb2Nlc3MgYXNjaWkgb25seSB0ZXh0XG4gIGlmICgvXltcXHcuXFwtIF0qJC8udGVzdChkYXRhKSkge1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGNvbnZlcnNpb24gaXMgZXZlbiBuZWVkZWRcbiAgICBpZiAoZW5jb2RlZFN0ci5sZW5ndGggPD0gbWF4TGVuZ3RoKSB7XG4gICAgICByZXR1cm4gW3tcbiAgICAgICAga2V5OiBrZXksXG4gICAgICAgIHZhbHVlOiAvW1xcc1wiOz1dLy50ZXN0KGVuY29kZWRTdHIpID8gJ1wiJyArIGVuY29kZWRTdHIgKyAnXCInIDogZW5jb2RlZFN0clxuICAgICAgfV1cbiAgICB9XG5cbiAgICBlbmNvZGVkU3RyID0gZW5jb2RlZFN0ci5yZXBsYWNlKG5ldyBSZWdFeHAoJy57JyArIG1heExlbmd0aCArICd9JywgJ2cnKSwgZnVuY3Rpb24gKHN0cikge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogc3RyXG4gICAgICB9KVxuICAgICAgcmV0dXJuICcnXG4gICAgfSlcblxuICAgIGlmIChlbmNvZGVkU3RyKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBlbmNvZGVkU3RyXG4gICAgICB9KVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICAvLyBmaXJzdCBsaW5lIGluY2x1ZGVzIHRoZSBjaGFyc2V0IGFuZCBsYW5ndWFnZSBpbmZvIGFuZCBuZWVkcyB0byBiZSBlbmNvZGVkXG4gICAgLy8gZXZlbiBpZiBpdCBkb2VzIG5vdCBjb250YWluIGFueSB1bmljb2RlIGNoYXJhY3RlcnNcbiAgICBsaW5lID0gJ3V0Zi04XFwnXFwnJ1xuICAgIGlzRW5jb2RlZCA9IHRydWVcbiAgICBzdGFydFBvcyA9IDBcbiAgICAvLyBwcm9jZXNzIHRleHQgd2l0aCB1bmljb2RlIG9yIHNwZWNpYWwgY2hhcnNcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gZW5jb2RlZFN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGNociA9IGVuY29kZWRTdHJbaV1cblxuICAgICAgaWYgKGlzRW5jb2RlZCkge1xuICAgICAgICBjaHIgPSBlbmNvZGVVUklDb21wb25lbnQoY2hyKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdHJ5IHRvIHVybGVuY29kZSBjdXJyZW50IGNoYXJcbiAgICAgICAgY2hyID0gY2hyID09PSAnICcgPyBjaHIgOiBlbmNvZGVVUklDb21wb25lbnQoY2hyKVxuICAgICAgICAvLyBCeSBkZWZhdWx0IGl0IGlzIG5vdCByZXF1aXJlZCB0byBlbmNvZGUgYSBsaW5lLCB0aGUgbmVlZFxuICAgICAgICAvLyBvbmx5IGFwcGVhcnMgd2hlbiB0aGUgc3RyaW5nIGNvbnRhaW5zIHVuaWNvZGUgb3Igc3BlY2lhbCBjaGFyc1xuICAgICAgICAvLyBpbiB0aGlzIGNhc2Ugd2Ugc3RhcnQgcHJvY2Vzc2luZyB0aGUgbGluZSBvdmVyIGFuZCBlbmNvZGUgYWxsIGNoYXJzXG4gICAgICAgIGlmIChjaHIgIT09IGVuY29kZWRTdHJbaV0pIHtcbiAgICAgICAgICAvLyBDaGVjayBpZiBpdCBpcyBldmVuIHBvc3NpYmxlIHRvIGFkZCB0aGUgZW5jb2RlZCBjaGFyIHRvIHRoZSBsaW5lXG4gICAgICAgICAgLy8gSWYgbm90LCB0aGVyZSBpcyBubyByZWFzb24gdG8gdXNlIHRoaXMgbGluZSwganVzdCBwdXNoIGl0IHRvIHRoZSBsaXN0XG4gICAgICAgICAgLy8gYW5kIHN0YXJ0IGEgbmV3IGxpbmUgd2l0aCB0aGUgY2hhciB0aGF0IG5lZWRzIGVuY29kaW5nXG4gICAgICAgICAgaWYgKChlbmNvZGVVUklDb21wb25lbnQobGluZSkgKyBjaHIpLmxlbmd0aCA+PSBtYXhMZW5ndGgpIHtcbiAgICAgICAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgICAgICAgIGVuY29kZWQ6IGlzRW5jb2RlZFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIGxpbmUgPSAnJ1xuICAgICAgICAgICAgc3RhcnRQb3MgPSBpIC0gMVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpc0VuY29kZWQgPSB0cnVlXG4gICAgICAgICAgICBpID0gc3RhcnRQb3NcbiAgICAgICAgICAgIGxpbmUgPSAnJ1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgICAgICAgICAvLyBpZiB0aGUgbGluZSBpcyBhbHJlYWR5IHRvbyBsb25nLCBwdXNoIGl0IHRvIHRoZSBsaXN0IGFuZCBzdGFydCBhIG5ldyBvbmVcbiAgICAgIGlmICgobGluZSArIGNocikubGVuZ3RoID49IG1heExlbmd0aCkge1xuICAgICAgICBsaXN0LnB1c2goe1xuICAgICAgICAgIGxpbmU6IGxpbmUsXG4gICAgICAgICAgZW5jb2RlZDogaXNFbmNvZGVkXG4gICAgICAgIH0pXG4gICAgICAgIGxpbmUgPSBjaHIgPSBlbmNvZGVkU3RyW2ldID09PSAnICcgPyAnICcgOiBlbmNvZGVVUklDb21wb25lbnQoZW5jb2RlZFN0cltpXSlcbiAgICAgICAgaWYgKGNociA9PT0gZW5jb2RlZFN0cltpXSkge1xuICAgICAgICAgIGlzRW5jb2RlZCA9IGZhbHNlXG4gICAgICAgICAgc3RhcnRQb3MgPSBpIC0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlzRW5jb2RlZCA9IHRydWVcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGluZSArPSBjaHJcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobGluZSkge1xuICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgbGluZTogbGluZSxcbiAgICAgICAgZW5jb2RlZDogaXNFbmNvZGVkXG4gICAgICB9KVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsaXN0Lm1hcChmdW5jdGlvbiAoaXRlbSwgaSkge1xuICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIC8vIGVuY29kZWQgbGluZXM6IHtuYW1lfSp7cGFydH0qXG4gICAgICAgICAgICAgIC8vIHVuZW5jb2RlZCBsaW5lczoge25hbWV9KntwYXJ0fVxuICAgICAgICAgICAgICAvLyBpZiBhbnkgbGluZSBuZWVkcyB0byBiZSBlbmNvZGVkIHRoZW4gdGhlIGZpcnN0IGxpbmUgKHBhcnQ9PTApIGlzIGFsd2F5cyBlbmNvZGVkXG4gICAgICBrZXk6IGtleSArICcqJyArIGkgKyAoaXRlbS5lbmNvZGVkID8gJyonIDogJycpLFxuICAgICAgdmFsdWU6IC9bXFxzXCI7PV0vLnRlc3QoaXRlbS5saW5lKSA/ICdcIicgKyBpdGVtLmxpbmUgKyAnXCInIDogaXRlbS5saW5lXG4gICAgfVxuICB9KVxufVxuXG4vKipcbiAqIFNwbGl0cyBhIG1pbWUgZW5jb2RlZCBzdHJpbmcuIE5lZWRlZCBmb3IgZGl2aWRpbmcgbWltZSB3b3JkcyBpbnRvIHNtYWxsZXIgY2h1bmtzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nIHRvIGJlIHNwbGl0IHVwXG4gKiBAcGFyYW0ge051bWJlcn0gbWF4bGVuIE1heGltdW0gbGVuZ3RoIG9mIGNoYXJhY3RlcnMgZm9yIG9uZSBwYXJ0IChtaW5pbXVtIDEyKVxuICogQHJldHVybiB7QXJyYXl9IFNwbGl0IHN0cmluZ1xuICovXG5mdW5jdGlvbiBfc3BsaXRNaW1lRW5jb2RlZFN0cmluZyAoc3RyLCBtYXhsZW4gPSAxMikge1xuICBjb25zdCBtaW5Xb3JkTGVuZ3RoID0gMTIgLy8gcmVxdWlyZSBhdCBsZWFzdCAxMiBzeW1ib2xzIHRvIGZpdCBwb3NzaWJsZSA0IG9jdGV0IFVURi04IHNlcXVlbmNlc1xuICBjb25zdCBtYXhXb3JkTGVuZ3RoID0gTWF0aC5tYXgobWF4bGVuLCBtaW5Xb3JkTGVuZ3RoKVxuICBjb25zdCBsaW5lcyA9IFtdXG5cbiAgd2hpbGUgKHN0ci5sZW5ndGgpIHtcbiAgICBsZXQgY3VyTGluZSA9IHN0ci5zdWJzdHIoMCwgbWF4V29yZExlbmd0aClcblxuICAgIGNvbnN0IG1hdGNoID0gY3VyTGluZS5tYXRjaCgvPVswLTlBLUZdPyQvaSkgLy8gc2tpcCBpbmNvbXBsZXRlIGVzY2FwZWQgY2hhclxuICAgIGlmIChtYXRjaCkge1xuICAgICAgY3VyTGluZSA9IGN1ckxpbmUuc3Vic3RyKDAsIG1hdGNoLmluZGV4KVxuICAgIH1cblxuICAgIGxldCBkb25lID0gZmFsc2VcbiAgICB3aGlsZSAoIWRvbmUpIHtcbiAgICAgIGxldCBjaHJcbiAgICAgIGRvbmUgPSB0cnVlXG4gICAgICBjb25zdCBtYXRjaCA9IHN0ci5zdWJzdHIoY3VyTGluZS5sZW5ndGgpLm1hdGNoKC9ePShbMC05QS1GXXsyfSkvaSkgLy8gY2hlY2sgaWYgbm90IG1pZGRsZSBvZiBhIHVuaWNvZGUgY2hhciBzZXF1ZW5jZVxuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNociA9IHBhcnNlSW50KG1hdGNoWzFdLCAxNilcbiAgICAgICAgLy8gaW52YWxpZCBzZXF1ZW5jZSwgbW92ZSBvbmUgY2hhciBiYWNrIGFuYyByZWNoZWNrXG4gICAgICAgIGlmIChjaHIgPCAweEMyICYmIGNociA+IDB4N0YpIHtcbiAgICAgICAgICBjdXJMaW5lID0gY3VyTGluZS5zdWJzdHIoMCwgY3VyTGluZS5sZW5ndGggLSAzKVxuICAgICAgICAgIGRvbmUgPSBmYWxzZVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGN1ckxpbmUubGVuZ3RoKSB7XG4gICAgICBsaW5lcy5wdXNoKGN1ckxpbmUpXG4gICAgfVxuICAgIHN0ciA9IHN0ci5zdWJzdHIoY3VyTGluZS5sZW5ndGgpXG4gIH1cblxuICByZXR1cm4gbGluZXNcbn1cblxuZnVuY3Rpb24gX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzIChiYXNlNjRFbmNvZGVkU3RyID0gJycpIHtcbiAgcmV0dXJuIGJhc2U2NEVuY29kZWRTdHIudHJpbSgpLnJlcGxhY2UobmV3IFJlZ0V4cCgnLnsnICsgTUFYX0xJTkVfTEVOR1RIICsgJ30nLCAnZycpLCAnJCZcXHJcXG4nKS50cmltKClcbn1cblxuICAvKipcbiAgICogQWRkcyBzb2Z0IGxpbmUgYnJlYWtzKHRoZSBvbmVzIHRoYXQgd2lsbCBiZSBzdHJpcHBlZCBvdXQgd2hlbiBkZWNvZGluZyBRUClcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHFwRW5jb2RlZFN0ciBTdHJpbmcgaW4gUXVvdGVkLVByaW50YWJsZSBlbmNvZGluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIGZvcmNlZCBsaW5lIGJyZWFrc1xuICAgKi9cbmZ1bmN0aW9uIF9hZGRRUFNvZnRMaW5lYnJlYWtzIChxcEVuY29kZWRTdHIgPSAnJykge1xuICBsZXQgcG9zID0gMFxuICBjb25zdCBsZW4gPSBxcEVuY29kZWRTdHIubGVuZ3RoXG4gIGNvbnN0IGxpbmVNYXJnaW4gPSBNYXRoLmZsb29yKE1BWF9MSU5FX0xFTkdUSCAvIDMpXG4gIGxldCByZXN1bHQgPSAnJ1xuICBsZXQgbWF0Y2gsIGxpbmVcblxuICAgICAgLy8gaW5zZXJ0IHNvZnQgbGluZWJyZWFrcyB3aGVyZSBuZWVkZWRcbiAgd2hpbGUgKHBvcyA8IGxlbikge1xuICAgIGxpbmUgPSBxcEVuY29kZWRTdHIuc3Vic3RyKHBvcywgTUFYX0xJTkVfTEVOR1RIKVxuICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC9cXHJcXG4vKSkpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfVxuXG4gICAgaWYgKGxpbmUuc3Vic3RyKC0xKSA9PT0gJ1xcbicpIHtcbiAgICAgIC8vIG5vdGhpbmcgdG8gY2hhbmdlIGhlcmVcbiAgICAgIHJlc3VsdCArPSBsaW5lXG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICAgIGNvbnRpbnVlXG4gICAgfSBlbHNlIGlmICgobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1xcbi4qPyQvKSkpIHtcbiAgICAgIC8vIHRydW5jYXRlIHRvIG5lYXJlc3QgbGluZSBicmVha1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gKG1hdGNoWzBdLmxlbmd0aCAtIDEpKVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9IGVsc2UgaWYgKGxpbmUubGVuZ3RoID4gTUFYX0xJTkVfTEVOR1RIIC0gbGluZU1hcmdpbiAmJiAobWF0Y2ggPSBsaW5lLnN1YnN0cigtbGluZU1hcmdpbikubWF0Y2goL1sgXFx0LiwhP11bXiBcXHQuLCE/XSokLykpKSB7XG4gICAgICAvLyB0cnVuY2F0ZSB0byBuZWFyZXN0IHNwYWNlXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gMSkpXG4gICAgfSBlbHNlIGlmIChsaW5lLnN1YnN0cigtMSkgPT09ICdcXHInKSB7XG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAobGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMn0kL2kpKSB7XG4gICAgICAgIC8vIHB1c2ggaW5jb21wbGV0ZSBlbmNvZGluZyBzZXF1ZW5jZXMgdG8gdGhlIG5leHQgbGluZVxuICAgICAgICBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvPVtcXGRhLWZdezAsMX0kL2kpKSkge1xuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIG1hdGNoWzBdLmxlbmd0aClcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGVuc3VyZSB0aGF0IHV0Zi04IHNlcXVlbmNlcyBhcmUgbm90IHNwbGl0XG4gICAgICAgIHdoaWxlIChsaW5lLmxlbmd0aCA+IDMgJiYgbGluZS5sZW5ndGggPCBsZW4gLSBwb3MgJiYgIWxpbmUubWF0Y2goL14oPzo9W1xcZGEtZl17Mn0pezEsNH0kL2kpICYmIChtYXRjaCA9IGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvaWcpKSkge1xuICAgICAgICAgIGNvbnN0IGNvZGUgPSBwYXJzZUludChtYXRjaFswXS5zdWJzdHIoMSwgMiksIDE2KVxuICAgICAgICAgIGlmIChjb2RlIDwgMTI4KSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDMpXG5cbiAgICAgICAgICBpZiAoY29kZSA+PSAweEMwKSB7XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3MgKyBsaW5lLmxlbmd0aCA8IGxlbiAmJiBsaW5lLnN1YnN0cigtMSkgIT09ICdcXG4nKSB7XG4gICAgICBpZiAobGluZS5sZW5ndGggPT09IE1BWF9MSU5FX0xFTkdUSCAmJiBsaW5lLm1hdGNoKC89W1xcZGEtZl17Mn0kL2kpKSB7XG4gICAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDMpXG4gICAgICB9IGVsc2UgaWYgKGxpbmUubGVuZ3RoID09PSBNQVhfTElORV9MRU5HVEgpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMSlcbiAgICAgIH1cbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgbGluZSArPSAnPVxcclxcbidcbiAgICB9IGVsc2Uge1xuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGxpbmVcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuZXhwb3J0IHsgZGVjb2RlLCBlbmNvZGUsIGNvbnZlcnQgfVxuIl19