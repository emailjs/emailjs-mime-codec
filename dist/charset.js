'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convert = exports.encode = undefined;
exports.decode = decode;

var _textEncoding = require('text-encoding');

var _mimecodec = require('./mimecodec');

/**
 * Encodes an unicode string into an Uint8Array object as UTF-8
 *
 * @param {String} str String to be encoded
 * @return {Uint8Array} UTF-8 encoded typed array
 */
var encode = exports.encode = function encode(str) {
  return new _textEncoding.TextEncoder('UTF-8').encode(str);
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

  var charsets = [{ charset: normalizeCharset(fromCharset), fatal: true }, { charset: 'utf-8', fatal: true }, { charset: 'iso-8859-15', fatal: false }];

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

  return (0, _mimecodec.fromTypedArray)(buf);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jaGFyc2V0LmpzIl0sIm5hbWVzIjpbImRlY29kZSIsImVuY29kZSIsInN0ciIsImJ1ZiIsImZyb21DaGFyc2V0IiwiY2hhcnNldHMiLCJjaGFyc2V0Iiwibm9ybWFsaXplQ2hhcnNldCIsImZhdGFsIiwiZSIsImNvbnZlcnQiLCJkYXRhIiwibWF0Y2giXSwibWFwcGluZ3MiOiI7Ozs7OztRQWtCZ0JBLE0sR0FBQUEsTTs7QUFsQmhCOztBQUNBOztBQUVBOzs7Ozs7QUFNTyxJQUFNQywwQkFBUyxTQUFUQSxNQUFTO0FBQUEsU0FBTyw4QkFBZ0IsT0FBaEIsRUFBeUJBLE1BQXpCLENBQWdDQyxHQUFoQyxDQUFQO0FBQUEsQ0FBZjs7QUFFUDs7Ozs7OztBQU9PLFNBQVNGLE1BQVQsQ0FBaUJHLEdBQWpCLEVBQTZDO0FBQUEsTUFBdkJDLFdBQXVCLHVFQUFULE9BQVM7O0FBQ2xELE1BQU1DLFdBQVcsQ0FDZixFQUFFQyxTQUFTQyxpQkFBaUJILFdBQWpCLENBQVgsRUFBMENJLE9BQU8sSUFBakQsRUFEZSxFQUVmLEVBQUVGLFNBQVMsT0FBWCxFQUFvQkUsT0FBTyxJQUEzQixFQUZlLEVBR2YsRUFBRUYsU0FBUyxhQUFYLEVBQTBCRSxPQUFPLEtBQWpDLEVBSGUsQ0FBakI7O0FBRGtEO0FBQUE7QUFBQTs7QUFBQTtBQU9sRCx5QkFBK0JILFFBQS9CLDhIQUF5QztBQUFBO0FBQUEsVUFBN0JDLE9BQTZCLGVBQTdCQSxPQUE2QjtBQUFBLFVBQXBCRSxLQUFvQixlQUFwQkEsS0FBb0I7O0FBQ3ZDLFVBQUk7QUFBRSxlQUFPLDhCQUFnQkYsT0FBaEIsRUFBeUIsRUFBRUUsWUFBRixFQUF6QixFQUFvQ1IsTUFBcEMsQ0FBMkNHLEdBQTNDLENBQVA7QUFBd0QsT0FBOUQsQ0FBK0QsT0FBT00sQ0FBUCxFQUFVLENBQUc7QUFDN0U7QUFUaUQ7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7QUFXbEQsU0FBTywrQkFBZU4sR0FBZixDQUFQO0FBQ0Q7O0FBRUQ7Ozs7Ozs7QUFPTyxJQUFNTyw0QkFBVSxTQUFWQSxPQUFVLENBQUNDLElBQUQsRUFBT1AsV0FBUDtBQUFBLFNBQXVCLE9BQU9PLElBQVAsS0FBZ0IsUUFBaEIsR0FBMkJWLE9BQU9VLElBQVAsQ0FBM0IsR0FBMENWLE9BQU9ELE9BQU9XLElBQVAsRUFBYVAsV0FBYixDQUFQLENBQWpFO0FBQUEsQ0FBaEI7O0FBRVAsU0FBU0csZ0JBQVQsR0FBOEM7QUFBQSxNQUFuQkQsT0FBbUIsdUVBQVQsT0FBUzs7QUFDNUMsTUFBSU0sY0FBSjs7QUFFQSxNQUFLQSxRQUFRTixRQUFRTSxLQUFSLENBQWMsa0JBQWQsQ0FBYixFQUFpRDtBQUMvQyxXQUFPLFNBQVNBLE1BQU0sQ0FBTixDQUFoQjtBQUNEOztBQUVELE1BQUtBLFFBQVFOLFFBQVFNLEtBQVIsQ0FBYyxrQkFBZCxDQUFiLEVBQWlEO0FBQy9DLFdBQU8sYUFBYUEsTUFBTSxDQUFOLENBQXBCO0FBQ0Q7O0FBRUQsTUFBS0EsUUFBUU4sUUFBUU0sS0FBUixDQUFjLG9CQUFkLENBQWIsRUFBbUQ7QUFDakQsV0FBTyxjQUFjQSxNQUFNLENBQU4sQ0FBckI7QUFDRDs7QUFFRCxTQUFPTixPQUFQO0FBQ0QiLCJmaWxlIjoiY2hhcnNldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFRleHREZWNvZGVyLCBUZXh0RW5jb2RlciB9IGZyb20gJ3RleHQtZW5jb2RpbmcnXG5pbXBvcnQgeyBmcm9tVHlwZWRBcnJheSB9IGZyb20gJy4vbWltZWNvZGVjJ1xuXG4vKipcbiAqIEVuY29kZXMgYW4gdW5pY29kZSBzdHJpbmcgaW50byBhbiBVaW50OEFycmF5IG9iamVjdCBhcyBVVEYtOFxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgU3RyaW5nIHRvIGJlIGVuY29kZWRcbiAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IFVURi04IGVuY29kZWQgdHlwZWQgYXJyYXlcbiAqL1xuZXhwb3J0IGNvbnN0IGVuY29kZSA9IHN0ciA9PiBuZXcgVGV4dEVuY29kZXIoJ1VURi04JykuZW5jb2RlKHN0cilcblxuLyoqXG4gKiBEZWNvZGVzIGEgc3RyaW5nIGZyb20gVWludDhBcnJheSB0byBhbiB1bmljb2RlIHN0cmluZyB1c2luZyBzcGVjaWZpZWQgZW5jb2RpbmdcbiAqXG4gKiBAcGFyYW0ge1VpbnQ4QXJyYXl9IGJ1ZiBCaW5hcnkgZGF0YSB0byBiZSBkZWNvZGVkXG4gKiBAcGFyYW0ge1N0cmluZ30gQmluYXJ5IGRhdGEgaXMgZGVjb2RlZCBpbnRvIHN0cmluZyB1c2luZyB0aGlzIGNoYXJzZXRcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjZGVkIHN0cmluZ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZGVjb2RlIChidWYsIGZyb21DaGFyc2V0ID0gJ3V0Zi04Jykge1xuICBjb25zdCBjaGFyc2V0cyA9IFtcbiAgICB7IGNoYXJzZXQ6IG5vcm1hbGl6ZUNoYXJzZXQoZnJvbUNoYXJzZXQpLCBmYXRhbDogdHJ1ZSB9LFxuICAgIHsgY2hhcnNldDogJ3V0Zi04JywgZmF0YWw6IHRydWUgfSxcbiAgICB7IGNoYXJzZXQ6ICdpc28tODg1OS0xNScsIGZhdGFsOiBmYWxzZSB9XG4gIF1cblxuICBmb3IgKGNvbnN0IHtjaGFyc2V0LCBmYXRhbH0gb2YgY2hhcnNldHMpIHtcbiAgICB0cnkgeyByZXR1cm4gbmV3IFRleHREZWNvZGVyKGNoYXJzZXQsIHsgZmF0YWwgfSkuZGVjb2RlKGJ1ZikgfSBjYXRjaCAoZSkgeyB9XG4gIH1cblxuICByZXR1cm4gZnJvbVR5cGVkQXJyYXkoYnVmKVxufVxuXG4vKipcbiAqIENvbnZlcnQgYSBzdHJpbmcgZnJvbSBzcGVjaWZpYyBlbmNvZGluZyB0byBVVEYtOCBVaW50OEFycmF5XG4gKlxuICogQHBhcmFtIHtTdHJpbmd8VWludDhBcnJheX0gZGF0YSBEYXRhIHRvIGJlIGVuY29kZWRcbiAqIEBwYXJhbSB7U3RyaW5nfSBTb3VyY2UgZW5jb2RpbmcgZm9yIHRoZSBzdHJpbmcgKG9wdGlvbmFsIGZvciBkYXRhIG9mIHR5cGUgU3RyaW5nKVxuICogQHJldHVybiB7VWludDhBcnJheX0gVVRGLTggZW5jb2RlZCB0eXBlZCBhcnJheVxuICovXG5leHBvcnQgY29uc3QgY29udmVydCA9IChkYXRhLCBmcm9tQ2hhcnNldCkgPT4gdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnID8gZW5jb2RlKGRhdGEpIDogZW5jb2RlKGRlY29kZShkYXRhLCBmcm9tQ2hhcnNldCkpXG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZUNoYXJzZXQgKGNoYXJzZXQgPSAndXRmLTgnKSB7XG4gIGxldCBtYXRjaFxuXG4gIGlmICgobWF0Y2ggPSBjaGFyc2V0Lm1hdGNoKC9edXRmWy1fXT8oXFxkKykkL2kpKSkge1xuICAgIHJldHVybiAnVVRGLScgKyBtYXRjaFsxXVxuICB9XG5cbiAgaWYgKChtYXRjaCA9IGNoYXJzZXQubWF0Y2goL153aW5bLV9dPyhcXGQrKSQvaSkpKSB7XG4gICAgcmV0dXJuICdXSU5ET1dTLScgKyBtYXRjaFsxXVxuICB9XG5cbiAgaWYgKChtYXRjaCA9IGNoYXJzZXQubWF0Y2goL15sYXRpblstX10/KFxcZCspJC9pKSkpIHtcbiAgICByZXR1cm4gJ0lTTy04ODU5LScgKyBtYXRjaFsxXVxuICB9XG5cbiAgcmV0dXJuIGNoYXJzZXRcbn1cbiJdfQ==