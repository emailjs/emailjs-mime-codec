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
    strs.push(String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK_SZ)));
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
    } catch (e) {}
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJlbmNvZGUiLCJzdHIiLCJUZXh0RW5jb2RlciIsImFycjJzdHIiLCJhcnIiLCJDSFVOS19TWiIsInN0cnMiLCJpIiwibGVuZ3RoIiwicHVzaCIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5Iiwic3ViYXJyYXkiLCJqb2luIiwiZGVjb2RlIiwiYnVmIiwiZnJvbUNoYXJzZXQiLCJjaGFyc2V0cyIsImNoYXJzZXQiLCJub3JtYWxpemVDaGFyc2V0IiwiZmF0YWwiLCJUZXh0RGVjb2RlciIsImUiLCJjb252ZXJ0IiwiZGF0YSIsIm1hdGNoIl0sInNvdXJjZXMiOlsiLi4vc3JjL2NoYXJzZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgVGV4dERlY29kZXIsIFRleHRFbmNvZGVyIH0gZnJvbSAndGV4dC1lbmNvZGluZydcblxuLyoqXG4gKiBFbmNvZGVzIGFuIHVuaWNvZGUgc3RyaW5nIGludG8gYW4gVWludDhBcnJheSBvYmplY3QgYXMgVVRGLThcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcmV0dXJuIHtVaW50OEFycmF5fSBVVEYtOCBlbmNvZGVkIHR5cGVkIGFycmF5XG4gKi9cbmV4cG9ydCBjb25zdCBlbmNvZGUgPSBzdHIgPT4gbmV3IFRleHRFbmNvZGVyKCdVVEYtOCcpLmVuY29kZShzdHIpXG5cbmV4cG9ydCBjb25zdCBhcnIyc3RyID0gYXJyID0+IHtcbiAgY29uc3QgQ0hVTktfU1ogPSAweDgwMDBcbiAgY29uc3Qgc3RycyA9IFtdXG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpICs9IENIVU5LX1NaKSB7XG4gICAgc3Rycy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYXJyLnN1YmFycmF5KGksIGkgKyBDSFVOS19TWikpKVxuICB9XG5cbiAgcmV0dXJuIHN0cnMuam9pbignJylcbn1cblxuLyoqXG4gKiBEZWNvZGVzIGEgc3RyaW5nIGZyb20gVWludDhBcnJheSB0byBhbiB1bmljb2RlIHN0cmluZyB1c2luZyBzcGVjaWZpZWQgZW5jb2RpbmdcbiAqXG4gKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IGJ1ZiBCaW5hcnkgZGF0YSB0byBiZSBkZWNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gQmluYXJ5IGRhdGEgaXMgZGVjb2RlZCBpbnRvIHN0cmluZyB1c2luZyB0aGlzIGNoYXJzZXRcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRlY29kZSAoYnVmLCBmcm9tQ2hhcnNldCA9ICd1dGYtOCcpIHtcbiAgY29uc3QgY2hhcnNldHMgPSBbXG4gICAgeyBjaGFyc2V0OiBub3JtYWxpemVDaGFyc2V0KGZyb21DaGFyc2V0KSwgZmF0YWw6IGZhbHNlIH0sXG4gICAgeyBjaGFyc2V0OiAndXRmLTgnLCBmYXRhbDogdHJ1ZSB9LFxuICAgIHsgY2hhcnNldDogJ2lzby04ODU5LTE1JywgZmF0YWw6IGZhbHNlIH1cbiAgXVxuXG4gIGZvciAoY29uc3QgeyBjaGFyc2V0LCBmYXRhbCB9IG9mIGNoYXJzZXRzKSB7XG4gICAgdHJ5IHsgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcihjaGFyc2V0LCB7IGZhdGFsIH0pLmRlY29kZShidWYpIH0gY2F0Y2ggKGUpIHsgfVxuICB9XG5cbiAgcmV0dXJuIGFycjJzdHIoYnVmKSAvLyBhbGwgZWxzZSBmYWlscywgdHJlYXQgaXQgYXMgYmluYXJ5XG59XG5cbi8qKlxuICogQ29udmVydCBhIHN0cmluZyBmcm9tIHNwZWNpZmljIGVuY29kaW5nIHRvIFVURi04IFVpbnQ4QXJyYXlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIERhdGEgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IFNvdXJjZSBlbmNvZGluZyBmb3IgdGhlIHN0cmluZyAob3B0aW9uYWwgZm9yIGRhdGEgb2YgdHlwZSBTdHJpbmcpXG4gKiBAcmV0dXJuIHtVaW50OEFycmF5fSBVVEYtOCBlbmNvZGVkIHR5cGVkIGFycmF5XG4gKi9cbmV4cG9ydCBjb25zdCBjb252ZXJ0ID0gKGRhdGEsIGZyb21DaGFyc2V0KSA9PiB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBlbmNvZGUoZGF0YSkgOiBlbmNvZGUoZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KSlcblxuZnVuY3Rpb24gbm9ybWFsaXplQ2hhcnNldCAoY2hhcnNldCA9ICd1dGYtOCcpIHtcbiAgbGV0IG1hdGNoXG5cbiAgaWYgKChtYXRjaCA9IGNoYXJzZXQubWF0Y2goL151dGZbLV9dPyhcXGQrKSQvaSkpKSB7XG4gICAgcmV0dXJuICdVVEYtJyArIG1hdGNoWzFdXG4gIH1cblxuICBpZiAoKG1hdGNoID0gY2hhcnNldC5tYXRjaCgvXndpblstX10/KFxcZCspJC9pKSkpIHtcbiAgICByZXR1cm4gJ1dJTkRPV1MtJyArIG1hdGNoWzFdXG4gIH1cblxuICBpZiAoKG1hdGNoID0gY2hhcnNldC5tYXRjaCgvXmxhdGluWy1fXT8oXFxkKykkL2kpKSkge1xuICAgIHJldHVybiAnSVNPLTg4NTktJyArIG1hdGNoWzFdXG4gIH1cblxuICByZXR1cm4gY2hhcnNldFxufVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sSUFBTUEsTUFBTSxHQUFHLFNBQVRBLE1BQU0sQ0FBR0MsR0FBRztFQUFBLE9BQUksSUFBSUMseUJBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQ0YsTUFBTSxDQUFDQyxHQUFHLENBQUM7QUFBQTtBQUFBO0FBRTFELElBQU1FLE9BQU8sR0FBRyxTQUFWQSxPQUFPLENBQUdDLEdBQUcsRUFBSTtFQUM1QixJQUFNQyxRQUFRLEdBQUcsTUFBTTtFQUN2QixJQUFNQyxJQUFJLEdBQUcsRUFBRTtFQUVmLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSCxHQUFHLENBQUNJLE1BQU0sRUFBRUQsQ0FBQyxJQUFJRixRQUFRLEVBQUU7SUFDN0NDLElBQUksQ0FBQ0csSUFBSSxDQUFDQyxNQUFNLENBQUNDLFlBQVksQ0FBQ0MsS0FBSyxDQUFDLElBQUksRUFBRVIsR0FBRyxDQUFDUyxRQUFRLENBQUNOLENBQUMsRUFBRUEsQ0FBQyxHQUFHRixRQUFRLENBQUMsQ0FBQyxDQUFDO0VBQzNFO0VBRUEsT0FBT0MsSUFBSSxDQUFDUSxJQUFJLENBQUMsRUFBRSxDQUFDO0FBQ3RCLENBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFOQTtBQU9PLFNBQVNDLE1BQU0sQ0FBRUMsR0FBRyxFQUF5QjtFQUFBLElBQXZCQyxXQUFXLHVFQUFHLE9BQU87RUFDaEQsSUFBTUMsUUFBUSxHQUFHLENBQ2Y7SUFBRUMsT0FBTyxFQUFFQyxnQkFBZ0IsQ0FBQ0gsV0FBVyxDQUFDO0lBQUVJLEtBQUssRUFBRTtFQUFNLENBQUMsRUFDeEQ7SUFBRUYsT0FBTyxFQUFFLE9BQU87SUFBRUUsS0FBSyxFQUFFO0VBQUssQ0FBQyxFQUNqQztJQUFFRixPQUFPLEVBQUUsYUFBYTtJQUFFRSxLQUFLLEVBQUU7RUFBTSxDQUFDLENBQ3pDO0VBRUQsNkJBQWlDSCxRQUFRLCtCQUFFO0lBQXRDO01BQVFDLE9BQU8sZ0JBQVBBLE9BQU87TUFBRUUsS0FBSyxnQkFBTEEsS0FBSztJQUN6QixJQUFJO01BQUUsT0FBTyxJQUFJQyx5QkFBVyxDQUFDSCxPQUFPLEVBQUU7UUFBRUUsS0FBSyxFQUFMQTtNQUFNLENBQUMsQ0FBQyxDQUFDTixNQUFNLENBQUNDLEdBQUcsQ0FBQztJQUFDLENBQUMsQ0FBQyxPQUFPTyxDQUFDLEVBQUUsQ0FBRTtFQUM3RTtFQUVBLE9BQU9wQixPQUFPLENBQUNhLEdBQUcsQ0FBQyxFQUFDO0FBQ3RCOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sSUFBTVEsT0FBTyxHQUFHLFNBQVZBLE9BQU8sQ0FBSUMsSUFBSSxFQUFFUixXQUFXO0VBQUEsT0FBSyxPQUFPUSxJQUFJLEtBQUssUUFBUSxHQUFHekIsTUFBTSxDQUFDeUIsSUFBSSxDQUFDLEdBQUd6QixNQUFNLENBQUNlLE1BQU0sQ0FBQ1UsSUFBSSxFQUFFUixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFFekgsU0FBU0csZ0JBQWdCLEdBQXFCO0VBQUEsSUFBbkJELE9BQU8sdUVBQUcsT0FBTztFQUMxQyxJQUFJTyxLQUFLO0VBRVQsSUFBS0EsS0FBSyxHQUFHUCxPQUFPLENBQUNPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxFQUFHO0lBQy9DLE9BQU8sTUFBTSxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQzFCO0VBRUEsSUFBS0EsS0FBSyxHQUFHUCxPQUFPLENBQUNPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxFQUFHO0lBQy9DLE9BQU8sVUFBVSxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQzlCO0VBRUEsSUFBS0EsS0FBSyxHQUFHUCxPQUFPLENBQUNPLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxFQUFHO0lBQ2pELE9BQU8sV0FBVyxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQy9CO0VBRUEsT0FBT1AsT0FBTztBQUNoQiJ9