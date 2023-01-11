"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convert = exports.arr2str = void 0;
exports.decode = decode;
exports.encode = void 0;
var _textEncoding = require("text-encoding");
/* eslint-disable @typescript-eslint/space-before-function-paren, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/member-delimiter-style */

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJlbmNvZGUiLCJzdHIiLCJUZXh0RW5jb2RlciIsImFycjJzdHIiLCJhcnIiLCJDSFVOS19TWiIsInN0cnMiLCJpIiwibGVuZ3RoIiwicHVzaCIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImFwcGx5Iiwic3ViYXJyYXkiLCJqb2luIiwiZGVjb2RlIiwiYnVmIiwiZnJvbUNoYXJzZXQiLCJjaGFyc2V0cyIsImNoYXJzZXQiLCJub3JtYWxpemVDaGFyc2V0IiwiZmF0YWwiLCJUZXh0RGVjb2RlciIsImUiLCJjb252ZXJ0IiwiZGF0YSIsIm1hdGNoIl0sInNvdXJjZXMiOlsiLi4vc3JjL2NoYXJzZXQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L3NwYWNlLWJlZm9yZS1mdW5jdGlvbi1wYXJlbiwgQHR5cGVzY3JpcHQtZXNsaW50L3N0cmljdC1ib29sZWFuLWV4cHJlc3Npb25zLCBAdHlwZXNjcmlwdC1lc2xpbnQvbWVtYmVyLWRlbGltaXRlci1zdHlsZSAqL1xuaW1wb3J0IHsgVGV4dERlY29kZXIsIFRleHRFbmNvZGVyIH0gZnJvbSAndGV4dC1lbmNvZGluZydcblxuLyoqXG4gKiBFbmNvZGVzIGFuIHVuaWNvZGUgc3RyaW5nIGludG8gYW4gVWludDhBcnJheSBvYmplY3QgYXMgVVRGLThcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBiZSBlbmNvZGVkXG4gKiBAcmV0dXJuIHtVaW50OEFycmF5fSBVVEYtOCBlbmNvZGVkIHR5cGVkIGFycmF5XG4gKi9cbmV4cG9ydCBjb25zdCBlbmNvZGUgPSAoc3RyOiBzdHJpbmcpOiBVaW50OEFycmF5ID0+IG5ldyBUZXh0RW5jb2RlcignVVRGLTgnKS5lbmNvZGUoc3RyKVxuXG5leHBvcnQgY29uc3QgYXJyMnN0ciA9IChhcnI6IHN0cmluZyB8IFVpbnQ4QXJyYXkpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBDSFVOS19TWiA9IDB4ODAwMFxuICBjb25zdCBzdHJzID0gW11cblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkgKz0gQ0hVTktfU1opIHtcbiAgICBzdHJzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBhcnIuc3ViYXJyYXkoaSwgaSArIENIVU5LX1NaKSkpXG4gIH1cblxuICByZXR1cm4gc3Rycy5qb2luKCcnKVxufVxuXG4vKipcbiAqIERlY29kZXMgYSBzdHJpbmcgZnJvbSBVaW50OEFycmF5IHRvIGFuIHVuaWNvZGUgc3RyaW5nIHVzaW5nIHNwZWNpZmllZCBlbmNvZGluZ1xuICpcbiAqIEBwYXJhbSB7VWludDhBcnJheX0gYnVmIEJpbmFyeSBkYXRhIHRvIGJlIGRlY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBCaW5hcnkgZGF0YSBpcyBkZWNvZGVkIGludG8gc3RyaW5nIHVzaW5nIHRoaXMgY2hhcnNldFxuICogQHJldHVybiB7U3RyaW5nfSBEZWNvZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZGVjb2RlKGJ1Zjogc3RyaW5nIHwgVWludDhBcnJheSwgZnJvbUNoYXJzZXQgPSAndXRmLTgnKTogc3RyaW5nIHtcbiAgY29uc3QgY2hhcnNldHMgPSBbXG4gICAgeyBjaGFyc2V0OiBub3JtYWxpemVDaGFyc2V0KGZyb21DaGFyc2V0KSwgZmF0YWw6IGZhbHNlIH0sXG4gICAgeyBjaGFyc2V0OiAndXRmLTgnLCBmYXRhbDogdHJ1ZSB9LFxuICAgIHsgY2hhcnNldDogJ2lzby04ODU5LTE1JywgZmF0YWw6IGZhbHNlIH1cbiAgXVxuXG4gIGZvciAoY29uc3QgeyBjaGFyc2V0LCBmYXRhbCB9IG9mIGNoYXJzZXRzKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoY2hhcnNldCwgeyBmYXRhbCB9KS5kZWNvZGUoYnVmKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIC8vIGlnbm9yZVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBhcnIyc3RyKGJ1ZikgLy8gYWxsIGVsc2UgZmFpbHMsIHRyZWF0IGl0IGFzIGJpbmFyeVxufVxuXG4vKipcbiAqIENvbnZlcnQgYSBzdHJpbmcgZnJvbSBzcGVjaWZpYyBlbmNvZGluZyB0byBVVEYtOCBVaW50OEFycmF5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBEYXRhIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBTb3VyY2UgZW5jb2RpbmcgZm9yIHRoZSBzdHJpbmcgKG9wdGlvbmFsIGZvciBkYXRhIG9mIHR5cGUgU3RyaW5nKVxuICogQHJldHVybiB7VWludDhBcnJheX0gVVRGLTggZW5jb2RlZCB0eXBlZCBhcnJheVxuICovXG5leHBvcnQgY29uc3QgY29udmVydCA9IChkYXRhOiBzdHJpbmcgfCBVaW50OEFycmF5LCBmcm9tQ2hhcnNldDogc3RyaW5nKTogVWludDhBcnJheSA9PlxuICB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBlbmNvZGUoZGF0YSkgOiBlbmNvZGUoZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KSlcblxuZnVuY3Rpb24gbm9ybWFsaXplQ2hhcnNldChjaGFyc2V0ID0gJ3V0Zi04Jyk6IHN0cmluZyB7XG4gIGxldCBtYXRjaFxuXG4gIGlmICgobWF0Y2ggPSBjaGFyc2V0Lm1hdGNoKC9edXRmWy1fXT8oXFxkKykkL2kpKSkge1xuICAgIHJldHVybiAnVVRGLScgKyBtYXRjaFsxXVxuICB9XG5cbiAgaWYgKChtYXRjaCA9IGNoYXJzZXQubWF0Y2goL153aW5bLV9dPyhcXGQrKSQvaSkpKSB7XG4gICAgcmV0dXJuICdXSU5ET1dTLScgKyBtYXRjaFsxXVxuICB9XG5cbiAgaWYgKChtYXRjaCA9IGNoYXJzZXQubWF0Y2goL15sYXRpblstX10/KFxcZCspJC9pKSkpIHtcbiAgICByZXR1cm4gJ0lTTy04ODU5LScgKyBtYXRjaFsxXVxuICB9XG5cbiAgcmV0dXJuIGNoYXJzZXRcbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFDQTtBQURBOztBQUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNPLElBQU1BLE1BQU0sR0FBRyxTQUFUQSxNQUFNLENBQUlDLEdBQVc7RUFBQSxPQUFpQixJQUFJQyx5QkFBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDRixNQUFNLENBQUNDLEdBQUcsQ0FBQztBQUFBO0FBQUE7QUFFaEYsSUFBTUUsT0FBTyxHQUFHLFNBQVZBLE9BQU8sQ0FBSUMsR0FBd0IsRUFBYTtFQUMzRCxJQUFNQyxRQUFRLEdBQUcsTUFBTTtFQUN2QixJQUFNQyxJQUFJLEdBQUcsRUFBRTtFQUVmLEtBQUssSUFBSUMsQ0FBQyxHQUFHLENBQUMsRUFBRUEsQ0FBQyxHQUFHSCxHQUFHLENBQUNJLE1BQU0sRUFBRUQsQ0FBQyxJQUFJRixRQUFRLEVBQUU7SUFDN0NDLElBQUksQ0FBQ0csSUFBSSxDQUFDQyxNQUFNLENBQUNDLFlBQVksQ0FBQ0MsS0FBSyxDQUFDLElBQUksRUFBRVIsR0FBRyxDQUFDUyxRQUFRLENBQUNOLENBQUMsRUFBRUEsQ0FBQyxHQUFHRixRQUFRLENBQUMsQ0FBQyxDQUFDO0VBQzNFO0VBRUEsT0FBT0MsSUFBSSxDQUFDUSxJQUFJLENBQUMsRUFBRSxDQUFDO0FBQ3RCLENBQUM7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFOQTtBQU9PLFNBQVNDLE1BQU0sQ0FBQ0MsR0FBd0IsRUFBaUM7RUFBQSxJQUEvQkMsV0FBVyx1RUFBRyxPQUFPO0VBQ3BFLElBQU1DLFFBQVEsR0FBRyxDQUNmO0lBQUVDLE9BQU8sRUFBRUMsZ0JBQWdCLENBQUNILFdBQVcsQ0FBQztJQUFFSSxLQUFLLEVBQUU7RUFBTSxDQUFDLEVBQ3hEO0lBQUVGLE9BQU8sRUFBRSxPQUFPO0lBQUVFLEtBQUssRUFBRTtFQUFLLENBQUMsRUFDakM7SUFBRUYsT0FBTyxFQUFFLGFBQWE7SUFBRUUsS0FBSyxFQUFFO0VBQU0sQ0FBQyxDQUN6QztFQUVELDZCQUFpQ0gsUUFBUSwrQkFBRTtJQUF0QztNQUFRQyxPQUFPLGdCQUFQQSxPQUFPO01BQUVFLEtBQUssZ0JBQUxBLEtBQUs7SUFDekIsSUFBSTtNQUNGLE9BQU8sSUFBSUMseUJBQVcsQ0FBQ0gsT0FBTyxFQUFFO1FBQUVFLEtBQUssRUFBTEE7TUFBTSxDQUFDLENBQUMsQ0FBQ04sTUFBTSxDQUFDQyxHQUFHLENBQUM7SUFDeEQsQ0FBQyxDQUFDLE9BQU9PLENBQUMsRUFBRTtNQUNWO0lBQUE7RUFFSjtFQUVBLE9BQU9wQixPQUFPLENBQUNhLEdBQUcsQ0FBQyxFQUFDO0FBQ3RCOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ08sSUFBTVEsT0FBTyxHQUFHLFNBQVZBLE9BQU8sQ0FBSUMsSUFBeUIsRUFBRVIsV0FBbUI7RUFBQSxPQUNwRSxPQUFPUSxJQUFJLEtBQUssUUFBUSxHQUFHekIsTUFBTSxDQUFDeUIsSUFBSSxDQUFDLEdBQUd6QixNQUFNLENBQUNlLE1BQU0sQ0FBQ1UsSUFBSSxFQUFFUixXQUFXLENBQUMsQ0FBQztBQUFBO0FBQUE7QUFFN0UsU0FBU0csZ0JBQWdCLEdBQTRCO0VBQUEsSUFBM0JELE9BQU8sdUVBQUcsT0FBTztFQUN6QyxJQUFJTyxLQUFLO0VBRVQsSUFBS0EsS0FBSyxHQUFHUCxPQUFPLENBQUNPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxFQUFHO0lBQy9DLE9BQU8sTUFBTSxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQzFCO0VBRUEsSUFBS0EsS0FBSyxHQUFHUCxPQUFPLENBQUNPLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxFQUFHO0lBQy9DLE9BQU8sVUFBVSxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQzlCO0VBRUEsSUFBS0EsS0FBSyxHQUFHUCxPQUFPLENBQUNPLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQyxFQUFHO0lBQ2pELE9BQU8sV0FBVyxHQUFHQSxLQUFLLENBQUMsQ0FBQyxDQUFDO0VBQy9CO0VBRUEsT0FBT1AsT0FBTztBQUNoQiJ9