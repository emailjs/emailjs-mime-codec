'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convert = exports.decode = undefined;

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
exports.convert = _charset.convert;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9taW1lY29kZWMuanMiXSwibmFtZXMiOlsibWltZUVuY29kZSIsIm1pbWVEZWNvZGUiLCJiYXNlNjRFbmNvZGUiLCJiYXNlNjREZWNvZGUiLCJxdW90ZWRQcmludGFibGVFbmNvZGUiLCJxdW90ZWRQcmludGFibGVEZWNvZGUiLCJtaW1lV29yZEVuY29kZSIsIm1pbWVXb3Jkc0VuY29kZSIsIm1pbWVXb3JkRGVjb2RlIiwibWltZVdvcmRzRGVjb2RlIiwiZm9sZExpbmVzIiwiaGVhZGVyTGluZUVuY29kZSIsImhlYWRlckxpbmVEZWNvZGUiLCJoZWFkZXJMaW5lc0RlY29kZSIsInBhcnNlSGVhZGVyVmFsdWUiLCJjb250aW51YXRpb25FbmNvZGUiLCJNQVhfTElORV9MRU5HVEgiLCJNQVhfTUlNRV9XT1JEX0xFTkdUSCIsImRhdGEiLCJmcm9tQ2hhcnNldCIsImJ1ZmZlciIsInJlZHVjZSIsImFnZ3JlZ2F0ZSIsIm9yZCIsImluZGV4IiwiX2NoZWNrUmFuZ2VzIiwibGVuZ3RoIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwidG9TdHJpbmciLCJ0b1VwcGVyQ2FzZSIsIm5yIiwicmFuZ2VzIiwidmFsIiwicmFuZ2UiLCJzdHIiLCJlbmNvZGVkQnl0ZXNDb3VudCIsIm1hdGNoIiwiVWludDhBcnJheSIsImkiLCJsZW4iLCJidWZmZXJQb3MiLCJoZXgiLCJzdWJzdHIiLCJjaHIiLCJjaGFyQXQiLCJ0ZXN0IiwicGFyc2VJbnQiLCJjaGFyQ29kZUF0IiwiYnVmIiwiYjY0IiwiX2FkZEJhc2U2NFNvZnRMaW5lYnJlYWtzIiwibWltZUVuY29kZWRTdHIiLCJyZXBsYWNlIiwic3BhY2VzIiwiX2FkZFFQU29mdExpbmVicmVha3MiLCJyYXdTdHJpbmciLCJtaW1lV29yZEVuY29kaW5nIiwiZW5jb2RlZFN0ciIsIm1heExlbmd0aCIsIl9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nIiwiam9pbiIsIk1hdGgiLCJtYXgiLCJwYXJ0cyIsInB1c2giLCJyZWdleCIsInNwbGl0Iiwic2hpZnQiLCJlbmNvZGluZyIsIm1pbWVXb3JkIiwiYWZ0ZXJTcGFjZSIsInBvcyIsInJlc3VsdCIsImxpbmUiLCJrZXkiLCJ2YWx1ZSIsImVuY29kZWRWYWx1ZSIsImhlYWRlckxpbmUiLCJ0cmltIiwiaGVhZGVycyIsImxpbmVzIiwiaGVhZGVyc09iaiIsInNwbGljZSIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiY29uY2F0IiwicmVzcG9uc2UiLCJwYXJhbXMiLCJ0eXBlIiwicXVvdGUiLCJlc2NhcGVkIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJhY3R1YWxLZXkiLCJOdW1iZXIiLCJjaGFyc2V0IiwidmFsdWVzIiwiQXJyYXkiLCJpc0FycmF5IiwibWFwIiwicyIsImMiLCJsaXN0Iiwic3RhcnRQb3MiLCJpc0VuY29kZWQiLCJSZWdFeHAiLCJlbmNvZGVVUklDb21wb25lbnQiLCJlbmNvZGVkIiwiaXRlbSIsIm1heGxlbiIsIm1pbldvcmRMZW5ndGgiLCJtYXhXb3JkTGVuZ3RoIiwiY3VyTGluZSIsImRvbmUiLCJiYXNlNjRFbmNvZGVkU3RyIiwicXBFbmNvZGVkU3RyIiwibGluZU1hcmdpbiIsImZsb29yIiwiY29kZSIsImRlY29kZSIsImNvbnZlcnQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztRQWlCZ0JBLFUsR0FBQUEsVTtRQTBCQUMsVSxHQUFBQSxVO1FBMEJBQyxZLEdBQUFBLFk7UUFhQUMsWSxHQUFBQSxZO1FBYUFDLHFCLEdBQUFBLHFCO1FBZ0JBQyxxQixHQUFBQSxxQjtRQWdCQUMsYyxHQUFBQSxjO1FBcUNBQyxlLEdBQUFBLGU7UUFXQUMsYyxHQUFBQSxjO1FBMEJBQyxlLEdBQUFBLGU7UUFnQkFDLFMsR0FBQUEsUztRQTBDQUMsZ0IsR0FBQUEsZ0I7UUFZQUMsZ0IsR0FBQUEsZ0I7UUFpQkFDLGlCLEdBQUFBLGlCO1FBeUNBQyxnQixHQUFBQSxnQjtRQWlJQUMsa0IsR0FBQUEsa0I7O0FBMWNoQjs7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsSUFBTUMsa0JBQWtC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OztBQUVELFNBQU9ELE1BQVA7QUFDRDs7UUFFUWdELE07UUFBUUMsTyIsImZpbGUiOiJtaW1lY29kZWMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBlbmNvZGUgYXMgZW5jb2RlQmFzZTY0LCBkZWNvZGUgYXMgZGVjb2RlQmFzZTY0LCBPVVRQVVRfVFlQRURfQVJSQVkgfSBmcm9tICdlbWFpbGpzLWJhc2U2NCdcbmltcG9ydCB7IGRlY29kZSwgY29udmVydCB9IGZyb20gJy4vY2hhcnNldCdcblxuLy8gTGluZXMgY2FuJ3QgYmUgbG9uZ2VyIHRoYW4gNzYgKyA8Q1I+PExGPiA9IDc4IGJ5dGVzXG4vLyBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMDQ1I3NlY3Rpb24tNi43XG5jb25zdCBNQVhfTElORV9MRU5HVEggPSA3NlxuY29uc3QgTUFYX01JTUVfV09SRF9MRU5HVEggPSA1MlxuXG4vKipcbiAqIEVuY29kZXMgYWxsIG5vbiBwcmludGFibGUgYW5kIG5vbiBhc2NpaSBieXRlcyB0byA9WFggZm9ybSwgd2hlcmUgWFggaXMgdGhlXG4gKiBieXRlIHZhbHVlIGluIGhleC4gVGhpcyBmdW5jdGlvbiBkb2VzIG5vdCBjb252ZXJ0IGxpbmVicmVha3MgZXRjLiBpdFxuICogb25seSBlc2NhcGVzIGNoYXJhY3RlciBzZXF1ZW5jZXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIEVpdGhlciBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5XG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xuICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGVuY29kZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lRW5jb2RlIChkYXRhID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBidWZmZXIgPSBjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KVxuICByZXR1cm4gYnVmZmVyLnJlZHVjZSgoYWdncmVnYXRlLCBvcmQsIGluZGV4KSA9PiBfY2hlY2tSYW5nZXMob3JkKSAmJlxuICAgICEoKG9yZCA9PT0gMHgyMCB8fCBvcmQgPT09IDB4MDkpICYmIChpbmRleCA9PT0gYnVmZmVyLmxlbmd0aCAtIDEgfHwgYnVmZmVyW2luZGV4ICsgMV0gPT09IDB4MGEgfHwgYnVmZmVyW2luZGV4ICsgMV0gPT09IDB4MGQpKVxuICAgID8gYWdncmVnYXRlICsgU3RyaW5nLmZyb21DaGFyQ29kZShvcmQpIC8vIGlmIHRoZSBjaGFyIGlzIGluIGFsbG93ZWQgcmFuZ2UsIHRoZW4ga2VlcCBhcyBpcywgdW5sZXNzIGl0IGlzIGEgd3MgaW4gdGhlIGVuZCBvZiBhIGxpbmVcbiAgICA6IGFnZ3JlZ2F0ZSArICc9JyArIChvcmQgPCAweDEwID8gJzAnIDogJycpICsgb3JkLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpLCAnJylcblxuICBmdW5jdGlvbiBfY2hlY2tSYW5nZXMgKG5yKSB7XG4gICAgY29uc3QgcmFuZ2VzID0gWyAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NSNzZWN0aW9uLTYuN1xuICAgICAgWzB4MDldLCAvLyA8VEFCPlxuICAgICAgWzB4MEFdLCAvLyA8TEY+XG4gICAgICBbMHgwRF0sIC8vIDxDUj5cbiAgICAgIFsweDIwLCAweDNDXSwgLy8gPFNQPiFcIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5OjtcbiAgICAgIFsweDNFLCAweDdFXSAvLyA+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXF1eX2BhYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ent8fVxuICAgIF1cbiAgICByZXR1cm4gcmFuZ2VzLnJlZHVjZSgodmFsLCByYW5nZSkgPT4gdmFsIHx8IChyYW5nZS5sZW5ndGggPT09IDEgJiYgbnIgPT09IHJhbmdlWzBdKSB8fCAocmFuZ2UubGVuZ3RoID09PSAyICYmIG5yID49IHJhbmdlWzBdICYmIG5yIDw9IHJhbmdlWzFdKSwgZmFsc2UpXG4gIH1cbn1cblxuICAvKipcbiAgICogRGVjb2RlcyBtaW1lIGVuY29kZWQgc3RyaW5nIHRvIGFuIHVuaWNvZGUgc3RyaW5nXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSBlbmNvZGVkIHN0cmluZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBlbmNvZGluZ1xuICAgKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAgICovXG5leHBvcnQgZnVuY3Rpb24gbWltZURlY29kZSAoc3RyID0gJycsIGZyb21DaGFyc2V0ID0gJ1VURi04Jykge1xuICBjb25zdCBlbmNvZGVkQnl0ZXNDb3VudCA9IChzdHIubWF0Y2goLz1bXFxkYS1mQS1GXXsyfS9nKSB8fCBbXSkubGVuZ3RoXG4gIGxldCBidWZmZXIgPSBuZXcgVWludDhBcnJheShzdHIubGVuZ3RoIC0gZW5jb2RlZEJ5dGVzQ291bnQgKiAyKVxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBzdHIubGVuZ3RoLCBidWZmZXJQb3MgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBsZXQgaGV4ID0gc3RyLnN1YnN0cihpICsgMSwgMilcbiAgICBjb25zdCBjaHIgPSBzdHIuY2hhckF0KGkpXG4gICAgaWYgKGNociA9PT0gJz0nICYmIGhleCAmJiAvW1xcZGEtZkEtRl17Mn0vLnRlc3QoaGV4KSkge1xuICAgICAgYnVmZmVyW2J1ZmZlclBvcysrXSA9IHBhcnNlSW50KGhleCwgMTYpXG4gICAgICBpICs9IDJcbiAgICB9IGVsc2Uge1xuICAgICAgYnVmZmVyW2J1ZmZlclBvcysrXSA9IGNoci5jaGFyQ29kZUF0KDApXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRlY29kZShidWZmZXIsIGZyb21DaGFyc2V0KVxufVxuXG4gIC8qKlxuICAgKiBFbmNvZGVzIGEgc3RyaW5nIG9yIGFuIHR5cGVkIGFycmF5IG9mIGdpdmVuIGNoYXJzZXQgaW50byB1bmljb2RlXG4gICAqIGJhc2U2NCBzdHJpbmcuIEFsc28gYWRkcyBsaW5lIGJyZWFrc1xuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIFN0cmluZyB0byBiZSBiYXNlNjQgZW5jb2RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddXG4gICAqIEByZXR1cm4ge1N0cmluZ30gQmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gICAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NEVuY29kZSAoZGF0YSwgZnJvbUNoYXJzZXQpIHtcbiAgY29uc3QgYnVmID0gKGZyb21DaGFyc2V0ICE9PSAnYmluYXJ5JyAmJiB0eXBlb2YgZGF0YSAhPT0gJ3N0cmluZycpID8gY29udmVydChkYXRhIHx8ICcnLCBmcm9tQ2hhcnNldCkgOiBkYXRhXG4gIGNvbnN0IGI2NCA9IGVuY29kZUJhc2U2NChidWYpXG4gIHJldHVybiBfYWRkQmFzZTY0U29mdExpbmVicmVha3MoYjY0KVxufVxuXG4gIC8qKlxuICAgKiBEZWNvZGVzIGEgYmFzZTY0IHN0cmluZyBvZiBhbnkgY2hhcnNldCBpbnRvIGFuIHVuaWNvZGUgc3RyaW5nXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgQmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gT3JpZ2luYWwgY2hhcnNldCBvZiB0aGUgYmFzZTY0IGVuY29kZWQgc3RyaW5nXG4gICAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCB1bmljb2RlIHN0cmluZ1xuICAgKi9cbmV4cG9ydCBmdW5jdGlvbiBiYXNlNjREZWNvZGUgKHN0ciwgZnJvbUNoYXJzZXQpIHtcbiAgcmV0dXJuIGRlY29kZShkZWNvZGVCYXNlNjQoc3RyLCBPVVRQVVRfVFlQRURfQVJSQVkpLCBmcm9tQ2hhcnNldClcbn1cblxuICAvKipcbiAgICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IGludG8gYSBxdW90ZWQgcHJpbnRhYmxlIGVuY29kaW5nXG4gICAqIFRoaXMgaXMgYWxtb3N0IHRoZSBzYW1lIGFzIG1pbWVFbmNvZGUsIGV4Y2VwdCBsaW5lIGJyZWFrcyB3aWxsIGJlIGNoYW5nZWRcbiAgICogYXMgd2VsbCB0byBlbnN1cmUgdGhhdCB0aGUgbGluZXMgYXJlIG5ldmVyIGxvbmdlciB0aGFuIGFsbG93ZWQgbGVuZ3RoXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIG9yIGFuIFVpbnQ4QXJyYXkgdG8gbWltZSBlbmNvZGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBzdHJpbmdcbiAgICogQHJldHVybiB7U3RyaW5nfSBNaW1lIGVuY29kZWQgc3RyaW5nXG4gICAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlZFByaW50YWJsZUVuY29kZSAoZGF0YSA9ICcnLCBmcm9tQ2hhcnNldCA9ICdVVEYtOCcpIHtcbiAgY29uc3QgbWltZUVuY29kZWRTdHIgPSBtaW1lRW5jb2RlKGRhdGEsIGZyb21DaGFyc2V0KVxuICAgIC5yZXBsYWNlKC9cXHI/XFxufFxcci9nLCAnXFxyXFxuJykgLy8gZml4IGxpbmUgYnJlYWtzLCBlbnN1cmUgPENSPjxMRj5cbiAgICAucmVwbGFjZSgvW1xcdCBdKyQvZ20sIHNwYWNlcyA9PiBzcGFjZXMucmVwbGFjZSgvIC9nLCAnPTIwJykucmVwbGFjZSgvXFx0L2csICc9MDknKSkgLy8gcmVwbGFjZSBzcGFjZXMgaW4gdGhlIGVuZCBvZiBsaW5lc1xuXG4gIHJldHVybiBfYWRkUVBTb2Z0TGluZWJyZWFrcyhtaW1lRW5jb2RlZFN0cikgLy8gYWRkIHNvZnQgbGluZSBicmVha3MgdG8gZW5zdXJlIGxpbmUgbGVuZ3RocyBzam9ydGVyIHRoYW4gNzYgYnl0ZXNcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgc3RyaW5nIGZyb20gYSBxdW90ZWQgcHJpbnRhYmxlIGVuY29kaW5nLiBUaGlzIGlzIGFsbW9zdCB0aGVcbiAqIHNhbWUgYXMgbWltZURlY29kZSwgZXhjZXB0IGxpbmUgYnJlYWtzIHdpbGwgYmUgY2hhbmdlZCBhcyB3ZWxsXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBNaW1lIGVuY29kZWQgc3RyaW5nIHRvIGRlY29kZVxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBPcmlnaW5hbCBjaGFyc2V0IG9mIHRoZSBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gTWltZSBkZWNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVkUHJpbnRhYmxlRGVjb2RlIChzdHIgPSAnJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IHJhd1N0cmluZyA9IHN0clxuICAgIC5yZXBsYWNlKC9bXFx0IF0rJC9nbSwgJycpIC8vIHJlbW92ZSBpbnZhbGlkIHdoaXRlc3BhY2UgZnJvbSB0aGUgZW5kIG9mIGxpbmVzXG4gICAgLnJlcGxhY2UoLz0oPzpcXHI/XFxufCQpL2csICcnKSAvLyByZW1vdmUgc29mdCBsaW5lIGJyZWFrc1xuXG4gIHJldHVybiBtaW1lRGVjb2RlKHJhd1N0cmluZywgZnJvbUNoYXJzZXQpXG59XG5cbiAgLyoqXG4gICAqIEVuY29kZXMgYSBzdHJpbmcgb3IgYW4gVWludDhBcnJheSB0byBhbiBVVEYtOCBNSU1FIFdvcmQgKHJmYzIwNDcpXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1pbWVXb3JkRW5jb2Rpbmc9J1EnIEVuY29kaW5nIGZvciB0aGUgbWltZSB3b3JkLCBlaXRoZXIgUSBvciBCXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBbZnJvbUNoYXJzZXQ9J1VURi04J10gU291cmNlIHNoYXJhY3RlciBzZXRcbiAgICogQHJldHVybiB7U3RyaW5nfSBTaW5nbGUgb3Igc2V2ZXJhbCBtaW1lIHdvcmRzIGpvaW5lZCB0b2dldGhlclxuICAgKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZEVuY29kZSAoZGF0YSwgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQpIHtcbiAgbGV0IGVuY29kZWRTdHJcblxuICBpZiAobWltZVdvcmRFbmNvZGluZyA9PT0gJ1EnKSB7XG4gICAgY29uc3QgbWF4TGVuZ3RoID0gTUFYX01JTUVfV09SRF9MRU5HVEhcbiAgICBlbmNvZGVkU3RyID0gbWltZUVuY29kZShkYXRhLCBmcm9tQ2hhcnNldClcbiAgICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjA0NyNzZWN0aW9uLTUgcnVsZSAoMylcbiAgICBlbmNvZGVkU3RyID0gZW5jb2RlZFN0ci5yZXBsYWNlKC9bXmEtejAtOSEqK1xcLS89XS9pZywgY2hyID0+IGNociA9PT0gJyAnID8gJ18nIDogKCc9JyArIChjaHIuY2hhckNvZGVBdCgwKSA8IDB4MTAgPyAnMCcgOiAnJykgKyBjaHIuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSkpXG4gICAgaWYgKGVuY29kZWRTdHIubGVuZ3RoID4gbWF4TGVuZ3RoKSB7XG4gICAgICBlbmNvZGVkU3RyID0gX3NwbGl0TWltZUVuY29kZWRTdHJpbmcoZW5jb2RlZFN0ciwgbWF4TGVuZ3RoKS5qb2luKCc/PSA9P1VURi04PycgKyBtaW1lV29yZEVuY29kaW5nICsgJz8nKVxuICAgIH1cbiAgfSBlbHNlIGlmIChtaW1lV29yZEVuY29kaW5nID09PSAnQicpIHtcbiAgICBlbmNvZGVkU3RyID0gdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnID8gZGF0YSA6IGRlY29kZShkYXRhLCBmcm9tQ2hhcnNldClcbiAgICBjb25zdCBtYXhMZW5ndGggPSBNYXRoLm1heCgzLCAoTUFYX01JTUVfV09SRF9MRU5HVEggLSBNQVhfTUlNRV9XT1JEX0xFTkdUSCAlIDQpIC8gNCAqIDMpXG4gICAgaWYgKGVuY29kZWRTdHIubGVuZ3RoID4gbWF4TGVuZ3RoKSB7XG4gICAgICAvLyBSRkMyMDQ3IDYuMyAoMikgc3RhdGVzIHRoYXQgZW5jb2RlZC13b3JkIG11c3QgaW5jbHVkZSBhbiBpbnRlZ3JhbCBudW1iZXIgb2YgY2hhcmFjdGVycywgc28gbm8gY2hvcHBpbmcgdW5pY29kZSBzZXF1ZW5jZXNcbiAgICAgIGNvbnN0IHBhcnRzID0gW11cbiAgICAgIGZvciAobGV0IGkgPSAwLCBsZW4gPSBlbmNvZGVkU3RyLmxlbmd0aDsgaSA8IGxlbjsgaSArPSBtYXhMZW5ndGgpIHtcbiAgICAgICAgcGFydHMucHVzaChiYXNlNjRFbmNvZGUoZW5jb2RlZFN0ci5zdWJzdHIoaSwgbWF4TGVuZ3RoKSkpXG4gICAgICB9XG4gICAgICByZXR1cm4gJz0/VVRGLTg/JyArIG1pbWVXb3JkRW5jb2RpbmcgKyAnPycgKyBwYXJ0cy5qb2luKCc/PSA9P1VURi04PycgKyBtaW1lV29yZEVuY29kaW5nICsgJz8nKSArICc/PSdcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZW5jb2RlZFN0ciA9IGJhc2U2NEVuY29kZShlbmNvZGVkU3RyKVxuICB9XG5cbiAgcmV0dXJuICc9P1VURi04PycgKyBtaW1lV29yZEVuY29kaW5nICsgJz8nICsgZW5jb2RlZFN0ciArIChlbmNvZGVkU3RyLnN1YnN0cigtMikgPT09ICc/PScgPyAnJyA6ICc/PScpXG59XG5cbi8qKlxuICogRmluZHMgd29yZCBzZXF1ZW5jZXMgd2l0aCBub24gYXNjaWkgdGV4dCBhbmQgY29udmVydHMgdGhlc2UgdG8gbWltZSB3b3Jkc1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBtaW1lV29yZEVuY29kaW5nPSdRJyBFbmNvZGluZyBmb3IgdGhlIG1pbWUgd29yZCwgZWl0aGVyIFEgb3IgQlxuICogQHBhcmFtIHtTdHJpbmd9IFtmcm9tQ2hhcnNldD0nVVRGLTgnXSBTb3VyY2Ugc2hhcmFjdGVyIHNldFxuICogQHJldHVybiB7U3RyaW5nfSBTdHJpbmcgd2l0aCBwb3NzaWJsZSBtaW1lIHdvcmRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtaW1lV29yZHNFbmNvZGUgKGRhdGEgPSAnJywgbWltZVdvcmRFbmNvZGluZyA9ICdRJywgZnJvbUNoYXJzZXQgPSAnVVRGLTgnKSB7XG4gIGNvbnN0IHJlZ2V4ID0gLyhbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKig/OlxccytbXlxcc1xcdTAwODAtXFx1RkZGRl0qW1xcdTAwODAtXFx1RkZGRl0rW15cXHNcXHUwMDgwLVxcdUZGRkZdKlxccyopPykrL2dcbiAgcmV0dXJuIGRlY29kZShjb252ZXJ0KGRhdGEsIGZyb21DaGFyc2V0KSkucmVwbGFjZShyZWdleCwgbWF0Y2ggPT4gbWF0Y2gubGVuZ3RoID8gbWltZVdvcmRFbmNvZGUobWF0Y2gsIG1pbWVXb3JkRW5jb2RpbmcsIGZyb21DaGFyc2V0KSA6ICcnKVxufVxuXG4vKipcbiAqIERlY29kZSBhIGNvbXBsZXRlIG1pbWUgd29yZCBlbmNvZGVkIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgTWltZSB3b3JkIGVuY29kZWQgc3RyaW5nXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3JkRGVjb2RlIChzdHIgPSAnJykge1xuICBjb25zdCBtYXRjaCA9IHN0ci5tYXRjaCgvXj1cXD8oW1xcd19cXC0qXSspXFw/KFtRcUJiXSlcXD8oW14/XSspXFw/PSQvaSlcbiAgaWYgKCFtYXRjaCkgcmV0dXJuIHN0clxuXG4gIC8vIFJGQzIyMzEgYWRkZWQgbGFuZ3VhZ2UgdGFnIHRvIHRoZSBlbmNvZGluZ1xuICAvLyBzZWU6IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMyMjMxI3NlY3Rpb24tNVxuICAvLyB0aGlzIGltcGxlbWVudGF0aW9uIHNpbGVudGx5IGlnbm9yZXMgdGhpcyB0YWdcbiAgY29uc3QgZnJvbUNoYXJzZXQgPSBtYXRjaFsxXS5zcGxpdCgnKicpLnNoaWZ0KClcbiAgY29uc3QgZW5jb2RpbmcgPSAobWF0Y2hbMl0gfHwgJ1EnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKClcbiAgY29uc3QgcmF3U3RyaW5nID0gKG1hdGNoWzNdIHx8ICcnKS5yZXBsYWNlKC9fL2csICcgJylcblxuICBpZiAoZW5jb2RpbmcgPT09ICdCJykge1xuICAgIHJldHVybiBiYXNlNjREZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIGlmIChlbmNvZGluZyA9PT0gJ1EnKSB7XG4gICAgcmV0dXJuIG1pbWVEZWNvZGUocmF3U3RyaW5nLCBmcm9tQ2hhcnNldClcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gc3RyXG4gIH1cbn1cblxuLyoqXG4gKiBEZWNvZGUgYSBzdHJpbmcgdGhhdCBtaWdodCBpbmNsdWRlIG9uZSBvciBzZXZlcmFsIG1pbWUgd29yZHNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyBpbmNsdWRpbmcgc29tZSBtaW1lIHdvcmRzIHRoYXQgd2lsbCBiZSBlbmNvZGVkXG4gKiBAcmV0dXJuIHtTdHJpbmd9IERlY29kZWQgdW5pY29kZSBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1pbWVXb3Jkc0RlY29kZSAoc3RyID0gJycpIHtcbiAgc3RyID0gc3RyLnRvU3RyaW5nKCkucmVwbGFjZSgvKD1cXD9bXj9dK1xcP1tRcUJiXVxcP1teP10rXFw/PSlcXHMrKD89PVxcP1teP10rXFw/W1FxQmJdXFw/W14/XSpcXD89KS9nLCAnJDEnKVxuICBzdHIgPSBzdHIucmVwbGFjZSgvXFw/PT1cXD9bdVVdW3RUXVtmRl0tOFxcP1tRcUJiXVxcPy9nLCAnJykgLy8gam9pbiBieXRlcyBvZiBtdWx0aS1ieXRlIFVURi04XG4gIHN0ciA9IHN0ci5yZXBsYWNlKC89XFw/W1xcd19cXC0qXStcXD9bUXFCYl1cXD9bXj9dK1xcPz0vZywgbWltZVdvcmQgPT4gbWltZVdvcmREZWNvZGUobWltZVdvcmQucmVwbGFjZSgvXFxzKy9nLCAnJykpKVxuXG4gIHJldHVybiBzdHJcbn1cblxuLyoqXG4gKiBGb2xkcyBsb25nIGxpbmVzLCB1c2VmdWwgZm9yIGZvbGRpbmcgaGVhZGVyIGxpbmVzIChhZnRlclNwYWNlPWZhbHNlKSBhbmRcbiAqIGZsb3dlZCB0ZXh0IChhZnRlclNwYWNlPXRydWUpXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gYmUgZm9sZGVkXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGFmdGVyU3BhY2UgSWYgdHJ1ZSwgbGVhdmUgYSBzcGFjZSBpbiB0aCBlbmQgb2YgYSBsaW5lXG4gKiBAcmV0dXJuIHtTdHJpbmd9IFN0cmluZyB3aXRoIGZvbGRlZCBsaW5lc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZm9sZExpbmVzIChzdHIgPSAnJywgYWZ0ZXJTcGFjZSkge1xuICBsZXQgcG9zID0gMFxuICBjb25zdCBsZW4gPSBzdHIubGVuZ3RoXG4gIGxldCByZXN1bHQgPSAnJ1xuICBsZXQgbGluZSwgbWF0Y2hcblxuICB3aGlsZSAocG9zIDwgbGVuKSB7XG4gICAgbGluZSA9IHN0ci5zdWJzdHIocG9zLCBNQVhfTElORV9MRU5HVEgpXG4gICAgaWYgKGxpbmUubGVuZ3RoIDwgTUFYX0xJTkVfTEVOR1RIKSB7XG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgYnJlYWtcbiAgICB9XG4gICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goL15bXlxcblxccl0qKFxccj9cXG58XFxyKS8pKSkge1xuICAgICAgbGluZSA9IG1hdGNoWzBdXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gbGluZS5tYXRjaCgvKFxccyspW15cXHNdKiQvKSkgJiYgbWF0Y2hbMF0ubGVuZ3RoIC0gKGFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApIDwgbGluZS5sZW5ndGgpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAoYWZ0ZXJTcGFjZSA/IChtYXRjaFsxXSB8fCAnJykubGVuZ3RoIDogMCkpKVxuICAgIH0gZWxzZSBpZiAoKG1hdGNoID0gc3RyLnN1YnN0cihwb3MgKyBsaW5lLmxlbmd0aCkubWF0Y2goL15bXlxcc10rKFxccyopLykpKSB7XG4gICAgICBsaW5lID0gbGluZSArIG1hdGNoWzBdLnN1YnN0cigwLCBtYXRjaFswXS5sZW5ndGggLSAoIWFmdGVyU3BhY2UgPyAobWF0Y2hbMV0gfHwgJycpLmxlbmd0aCA6IDApKVxuICAgIH1cblxuICAgIHJlc3VsdCArPSBsaW5lXG4gICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgaWYgKHBvcyA8IGxlbikge1xuICAgICAgcmVzdWx0ICs9ICdcXHJcXG4nXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4gIC8qKlxuICAgKiBFbmNvZGVzIGFuZCBmb2xkcyBhIGhlYWRlciBsaW5lIGZvciBhIE1JTUUgbWVzc2FnZSBoZWFkZXIuXG4gICAqIFNob3J0aGFuZCBmb3IgbWltZVdvcmRzRW5jb2RlICsgZm9sZExpbmVzXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgS2V5IG5hbWUsIHdpbGwgbm90IGJlIGVuY29kZWRcbiAgICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gdmFsdWUgVmFsdWUgdG8gYmUgZW5jb2RlZFxuICAgKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIENoYXJhY3RlciBzZXQgb2YgdGhlIHZhbHVlXG4gICAqIEByZXR1cm4ge1N0cmluZ30gZW5jb2RlZCBhbmQgZm9sZGVkIGhlYWRlciBsaW5lXG4gICAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhlYWRlckxpbmVFbmNvZGUgKGtleSwgdmFsdWUsIGZyb21DaGFyc2V0KSB7XG4gIHZhciBlbmNvZGVkVmFsdWUgPSBtaW1lV29yZHNFbmNvZGUodmFsdWUsICdRJywgZnJvbUNoYXJzZXQpXG4gIHJldHVybiBmb2xkTGluZXMoa2V5ICsgJzogJyArIGVuY29kZWRWYWx1ZSlcbn1cblxuLyoqXG4gKiBUaGUgcmVzdWx0IGlzIG5vdCBtaW1lIHdvcmQgZGVjb2RlZCwgeW91IG5lZWQgdG8gZG8geW91ciBvd24gZGVjb2RpbmcgYmFzZWRcbiAqIG9uIHRoZSBydWxlcyBmb3IgdGhlIHNwZWNpZmljIGhlYWRlciBrZXlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVyTGluZSBTaW5nbGUgaGVhZGVyIGxpbmUsIG1pZ2h0IGluY2x1ZGUgbGluZWJyZWFrcyBhcyB3ZWxsIGlmIGZvbGRlZFxuICogQHJldHVybiB7T2JqZWN0fSBBbmQgb2JqZWN0IG9mIHtrZXksIHZhbHVlfVxuICovXG5leHBvcnQgZnVuY3Rpb24gaGVhZGVyTGluZURlY29kZSAoaGVhZGVyTGluZSA9ICcnKSB7XG4gIGNvbnN0IGxpbmUgPSBoZWFkZXJMaW5lLnRvU3RyaW5nKCkucmVwbGFjZSgvKD86XFxyP1xcbnxcXHIpWyBcXHRdKi9nLCAnICcpLnRyaW0oKVxuICBjb25zdCBtYXRjaCA9IGxpbmUubWF0Y2goL15cXHMqKFteOl0rKTooLiopJC8pXG5cbiAgcmV0dXJuIHtcbiAgICBrZXk6ICgobWF0Y2ggJiYgbWF0Y2hbMV0pIHx8ICcnKS50cmltKCksXG4gICAgdmFsdWU6ICgobWF0Y2ggJiYgbWF0Y2hbMl0pIHx8ICcnKS50cmltKClcbiAgfVxufVxuXG4vKipcbiAqIFBhcnNlcyBhIGJsb2NrIG9mIGhlYWRlciBsaW5lcy4gRG9lcyBub3QgZGVjb2RlIG1pbWUgd29yZHMgYXMgZXZlcnlcbiAqIGhlYWRlciBtaWdodCBoYXZlIGl0cyBvd24gcnVsZXMgKGVnLiBmb3JtYXR0ZWQgZW1haWwgYWRkcmVzc2VzIGFuZCBzdWNoKVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBoZWFkZXJzIEhlYWRlcnMgc3RyaW5nXG4gKiBAcmV0dXJuIHtPYmplY3R9IEFuIG9iamVjdCBvZiBoZWFkZXJzLCB3aGVyZSBoZWFkZXIga2V5cyBhcmUgb2JqZWN0IGtleXMuIE5CISBTZXZlcmFsIHZhbHVlcyB3aXRoIHRoZSBzYW1lIGtleSBtYWtlIHVwIGFuIEFycmF5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZWFkZXJMaW5lc0RlY29kZSAoaGVhZGVycykge1xuICBjb25zdCBsaW5lcyA9IGhlYWRlcnMuc3BsaXQoL1xccj9cXG58XFxyLylcbiAgY29uc3QgaGVhZGVyc09iaiA9IHt9XG5cbiAgZm9yIChsZXQgaSA9IGxpbmVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgaWYgKGkgJiYgbGluZXNbaV0ubWF0Y2goL15cXHMvKSkge1xuICAgICAgbGluZXNbaSAtIDFdICs9ICdcXHJcXG4nICsgbGluZXNbaV1cbiAgICAgIGxpbmVzLnNwbGljZShpLCAxKVxuICAgIH1cbiAgfVxuXG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSBsaW5lcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNvbnN0IGhlYWRlciA9IGhlYWRlckxpbmVEZWNvZGUobGluZXNbaV0pXG4gICAgY29uc3Qga2V5ID0gaGVhZGVyLmtleS50b0xvd2VyQ2FzZSgpXG4gICAgY29uc3QgdmFsdWUgPSBoZWFkZXIudmFsdWVcblxuICAgIGlmICghaGVhZGVyc09ialtrZXldKSB7XG4gICAgICBoZWFkZXJzT2JqW2tleV0gPSB2YWx1ZVxuICAgIH0gZWxzZSB7XG4gICAgICBoZWFkZXJzT2JqW2tleV0gPSBbXS5jb25jYXQoaGVhZGVyc09ialtrZXldLCB2YWx1ZSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gaGVhZGVyc09ialxufVxuXG4vKipcbiAqIFBhcnNlcyBhIGhlYWRlciB2YWx1ZSB3aXRoIGtleT12YWx1ZSBhcmd1bWVudHMgaW50byBhIHN0cnVjdHVyZWRcbiAqIG9iamVjdC5cbiAqXG4gKiAgIHBhcnNlSGVhZGVyVmFsdWUoJ2NvbnRlbnQtdHlwZTogdGV4dC9wbGFpbjsgQ0hBUlNFVD0nVVRGLTgnJykgLT5cbiAqICAge1xuICogICAgICd2YWx1ZSc6ICd0ZXh0L3BsYWluJyxcbiAqICAgICAncGFyYW1zJzoge1xuICogICAgICAgJ2NoYXJzZXQnOiAnVVRGLTgnXG4gKiAgICAgfVxuICogICB9XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBIZWFkZXIgdmFsdWVcbiAqIEByZXR1cm4ge09iamVjdH0gSGVhZGVyIHZhbHVlIGFzIGEgcGFyc2VkIHN0cnVjdHVyZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VIZWFkZXJWYWx1ZSAoc3RyKSB7XG4gIGxldCByZXNwb25zZSA9IHtcbiAgICB2YWx1ZTogZmFsc2UsXG4gICAgcGFyYW1zOiB7fVxuICB9XG4gIGxldCBrZXkgPSBmYWxzZVxuICBsZXQgdmFsdWUgPSAnJ1xuICBsZXQgdHlwZSA9ICd2YWx1ZSdcbiAgbGV0IHF1b3RlID0gZmFsc2VcbiAgbGV0IGVzY2FwZWQgPSBmYWxzZVxuICBsZXQgY2hyXG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHN0ci5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGNociA9IHN0ci5jaGFyQXQoaSlcbiAgICBpZiAodHlwZSA9PT0gJ2tleScpIHtcbiAgICAgIGlmIChjaHIgPT09ICc9Jykge1xuICAgICAgICBrZXkgPSB2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKVxuICAgICAgICB0eXBlID0gJ3ZhbHVlJ1xuICAgICAgICB2YWx1ZSA9ICcnXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICB2YWx1ZSArPSBjaHJcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGVzY2FwZWQpIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9IGVsc2UgaWYgKGNociA9PT0gJ1xcXFwnKSB7XG4gICAgICAgIGVzY2FwZWQgPSB0cnVlXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9IGVsc2UgaWYgKHF1b3RlICYmIGNociA9PT0gcXVvdGUpIHtcbiAgICAgICAgcXVvdGUgPSBmYWxzZVxuICAgICAgfSBlbHNlIGlmICghcXVvdGUgJiYgY2hyID09PSAnXCInKSB7XG4gICAgICAgIHF1b3RlID0gY2hyXG4gICAgICB9IGVsc2UgaWYgKCFxdW90ZSAmJiBjaHIgPT09ICc7Jykge1xuICAgICAgICBpZiAoa2V5ID09PSBmYWxzZSkge1xuICAgICAgICAgIHJlc3BvbnNlLnZhbHVlID0gdmFsdWUudHJpbSgpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSB2YWx1ZS50cmltKClcbiAgICAgICAgfVxuICAgICAgICB0eXBlID0gJ2tleSdcbiAgICAgICAgdmFsdWUgPSAnJ1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFsdWUgKz0gY2hyXG4gICAgICB9XG4gICAgICBlc2NhcGVkID0gZmFsc2VcbiAgICB9XG4gIH1cblxuICBpZiAodHlwZSA9PT0gJ3ZhbHVlJykge1xuICAgIGlmIChrZXkgPT09IGZhbHNlKSB7XG4gICAgICByZXNwb25zZS52YWx1ZSA9IHZhbHVlLnRyaW0oKVxuICAgIH0gZWxzZSB7XG4gICAgICByZXNwb25zZS5wYXJhbXNba2V5XSA9IHZhbHVlLnRyaW0oKVxuICAgIH1cbiAgfSBlbHNlIGlmICh2YWx1ZS50cmltKCkpIHtcbiAgICByZXNwb25zZS5wYXJhbXNbdmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCldID0gJydcbiAgfVxuXG4gIC8vIGhhbmRsZSBwYXJhbWV0ZXIgdmFsdWUgY29udGludWF0aW9uc1xuICAvLyBodHRwczovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMjIzMSNzZWN0aW9uLTNcblxuICAvLyBwcmVwcm9jZXNzIHZhbHVlc1xuICBPYmplY3Qua2V5cyhyZXNwb25zZS5wYXJhbXMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHZhciBhY3R1YWxLZXksIG5yLCBtYXRjaCwgdmFsdWVcbiAgICBpZiAoKG1hdGNoID0ga2V5Lm1hdGNoKC8oXFwqKFxcZCspfFxcKihcXGQrKVxcKnxcXCopJC8pKSkge1xuICAgICAgYWN0dWFsS2V5ID0ga2V5LnN1YnN0cigwLCBtYXRjaC5pbmRleClcbiAgICAgIG5yID0gTnVtYmVyKG1hdGNoWzJdIHx8IG1hdGNoWzNdKSB8fCAwXG5cbiAgICAgIGlmICghcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0gfHwgdHlwZW9mIHJlc3BvbnNlLnBhcmFtc1thY3R1YWxLZXldICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XSA9IHtcbiAgICAgICAgICBjaGFyc2V0OiBmYWxzZSxcbiAgICAgICAgICB2YWx1ZXM6IFtdXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFsdWUgPSByZXNwb25zZS5wYXJhbXNba2V5XVxuXG4gICAgICBpZiAobnIgPT09IDAgJiYgbWF0Y2hbMF0uc3Vic3RyKC0xKSA9PT0gJyonICYmIChtYXRjaCA9IHZhbHVlLm1hdGNoKC9eKFteJ10qKSdbXiddKicoLiopJC8pKSkge1xuICAgICAgICByZXNwb25zZS5wYXJhbXNbYWN0dWFsS2V5XS5jaGFyc2V0ID0gbWF0Y2hbMV0gfHwgJ2lzby04ODU5LTEnXG4gICAgICAgIHZhbHVlID0gbWF0Y2hbMl1cbiAgICAgIH1cblxuICAgICAgcmVzcG9uc2UucGFyYW1zW2FjdHVhbEtleV0udmFsdWVzW25yXSA9IHZhbHVlXG5cbiAgICAgIC8vIHJlbW92ZSB0aGUgb2xkIHJlZmVyZW5jZVxuICAgICAgZGVsZXRlIHJlc3BvbnNlLnBhcmFtc1trZXldXG4gICAgfVxuICB9KVxuXG4gICAgICAvLyBjb25jYXRlbmF0ZSBzcGxpdCByZmMyMjMxIHN0cmluZ3MgYW5kIGNvbnZlcnQgZW5jb2RlZCBzdHJpbmdzIHRvIG1pbWUgZW5jb2RlZCB3b3Jkc1xuICBPYmplY3Qua2V5cyhyZXNwb25zZS5wYXJhbXMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHZhciB2YWx1ZVxuICAgIGlmIChyZXNwb25zZS5wYXJhbXNba2V5XSAmJiBBcnJheS5pc0FycmF5KHJlc3BvbnNlLnBhcmFtc1trZXldLnZhbHVlcykpIHtcbiAgICAgIHZhbHVlID0gcmVzcG9uc2UucGFyYW1zW2tleV0udmFsdWVzLm1hcChmdW5jdGlvbiAodmFsKSB7XG4gICAgICAgIHJldHVybiB2YWwgfHwgJydcbiAgICAgIH0pLmpvaW4oJycpXG5cbiAgICAgIGlmIChyZXNwb25zZS5wYXJhbXNba2V5XS5jaGFyc2V0KSB7XG4gICAgICAgIC8vIGNvbnZlcnQgXCIlQUJcIiB0byBcIj0/Y2hhcnNldD9RPz1BQj89XCJcbiAgICAgICAgcmVzcG9uc2UucGFyYW1zW2tleV0gPSAnPT8nICsgcmVzcG9uc2UucGFyYW1zW2tleV0uY2hhcnNldCArICc/UT8nICsgdmFsdWVcbiAgICAgICAgICAucmVwbGFjZSgvWz0/X1xcc10vZywgZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgICAgIC8vIGZpeCBpbnZhbGlkbHkgZW5jb2RlZCBjaGFyc1xuICAgICAgICAgICAgdmFyIGMgPSBzLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpXG4gICAgICAgICAgICByZXR1cm4gcyA9PT0gJyAnID8gJ18nIDogJyUnICsgKGMubGVuZ3RoIDwgMiA/ICcwJyA6ICcnKSArIGNcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5yZXBsYWNlKC8lL2csICc9JykgKyAnPz0nIC8vIGNoYW5nZSBmcm9tIHVybGVuY29kaW5nIHRvIHBlcmNlbnQgZW5jb2RpbmdcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3BvbnNlLnBhcmFtc1trZXldID0gdmFsdWVcbiAgICAgIH1cbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIHJlc3BvbnNlXG59XG5cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBvciBhbiBVaW50OEFycmF5IHRvIGFuIFVURi04IFBhcmFtZXRlciBWYWx1ZSBDb250aW51YXRpb24gZW5jb2RpbmcgKHJmYzIyMzEpXG4gKiBVc2VmdWwgZm9yIHNwbGl0dGluZyBsb25nIHBhcmFtZXRlciB2YWx1ZXMuXG4gKlxuICogRm9yIGV4YW1wbGVcbiAqICAgICAgdGl0bGU9XCJ1bmljb2RlIHN0cmluZ1wiXG4gKiBiZWNvbWVzXG4gKiAgICAgdGl0bGUqMCo9XCJ1dGYtOCcndW5pY29kZVwiXG4gKiAgICAgdGl0bGUqMSo9XCIlMjBzdHJpbmdcIlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7TnVtYmVyfSBbbWF4TGVuZ3RoPTUwXSBNYXggbGVuZ3RoIGZvciBnZW5lcmF0ZWQgY2h1bmtzXG4gKiBAcGFyYW0ge1N0cmluZ30gW2Zyb21DaGFyc2V0PSdVVEYtOCddIFNvdXJjZSBzaGFyYWN0ZXIgc2V0XG4gKiBAcmV0dXJuIHtBcnJheX0gQSBsaXN0IG9mIGVuY29kZWQga2V5cyBhbmQgaGVhZGVyc1xuICovXG5leHBvcnQgZnVuY3Rpb24gY29udGludWF0aW9uRW5jb2RlIChrZXksIGRhdGEsIG1heExlbmd0aCwgZnJvbUNoYXJzZXQpIHtcbiAgY29uc3QgbGlzdCA9IFtdXG4gIHZhciBlbmNvZGVkU3RyID0gdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnID8gZGF0YSA6IGRlY29kZShkYXRhLCBmcm9tQ2hhcnNldClcbiAgdmFyIGxpbmVcbiAgdmFyIHN0YXJ0UG9zID0gMFxuICB2YXIgaXNFbmNvZGVkID0gZmFsc2VcblxuICBtYXhMZW5ndGggPSBtYXhMZW5ndGggfHwgNTBcblxuICAgICAgLy8gcHJvY2VzcyBhc2NpaSBvbmx5IHRleHRcbiAgaWYgKC9eW1xcdy5cXC0gXSokLy50ZXN0KGRhdGEpKSB7XG4gICAgICAgICAgLy8gY2hlY2sgaWYgY29udmVyc2lvbiBpcyBldmVuIG5lZWRlZFxuICAgIGlmIChlbmNvZGVkU3RyLmxlbmd0aCA8PSBtYXhMZW5ndGgpIHtcbiAgICAgIHJldHVybiBbe1xuICAgICAgICBrZXk6IGtleSxcbiAgICAgICAgdmFsdWU6IC9bXFxzXCI7PV0vLnRlc3QoZW5jb2RlZFN0cikgPyAnXCInICsgZW5jb2RlZFN0ciArICdcIicgOiBlbmNvZGVkU3RyXG4gICAgICB9XVxuICAgIH1cblxuICAgIGVuY29kZWRTdHIgPSBlbmNvZGVkU3RyLnJlcGxhY2UobmV3IFJlZ0V4cCgnLnsnICsgbWF4TGVuZ3RoICsgJ30nLCAnZycpLCBmdW5jdGlvbiAoc3RyKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBzdHJcbiAgICAgIH0pXG4gICAgICByZXR1cm4gJydcbiAgICB9KVxuXG4gICAgaWYgKGVuY29kZWRTdHIpIHtcbiAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgIGxpbmU6IGVuY29kZWRTdHJcbiAgICAgIH0pXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIGZpcnN0IGxpbmUgaW5jbHVkZXMgdGhlIGNoYXJzZXQgYW5kIGxhbmd1YWdlIGluZm8gYW5kIG5lZWRzIHRvIGJlIGVuY29kZWRcbiAgICAvLyBldmVuIGlmIGl0IGRvZXMgbm90IGNvbnRhaW4gYW55IHVuaWNvZGUgY2hhcmFjdGVyc1xuICAgIGxpbmUgPSAndXRmLThcXCdcXCcnXG4gICAgaXNFbmNvZGVkID0gdHJ1ZVxuICAgIHN0YXJ0UG9zID0gMFxuICAgIC8vIHByb2Nlc3MgdGV4dCB3aXRoIHVuaWNvZGUgb3Igc3BlY2lhbCBjaGFyc1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBlbmNvZGVkU3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBsZXQgY2hyID0gZW5jb2RlZFN0cltpXVxuXG4gICAgICBpZiAoaXNFbmNvZGVkKSB7XG4gICAgICAgIGNociA9IGVuY29kZVVSSUNvbXBvbmVudChjaHIpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyB0cnkgdG8gdXJsZW5jb2RlIGN1cnJlbnQgY2hhclxuICAgICAgICBjaHIgPSBjaHIgPT09ICcgJyA/IGNociA6IGVuY29kZVVSSUNvbXBvbmVudChjaHIpXG4gICAgICAgIC8vIEJ5IGRlZmF1bHQgaXQgaXMgbm90IHJlcXVpcmVkIHRvIGVuY29kZSBhIGxpbmUsIHRoZSBuZWVkXG4gICAgICAgIC8vIG9ubHkgYXBwZWFycyB3aGVuIHRoZSBzdHJpbmcgY29udGFpbnMgdW5pY29kZSBvciBzcGVjaWFsIGNoYXJzXG4gICAgICAgIC8vIGluIHRoaXMgY2FzZSB3ZSBzdGFydCBwcm9jZXNzaW5nIHRoZSBsaW5lIG92ZXIgYW5kIGVuY29kZSBhbGwgY2hhcnNcbiAgICAgICAgaWYgKGNociAhPT0gZW5jb2RlZFN0cltpXSkge1xuICAgICAgICAgIC8vIENoZWNrIGlmIGl0IGlzIGV2ZW4gcG9zc2libGUgdG8gYWRkIHRoZSBlbmNvZGVkIGNoYXIgdG8gdGhlIGxpbmVcbiAgICAgICAgICAvLyBJZiBub3QsIHRoZXJlIGlzIG5vIHJlYXNvbiB0byB1c2UgdGhpcyBsaW5lLCBqdXN0IHB1c2ggaXQgdG8gdGhlIGxpc3RcbiAgICAgICAgICAvLyBhbmQgc3RhcnQgYSBuZXcgbGluZSB3aXRoIHRoZSBjaGFyIHRoYXQgbmVlZHMgZW5jb2RpbmdcbiAgICAgICAgICBpZiAoKGVuY29kZVVSSUNvbXBvbmVudChsaW5lKSArIGNocikubGVuZ3RoID49IG1heExlbmd0aCkge1xuICAgICAgICAgICAgbGlzdC5wdXNoKHtcbiAgICAgICAgICAgICAgbGluZTogbGluZSxcbiAgICAgICAgICAgICAgZW5jb2RlZDogaXNFbmNvZGVkXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgbGluZSA9ICcnXG4gICAgICAgICAgICBzdGFydFBvcyA9IGkgLSAxXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlzRW5jb2RlZCA9IHRydWVcbiAgICAgICAgICAgIGkgPSBzdGFydFBvc1xuICAgICAgICAgICAgbGluZSA9ICcnXG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIGlmIHRoZSBsaW5lIGlzIGFscmVhZHkgdG9vIGxvbmcsIHB1c2ggaXQgdG8gdGhlIGxpc3QgYW5kIHN0YXJ0IGEgbmV3IG9uZVxuICAgICAgaWYgKChsaW5lICsgY2hyKS5sZW5ndGggPj0gbWF4TGVuZ3RoKSB7XG4gICAgICAgIGxpc3QucHVzaCh7XG4gICAgICAgICAgbGluZTogbGluZSxcbiAgICAgICAgICBlbmNvZGVkOiBpc0VuY29kZWRcbiAgICAgICAgfSlcbiAgICAgICAgbGluZSA9IGNociA9IGVuY29kZWRTdHJbaV0gPT09ICcgJyA/ICcgJyA6IGVuY29kZVVSSUNvbXBvbmVudChlbmNvZGVkU3RyW2ldKVxuICAgICAgICBpZiAoY2hyID09PSBlbmNvZGVkU3RyW2ldKSB7XG4gICAgICAgICAgaXNFbmNvZGVkID0gZmFsc2VcbiAgICAgICAgICBzdGFydFBvcyA9IGkgLSAxXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaXNFbmNvZGVkID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsaW5lICs9IGNoclxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChsaW5lKSB7XG4gICAgICBsaXN0LnB1c2goe1xuICAgICAgICBsaW5lOiBsaW5lLFxuICAgICAgICBlbmNvZGVkOiBpc0VuY29kZWRcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxpc3QubWFwKGZ1bmN0aW9uIChpdGVtLCBpKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgLy8gZW5jb2RlZCBsaW5lczoge25hbWV9KntwYXJ0fSpcbiAgICAgICAgICAgICAgLy8gdW5lbmNvZGVkIGxpbmVzOiB7bmFtZX0qe3BhcnR9XG4gICAgICAgICAgICAgIC8vIGlmIGFueSBsaW5lIG5lZWRzIHRvIGJlIGVuY29kZWQgdGhlbiB0aGUgZmlyc3QgbGluZSAocGFydD09MCkgaXMgYWx3YXlzIGVuY29kZWRcbiAgICAgIGtleToga2V5ICsgJyonICsgaSArIChpdGVtLmVuY29kZWQgPyAnKicgOiAnJyksXG4gICAgICB2YWx1ZTogL1tcXHNcIjs9XS8udGVzdChpdGVtLmxpbmUpID8gJ1wiJyArIGl0ZW0ubGluZSArICdcIicgOiBpdGVtLmxpbmVcbiAgICB9XG4gIH0pXG59XG5cbi8qKlxuICogU3BsaXRzIGEgbWltZSBlbmNvZGVkIHN0cmluZy4gTmVlZGVkIGZvciBkaXZpZGluZyBtaW1lIHdvcmRzIGludG8gc21hbGxlciBjaHVua3NcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIE1pbWUgZW5jb2RlZCBzdHJpbmcgdG8gYmUgc3BsaXQgdXBcbiAqIEBwYXJhbSB7TnVtYmVyfSBtYXhsZW4gTWF4aW11bSBsZW5ndGggb2YgY2hhcmFjdGVycyBmb3Igb25lIHBhcnQgKG1pbmltdW0gMTIpXG4gKiBAcmV0dXJuIHtBcnJheX0gU3BsaXQgc3RyaW5nXG4gKi9cbmZ1bmN0aW9uIF9zcGxpdE1pbWVFbmNvZGVkU3RyaW5nIChzdHIsIG1heGxlbiA9IDEyKSB7XG4gIGNvbnN0IG1pbldvcmRMZW5ndGggPSAxMiAvLyByZXF1aXJlIGF0IGxlYXN0IDEyIHN5bWJvbHMgdG8gZml0IHBvc3NpYmxlIDQgb2N0ZXQgVVRGLTggc2VxdWVuY2VzXG4gIGNvbnN0IG1heFdvcmRMZW5ndGggPSBNYXRoLm1heChtYXhsZW4sIG1pbldvcmRMZW5ndGgpXG4gIGNvbnN0IGxpbmVzID0gW11cblxuICB3aGlsZSAoc3RyLmxlbmd0aCkge1xuICAgIGxldCBjdXJMaW5lID0gc3RyLnN1YnN0cigwLCBtYXhXb3JkTGVuZ3RoKVxuXG4gICAgY29uc3QgbWF0Y2ggPSBjdXJMaW5lLm1hdGNoKC89WzAtOUEtRl0/JC9pKSAvLyBza2lwIGluY29tcGxldGUgZXNjYXBlZCBjaGFyXG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjdXJMaW5lID0gY3VyTGluZS5zdWJzdHIoMCwgbWF0Y2guaW5kZXgpXG4gICAgfVxuXG4gICAgbGV0IGRvbmUgPSBmYWxzZVxuICAgIHdoaWxlICghZG9uZSkge1xuICAgICAgbGV0IGNoclxuICAgICAgZG9uZSA9IHRydWVcbiAgICAgIGNvbnN0IG1hdGNoID0gc3RyLnN1YnN0cihjdXJMaW5lLmxlbmd0aCkubWF0Y2goL149KFswLTlBLUZdezJ9KS9pKSAvLyBjaGVjayBpZiBub3QgbWlkZGxlIG9mIGEgdW5pY29kZSBjaGFyIHNlcXVlbmNlXG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgY2hyID0gcGFyc2VJbnQobWF0Y2hbMV0sIDE2KVxuICAgICAgICAvLyBpbnZhbGlkIHNlcXVlbmNlLCBtb3ZlIG9uZSBjaGFyIGJhY2sgYW5jIHJlY2hlY2tcbiAgICAgICAgaWYgKGNociA8IDB4QzIgJiYgY2hyID4gMHg3Rikge1xuICAgICAgICAgIGN1ckxpbmUgPSBjdXJMaW5lLnN1YnN0cigwLCBjdXJMaW5lLmxlbmd0aCAtIDMpXG4gICAgICAgICAgZG9uZSA9IGZhbHNlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY3VyTGluZS5sZW5ndGgpIHtcbiAgICAgIGxpbmVzLnB1c2goY3VyTGluZSlcbiAgICB9XG4gICAgc3RyID0gc3RyLnN1YnN0cihjdXJMaW5lLmxlbmd0aClcbiAgfVxuXG4gIHJldHVybiBsaW5lc1xufVxuXG5mdW5jdGlvbiBfYWRkQmFzZTY0U29mdExpbmVicmVha3MgKGJhc2U2NEVuY29kZWRTdHIgPSAnJykge1xuICByZXR1cm4gYmFzZTY0RW5jb2RlZFN0ci50cmltKCkucmVwbGFjZShuZXcgUmVnRXhwKCcueycgKyBNQVhfTElORV9MRU5HVEggKyAnfScsICdnJyksICckJlxcclxcbicpLnRyaW0oKVxufVxuXG4gIC8qKlxuICAgKiBBZGRzIHNvZnQgbGluZSBicmVha3ModGhlIG9uZXMgdGhhdCB3aWxsIGJlIHN0cmlwcGVkIG91dCB3aGVuIGRlY29kaW5nIFFQKVxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gcXBFbmNvZGVkU3RyIFN0cmluZyBpbiBRdW90ZWQtUHJpbnRhYmxlIGVuY29kaW5nXG4gICAqIEByZXR1cm4ge1N0cmluZ30gU3RyaW5nIHdpdGggZm9yY2VkIGxpbmUgYnJlYWtzXG4gICAqL1xuZnVuY3Rpb24gX2FkZFFQU29mdExpbmVicmVha3MgKHFwRW5jb2RlZFN0ciA9ICcnKSB7XG4gIGxldCBwb3MgPSAwXG4gIGNvbnN0IGxlbiA9IHFwRW5jb2RlZFN0ci5sZW5ndGhcbiAgY29uc3QgbGluZU1hcmdpbiA9IE1hdGguZmxvb3IoTUFYX0xJTkVfTEVOR1RIIC8gMylcbiAgbGV0IHJlc3VsdCA9ICcnXG4gIGxldCBtYXRjaCwgbGluZVxuXG4gICAgICAvLyBpbnNlcnQgc29mdCBsaW5lYnJlYWtzIHdoZXJlIG5lZWRlZFxuICB3aGlsZSAocG9zIDwgbGVuKSB7XG4gICAgbGluZSA9IHFwRW5jb2RlZFN0ci5zdWJzdHIocG9zLCBNQVhfTElORV9MRU5HVEgpXG4gICAgaWYgKChtYXRjaCA9IGxpbmUubWF0Y2goL1xcclxcbi8pKSkge1xuICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIG1hdGNoLmluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoKVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICBpZiAobGluZS5zdWJzdHIoLTEpID09PSAnXFxuJykge1xuICAgICAgLy8gbm90aGluZyB0byBjaGFuZ2UgaGVyZVxuICAgICAgcmVzdWx0ICs9IGxpbmVcbiAgICAgIHBvcyArPSBsaW5lLmxlbmd0aFxuICAgICAgY29udGludWVcbiAgICB9IGVsc2UgaWYgKChtYXRjaCA9IGxpbmUuc3Vic3RyKC1saW5lTWFyZ2luKS5tYXRjaCgvXFxuLio/JC8pKSkge1xuICAgICAgLy8gdHJ1bmNhdGUgdG8gbmVhcmVzdCBsaW5lIGJyZWFrXG4gICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAobWF0Y2hbMF0ubGVuZ3RoIC0gMSkpXG4gICAgICByZXN1bHQgKz0gbGluZVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBjb250aW51ZVxuICAgIH0gZWxzZSBpZiAobGluZS5sZW5ndGggPiBNQVhfTElORV9MRU5HVEggLSBsaW5lTWFyZ2luICYmIChtYXRjaCA9IGxpbmUuc3Vic3RyKC1saW5lTWFyZ2luKS5tYXRjaCgvWyBcXHQuLCE/XVteIFxcdC4sIT9dKiQvKSkpIHtcbiAgICAgIC8vIHRydW5jYXRlIHRvIG5lYXJlc3Qgc3BhY2VcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIChtYXRjaFswXS5sZW5ndGggLSAxKSlcbiAgICB9IGVsc2UgaWYgKGxpbmUuc3Vic3RyKC0xKSA9PT0gJ1xccicpIHtcbiAgICAgIGxpbmUgPSBsaW5lLnN1YnN0cigwLCBsaW5lLmxlbmd0aCAtIDEpXG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChsaW5lLm1hdGNoKC89W1xcZGEtZl17MCwyfSQvaSkpIHtcbiAgICAgICAgLy8gcHVzaCBpbmNvbXBsZXRlIGVuY29kaW5nIHNlcXVlbmNlcyB0byB0aGUgbmV4dCBsaW5lXG4gICAgICAgIGlmICgobWF0Y2ggPSBsaW5lLm1hdGNoKC89W1xcZGEtZl17MCwxfSQvaSkpKSB7XG4gICAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gbWF0Y2hbMF0ubGVuZ3RoKVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZW5zdXJlIHRoYXQgdXRmLTggc2VxdWVuY2VzIGFyZSBub3Qgc3BsaXRcbiAgICAgICAgd2hpbGUgKGxpbmUubGVuZ3RoID4gMyAmJiBsaW5lLmxlbmd0aCA8IGxlbiAtIHBvcyAmJiAhbGluZS5tYXRjaCgvXig/Oj1bXFxkYS1mXXsyfSl7MSw0fSQvaSkgJiYgKG1hdGNoID0gbGluZS5tYXRjaCgvPVtcXGRhLWZdezJ9JC9pZykpKSB7XG4gICAgICAgICAgY29uc3QgY29kZSA9IHBhcnNlSW50KG1hdGNoWzBdLnN1YnN0cigxLCAyKSwgMTYpXG4gICAgICAgICAgaWYgKGNvZGUgPCAxMjgpIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMylcblxuICAgICAgICAgIGlmIChjb2RlID49IDB4QzApIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvcyArIGxpbmUubGVuZ3RoIDwgbGVuICYmIGxpbmUuc3Vic3RyKC0xKSAhPT0gJ1xcbicpIHtcbiAgICAgIGlmIChsaW5lLmxlbmd0aCA9PT0gTUFYX0xJTkVfTEVOR1RIICYmIGxpbmUubWF0Y2goLz1bXFxkYS1mXXsyfSQvaSkpIHtcbiAgICAgICAgbGluZSA9IGxpbmUuc3Vic3RyKDAsIGxpbmUubGVuZ3RoIC0gMylcbiAgICAgIH0gZWxzZSBpZiAobGluZS5sZW5ndGggPT09IE1BWF9MSU5FX0xFTkdUSCkge1xuICAgICAgICBsaW5lID0gbGluZS5zdWJzdHIoMCwgbGluZS5sZW5ndGggLSAxKVxuICAgICAgfVxuICAgICAgcG9zICs9IGxpbmUubGVuZ3RoXG4gICAgICBsaW5lICs9ICc9XFxyXFxuJ1xuICAgIH0gZWxzZSB7XG4gICAgICBwb3MgKz0gbGluZS5sZW5ndGhcbiAgICB9XG5cbiAgICByZXN1bHQgKz0gbGluZVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5leHBvcnQgeyBkZWNvZGUsIGNvbnZlcnQgfVxuIl19