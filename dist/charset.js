'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convert = exports.encode = undefined;
exports.decode = decode;

var _textEncoding = require('text-encoding');

/**
 * Encodes an unicode string into an Uint8Array object as UTF-8
 *
 * @param {String} str String to be encoded
 * @return {Uint8Array} UTF-8 encoded typed array
 */
var encode = exports.encode = function encode(str) {
  return new _textEncoding.TextEncoder('UTF-8').encode(str);
};

var arr2str = function arr2str(arr) {
  return String.fromCharCode.apply(null, arr);
};

/**
 * Decodes a string from Uint8Array to an unicode string using specified encoding
 *
 * @param {Uint8Array} buf Binary data to be decoded
 * @param {String} Binary data is decoded into string using this charset
 * @return {String} Decded string
 */
function decode(buf) {
  var fromCharset = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'utf-8';

  var charsets = [{ charset: normalizeCharset(fromCharset), fatal: false }, { charset: 'utf-8', fatal: true }, { charset: 'iso-8859-15', fatal: false }];

  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = charsets[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _step$value = _step.value,
          charset = _step$value.charset,
          fatal = _step$value.fatal;

      try {
        return new _textEncoding.TextDecoder(charset, { fatal: fatal }).decode(buf);
      } catch (e) {}
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  return arr2str(buf);
}

/**
 * Convert a string from specific encoding to UTF-8 Uint8Array
 *
 * @param {String|Uint8Array} data Data to be encoded
 * @param {String} Source encoding for the string (optional for data of type String)
 * @return {Uint8Array} UTF-8 encoded typed array
 */
var convert = exports.convert = function convert(data, fromCharset) {
  return typeof data === 'string' ? encode(data) : encode(decode(data, fromCharset));
};

function normalizeCharset() {
  var charset = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'utf-8';

  var match = void 0;

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jaGFyc2V0LmpzIl0sIm5hbWVzIjpbImRlY29kZSIsImVuY29kZSIsInN0ciIsImFycjJzdHIiLCJTdHJpbmciLCJmcm9tQ2hhckNvZGUiLCJhcHBseSIsImFyciIsImJ1ZiIsImZyb21DaGFyc2V0IiwiY2hhcnNldHMiLCJjaGFyc2V0Iiwibm9ybWFsaXplQ2hhcnNldCIsImZhdGFsIiwiZSIsImNvbnZlcnQiLCJkYXRhIiwibWF0Y2giXSwibWFwcGluZ3MiOiI7Ozs7OztRQW1CZ0JBLE0sR0FBQUEsTTs7QUFuQmhCOztBQUVBOzs7Ozs7QUFNTyxJQUFNQywwQkFBUyxTQUFUQSxNQUFTO0FBQUEsU0FBTyw4QkFBZ0IsT0FBaEIsRUFBeUJBLE1BQXpCLENBQWdDQyxHQUFoQyxDQUFQO0FBQUEsQ0FBZjs7QUFFUCxJQUFNQyxVQUFVLFNBQVZBLE9BQVU7QUFBQSxTQUFPQyxPQUFPQyxZQUFQLENBQW9CQyxLQUFwQixDQUEwQixJQUExQixFQUFnQ0MsR0FBaEMsQ0FBUDtBQUFBLENBQWhCOztBQUVBOzs7Ozs7O0FBT08sU0FBU1AsTUFBVCxDQUFpQlEsR0FBakIsRUFBNkM7QUFBQSxNQUF2QkMsV0FBdUIsdUVBQVQsT0FBUzs7QUFDbEQsTUFBTUMsV0FBVyxDQUNmLEVBQUVDLFNBQVNDLGlCQUFpQkgsV0FBakIsQ0FBWCxFQUEwQ0ksT0FBTyxLQUFqRCxFQURlLEVBRWYsRUFBRUYsU0FBUyxPQUFYLEVBQW9CRSxPQUFPLElBQTNCLEVBRmUsRUFHZixFQUFFRixTQUFTLGFBQVgsRUFBMEJFLE9BQU8sS0FBakMsRUFIZSxDQUFqQjs7QUFEa0Q7QUFBQTtBQUFBOztBQUFBO0FBT2xELHlCQUErQkgsUUFBL0IsOEhBQXlDO0FBQUE7QUFBQSxVQUE3QkMsT0FBNkIsZUFBN0JBLE9BQTZCO0FBQUEsVUFBcEJFLEtBQW9CLGVBQXBCQSxLQUFvQjs7QUFDdkMsVUFBSTtBQUFFLGVBQU8sOEJBQWdCRixPQUFoQixFQUF5QixFQUFFRSxZQUFGLEVBQXpCLEVBQW9DYixNQUFwQyxDQUEyQ1EsR0FBM0MsQ0FBUDtBQUF3RCxPQUE5RCxDQUErRCxPQUFPTSxDQUFQLEVBQVUsQ0FBRztBQUM3RTtBQVRpRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBOztBQVdsRCxTQUFPWCxRQUFRSyxHQUFSLENBQVA7QUFDRDs7QUFFRDs7Ozs7OztBQU9PLElBQU1PLDRCQUFVLFNBQVZBLE9BQVUsQ0FBQ0MsSUFBRCxFQUFPUCxXQUFQO0FBQUEsU0FBdUIsT0FBT08sSUFBUCxLQUFnQixRQUFoQixHQUEyQmYsT0FBT2UsSUFBUCxDQUEzQixHQUEwQ2YsT0FBT0QsT0FBT2dCLElBQVAsRUFBYVAsV0FBYixDQUFQLENBQWpFO0FBQUEsQ0FBaEI7O0FBRVAsU0FBU0csZ0JBQVQsR0FBOEM7QUFBQSxNQUFuQkQsT0FBbUIsdUVBQVQsT0FBUzs7QUFDNUMsTUFBSU0sY0FBSjs7QUFFQSxNQUFLQSxRQUFRTixRQUFRTSxLQUFSLENBQWMsa0JBQWQsQ0FBYixFQUFpRDtBQUMvQyxXQUFPLFNBQVNBLE1BQU0sQ0FBTixDQUFoQjtBQUNEOztBQUVELE1BQUtBLFFBQVFOLFFBQVFNLEtBQVIsQ0FBYyxrQkFBZCxDQUFiLEVBQWlEO0FBQy9DLFdBQU8sYUFBYUEsTUFBTSxDQUFOLENBQXBCO0FBQ0Q7O0FBRUQsTUFBS0EsUUFBUU4sUUFBUU0sS0FBUixDQUFjLG9CQUFkLENBQWIsRUFBbUQ7QUFDakQsV0FBTyxjQUFjQSxNQUFNLENBQU4sQ0FBckI7QUFDRDs7QUFFRCxTQUFPTixPQUFQO0FBQ0QiLCJmaWxlIjoiY2hhcnNldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRleHREZWNvZGVyLCBUZXh0RW5jb2RlciB9IGZyb20gJ3RleHQtZW5jb2RpbmcnXG5cbi8qKlxuICogRW5jb2RlcyBhbiB1bmljb2RlIHN0cmluZyBpbnRvIGFuIFVpbnQ4QXJyYXkgb2JqZWN0IGFzIFVURi04XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0ciBTdHJpbmcgdG8gYmUgZW5jb2RlZFxuICogQHJldHVybiB7VWludDhBcnJheX0gVVRGLTggZW5jb2RlZCB0eXBlZCBhcnJheVxuICovXG5leHBvcnQgY29uc3QgZW5jb2RlID0gc3RyID0+IG5ldyBUZXh0RW5jb2RlcignVVRGLTgnKS5lbmNvZGUoc3RyKVxuXG5jb25zdCBhcnIyc3RyID0gYXJyID0+IFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYXJyKVxuXG4vKipcbiAqIERlY29kZXMgYSBzdHJpbmcgZnJvbSBVaW50OEFycmF5IHRvIGFuIHVuaWNvZGUgc3RyaW5nIHVzaW5nIHNwZWNpZmllZCBlbmNvZGluZ1xuICpcbiAqIEBwYXJhbSB7VWludDhBcnJheX0gYnVmIEJpbmFyeSBkYXRhIHRvIGJlIGRlY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBCaW5hcnkgZGF0YSBpcyBkZWNvZGVkIGludG8gc3RyaW5nIHVzaW5nIHRoaXMgY2hhcnNldFxuICogQHJldHVybiB7U3RyaW5nfSBEZWNkZWQgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGUgKGJ1ZiwgZnJvbUNoYXJzZXQgPSAndXRmLTgnKSB7XG4gIGNvbnN0IGNoYXJzZXRzID0gW1xuICAgIHsgY2hhcnNldDogbm9ybWFsaXplQ2hhcnNldChmcm9tQ2hhcnNldCksIGZhdGFsOiBmYWxzZSB9LFxuICAgIHsgY2hhcnNldDogJ3V0Zi04JywgZmF0YWw6IHRydWUgfSxcbiAgICB7IGNoYXJzZXQ6ICdpc28tODg1OS0xNScsIGZhdGFsOiBmYWxzZSB9XG4gIF1cblxuICBmb3IgKGNvbnN0IHtjaGFyc2V0LCBmYXRhbH0gb2YgY2hhcnNldHMpIHtcbiAgICB0cnkgeyByZXR1cm4gbmV3IFRleHREZWNvZGVyKGNoYXJzZXQsIHsgZmF0YWwgfSkuZGVjb2RlKGJ1ZikgfSBjYXRjaCAoZSkgeyB9XG4gIH1cblxuICByZXR1cm4gYXJyMnN0cihidWYpXG59XG5cbi8qKlxuICogQ29udmVydCBhIHN0cmluZyBmcm9tIHNwZWNpZmljIGVuY29kaW5nIHRvIFVURi04IFVpbnQ4QXJyYXlcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xVaW50OEFycmF5fSBkYXRhIERhdGEgdG8gYmUgZW5jb2RlZFxuICogQHBhcmFtIHtTdHJpbmd9IFNvdXJjZSBlbmNvZGluZyBmb3IgdGhlIHN0cmluZyAob3B0aW9uYWwgZm9yIGRhdGEgb2YgdHlwZSBTdHJpbmcpXG4gKiBAcmV0dXJuIHtVaW50OEFycmF5fSBVVEYtOCBlbmNvZGVkIHR5cGVkIGFycmF5XG4gKi9cbmV4cG9ydCBjb25zdCBjb252ZXJ0ID0gKGRhdGEsIGZyb21DaGFyc2V0KSA9PiB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBlbmNvZGUoZGF0YSkgOiBlbmNvZGUoZGVjb2RlKGRhdGEsIGZyb21DaGFyc2V0KSlcblxuZnVuY3Rpb24gbm9ybWFsaXplQ2hhcnNldCAoY2hhcnNldCA9ICd1dGYtOCcpIHtcbiAgbGV0IG1hdGNoXG5cbiAgaWYgKChtYXRjaCA9IGNoYXJzZXQubWF0Y2goL151dGZbLV9dPyhcXGQrKSQvaSkpKSB7XG4gICAgcmV0dXJuICdVVEYtJyArIG1hdGNoWzFdXG4gIH1cblxuICBpZiAoKG1hdGNoID0gY2hhcnNldC5tYXRjaCgvXndpblstX10/KFxcZCspJC9pKSkpIHtcbiAgICByZXR1cm4gJ1dJTkRPV1MtJyArIG1hdGNoWzFdXG4gIH1cblxuICBpZiAoKG1hdGNoID0gY2hhcnNldC5tYXRjaCgvXmxhdGluWy1fXT8oXFxkKykkL2kpKSkge1xuICAgIHJldHVybiAnSVNPLTg4NTktJyArIG1hdGNoWzFdXG4gIH1cblxuICByZXR1cm4gY2hhcnNldFxufVxuIl19