"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convert = exports.arr2str = void 0;
exports.decode = decode;
exports.encode = void 0;
var _textEncoding = require("text-encoding");
/**
 * Encodes an unicode string into an Uint8Array object as UTF-8
 *
 * @param {String} str String to be encoded
 * @return {Uint8Array} UTF-8 encoded typed array
 */
var encode = function encode(str) {
  return new _textEncoding.TextEncoder('UTF-8').encode(str);
};
exports.encode = encode;
var arr2str = function arr2str(arr) {
  var CHUNK_SZ = 0x8000;
  var strs = [];
  for (var i = 0; i < arr.length; i += CHUNK_SZ) {
    strs.push(String.fromCharCode.apply(null, Array.from(arr.subarray(i, i + CHUNK_SZ))));
  }
  return strs.join('');
};

/**
 * Decodes a string from Uint8Array to an unicode string using specified encoding
 *
 * @param {Uint8Array} buf Binary data to be decoded
 * @param {String} Binary data is decoded into string using this charset
 * @return {String} Decoded string
 */
exports.arr2str = arr2str;
function decode(buf) {
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'utf-8';
  var charsets = [{
    charset: normalizeCharset(fromCharset),
    fatal: false
  }, {
    charset: 'utf-8',
    fatal: true
  }, {
    charset: 'iso-8859-15',
    fatal: false
  }];
  for (var _i = 0, _charsets = charsets; _i < _charsets.length; _i++) {
    var _charsets$_i = _charsets[_i],
      charset = _charsets$_i.charset,
      fatal = _charsets$_i.fatal;
    try {
      return new _textEncoding.TextDecoder(charset, {
        fatal: fatal
      }).decode(buf);
    } catch (e) {
      // ignore
    }
  }
  return arr2str(buf); // all else fails, treat it as binary
}

/**
 * Convert a string from specific encoding to UTF-8 Uint8Array
 *
 * @param {String|Uint8Array} data Data to be encoded
 * @param {String} Source encoding for the string (optional for data of type String)
 * @return {Uint8Array} UTF-8 encoded typed array
 */
var convert = function convert(data, fromCharset) {
  return typeof data === 'string' ? encode(data) : encode(decode(data, fromCharset));
};
exports.convert = convert;
function normalizeCharset() {
  var charset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'utf-8';
  var match;
  if (match = charset.match(/^utf[-_]?(\d+)$/i)) {
    return 'UTF-' + match[1];
  }
  if (match = charset.match(/^win[-_]?(\d+)$/i)) {
    return 'WINDOWS-' + match[1];
  }
  if (match = charset.match(/^latin[-_]?(\d+)$/i)) {
    return 'ISO-8859-' + match[1];
  }
  return charset;
}