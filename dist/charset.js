'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convert = exports.arr2str = exports.encode = undefined;
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

var arr2str = exports.arr2str = function arr2str(arr) {
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

  return arr2str(buf); // all else fails, treat it as binary
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jaGFyc2V0LmpzIl0sIm5hbWVzIjpbImRlY29kZSIsImVuY29kZSIsIlRleHRFbmNvZGVyIiwic3RyIiwiYXJyMnN0ciIsIkNIVU5LX1NaIiwic3RycyIsImkiLCJhcnIiLCJsZW5ndGgiLCJwdXNoIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiYXBwbHkiLCJzdWJhcnJheSIsImpvaW4iLCJidWYiLCJmcm9tQ2hhcnNldCIsImNoYXJzZXRzIiwiY2hhcnNldCIsIm5vcm1hbGl6ZUNoYXJzZXQiLCJmYXRhbCIsIlRleHREZWNvZGVyIiwiZSIsImNvbnZlcnQiLCJkYXRhIiwibWF0Y2giXSwibWFwcGluZ3MiOiI7Ozs7OztRQTRCZ0JBLE0sR0FBQUEsTTs7QUE1QmhCOztBQUVBOzs7Ozs7QUFNTyxJQUFNQywwQkFBUyxTQUFUQSxNQUFTO0FBQUEsU0FBTyxJQUFJQyx5QkFBSixDQUFnQixPQUFoQixFQUF5QkQsTUFBekIsQ0FBZ0NFLEdBQWhDLENBQVA7QUFBQSxDQUFmOztBQUVBLElBQU1DLDRCQUFVLFNBQVZBLE9BQVUsTUFBTztBQUM1QixNQUFNQyxXQUFXLE1BQWpCO0FBQ0EsTUFBTUMsT0FBTyxFQUFiOztBQUVBLE9BQUssSUFBSUMsSUFBSSxDQUFiLEVBQWdCQSxJQUFJQyxJQUFJQyxNQUF4QixFQUFnQ0YsS0FBS0YsUUFBckMsRUFBK0M7QUFDN0NDLFNBQUtJLElBQUwsQ0FBVUMsT0FBT0MsWUFBUCxDQUFvQkMsS0FBcEIsQ0FBMEIsSUFBMUIsRUFBZ0NMLElBQUlNLFFBQUosQ0FBYVAsQ0FBYixFQUFnQkEsSUFBSUYsUUFBcEIsQ0FBaEMsQ0FBVjtBQUNEOztBQUVELFNBQU9DLEtBQUtTLElBQUwsQ0FBVSxFQUFWLENBQVA7QUFDRCxDQVRNOztBQVdQOzs7Ozs7O0FBT08sU0FBU2YsTUFBVCxDQUFpQmdCLEdBQWpCLEVBQTZDO0FBQUEsTUFBdkJDLFdBQXVCLHVFQUFULE9BQVM7O0FBQ2xELE1BQU1DLFdBQVcsQ0FDZixFQUFFQyxTQUFTQyxpQkFBaUJILFdBQWpCLENBQVgsRUFBMENJLE9BQU8sS0FBakQsRUFEZSxFQUVmLEVBQUVGLFNBQVMsT0FBWCxFQUFvQkUsT0FBTyxJQUEzQixFQUZlLEVBR2YsRUFBRUYsU0FBUyxhQUFYLEVBQTBCRSxPQUFPLEtBQWpDLEVBSGUsQ0FBakI7O0FBRGtEO0FBQUE7QUFBQTs7QUFBQTtBQU9sRCx5QkFBaUNILFFBQWpDLDhIQUEyQztBQUFBO0FBQUEsVUFBOUJDLE9BQThCLGVBQTlCQSxPQUE4QjtBQUFBLFVBQXJCRSxLQUFxQixlQUFyQkEsS0FBcUI7O0FBQ3pDLFVBQUk7QUFBRSxlQUFPLElBQUlDLHlCQUFKLENBQWdCSCxPQUFoQixFQUF5QixFQUFFRSxZQUFGLEVBQXpCLEVBQW9DckIsTUFBcEMsQ0FBMkNnQixHQUEzQyxDQUFQO0FBQXdELE9BQTlELENBQStELE9BQU9PLENBQVAsRUFBVSxDQUFHO0FBQzdFO0FBVGlEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7O0FBV2xELFNBQU9uQixRQUFRWSxHQUFSLENBQVAsQ0FYa0QsQ0FXOUI7QUFDckI7O0FBRUQ7Ozs7Ozs7QUFPTyxJQUFNUSw0QkFBVSxTQUFWQSxPQUFVLENBQUNDLElBQUQsRUFBT1IsV0FBUDtBQUFBLFNBQXVCLE9BQU9RLElBQVAsS0FBZ0IsUUFBaEIsR0FBMkJ4QixPQUFPd0IsSUFBUCxDQUEzQixHQUEwQ3hCLE9BQU9ELE9BQU95QixJQUFQLEVBQWFSLFdBQWIsQ0FBUCxDQUFqRTtBQUFBLENBQWhCOztBQUVQLFNBQVNHLGdCQUFULEdBQThDO0FBQUEsTUFBbkJELE9BQW1CLHVFQUFULE9BQVM7O0FBQzVDLE1BQUlPLGNBQUo7O0FBRUEsTUFBS0EsUUFBUVAsUUFBUU8sS0FBUixDQUFjLGtCQUFkLENBQWIsRUFBaUQ7QUFDL0MsV0FBTyxTQUFTQSxNQUFNLENBQU4sQ0FBaEI7QUFDRDs7QUFFRCxNQUFLQSxRQUFRUCxRQUFRTyxLQUFSLENBQWMsa0JBQWQsQ0FBYixFQUFpRDtBQUMvQyxXQUFPLGFBQWFBLE1BQU0sQ0FBTixDQUFwQjtBQUNEOztBQUVELE1BQUtBLFFBQVFQLFFBQVFPLEtBQVIsQ0FBYyxvQkFBZCxDQUFiLEVBQW1EO0FBQ2pELFdBQU8sY0FBY0EsTUFBTSxDQUFOLENBQXJCO0FBQ0Q7O0FBRUQsU0FBT1AsT0FBUDtBQUNEIiwiZmlsZSI6ImNoYXJzZXQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBUZXh0RGVjb2RlciwgVGV4dEVuY29kZXIgfSBmcm9tICd0ZXh0LWVuY29kaW5nJ1xyXG5cclxuLyoqXHJcbiAqIEVuY29kZXMgYW4gdW5pY29kZSBzdHJpbmcgaW50byBhbiBVaW50OEFycmF5IG9iamVjdCBhcyBVVEYtOFxyXG4gKlxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIFN0cmluZyB0byBiZSBlbmNvZGVkXHJcbiAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IFVURi04IGVuY29kZWQgdHlwZWQgYXJyYXlcclxuICovXHJcbmV4cG9ydCBjb25zdCBlbmNvZGUgPSBzdHIgPT4gbmV3IFRleHRFbmNvZGVyKCdVVEYtOCcpLmVuY29kZShzdHIpXHJcblxyXG5leHBvcnQgY29uc3QgYXJyMnN0ciA9IGFyciA9PiB7XHJcbiAgY29uc3QgQ0hVTktfU1ogPSAweDgwMDBcclxuICBjb25zdCBzdHJzID0gW11cclxuXHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpICs9IENIVU5LX1NaKSB7XHJcbiAgICBzdHJzLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBhcnIuc3ViYXJyYXkoaSwgaSArIENIVU5LX1NaKSkpXHJcbiAgfVxyXG5cclxuICByZXR1cm4gc3Rycy5qb2luKCcnKVxyXG59XHJcblxyXG4vKipcclxuICogRGVjb2RlcyBhIHN0cmluZyBmcm9tIFVpbnQ4QXJyYXkgdG8gYW4gdW5pY29kZSBzdHJpbmcgdXNpbmcgc3BlY2lmaWVkIGVuY29kaW5nXHJcbiAqXHJcbiAqIEBwYXJhbSB7VWludDhBcnJheX0gYnVmIEJpbmFyeSBkYXRhIHRvIGJlIGRlY29kZWRcclxuICogQHBhcmFtIHtTdHJpbmd9IEJpbmFyeSBkYXRhIGlzIGRlY29kZWQgaW50byBzdHJpbmcgdXNpbmcgdGhpcyBjaGFyc2V0XHJcbiAqIEByZXR1cm4ge1N0cmluZ30gRGVjb2RlZCBzdHJpbmdcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGUgKGJ1ZiwgZnJvbUNoYXJzZXQgPSAndXRmLTgnKSB7XHJcbiAgY29uc3QgY2hhcnNldHMgPSBbXHJcbiAgICB7IGNoYXJzZXQ6IG5vcm1hbGl6ZUNoYXJzZXQoZnJvbUNoYXJzZXQpLCBmYXRhbDogZmFsc2UgfSxcclxuICAgIHsgY2hhcnNldDogJ3V0Zi04JywgZmF0YWw6IHRydWUgfSxcclxuICAgIHsgY2hhcnNldDogJ2lzby04ODU5LTE1JywgZmF0YWw6IGZhbHNlIH1cclxuICBdXHJcblxyXG4gIGZvciAoY29uc3QgeyBjaGFyc2V0LCBmYXRhbCB9IG9mIGNoYXJzZXRzKSB7XHJcbiAgICB0cnkgeyByZXR1cm4gbmV3IFRleHREZWNvZGVyKGNoYXJzZXQsIHsgZmF0YWwgfSkuZGVjb2RlKGJ1ZikgfSBjYXRjaCAoZSkgeyB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gYXJyMnN0cihidWYpIC8vIGFsbCBlbHNlIGZhaWxzLCB0cmVhdCBpdCBhcyBiaW5hcnlcclxufVxyXG5cclxuLyoqXHJcbiAqIENvbnZlcnQgYSBzdHJpbmcgZnJvbSBzcGVjaWZpYyBlbmNvZGluZyB0byBVVEYtOCBVaW50OEFycmF5XHJcbiAqXHJcbiAqIEBwYXJhbSB7U3RyaW5nfFVpbnQ4QXJyYXl9IGRhdGEgRGF0YSB0byBiZSBlbmNvZGVkXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBTb3VyY2UgZW5jb2RpbmcgZm9yIHRoZSBzdHJpbmcgKG9wdGlvbmFsIGZvciBkYXRhIG9mIHR5cGUgU3RyaW5nKVxyXG4gKiBAcmV0dXJuIHtVaW50OEFycmF5fSBVVEYtOCBlbmNvZGVkIHR5cGVkIGFycmF5XHJcbiAqL1xyXG5leHBvcnQgY29uc3QgY29udmVydCA9IChkYXRhLCBmcm9tQ2hhcnNldCkgPT4gdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnID8gZW5jb2RlKGRhdGEpIDogZW5jb2RlKGRlY29kZShkYXRhLCBmcm9tQ2hhcnNldCkpXHJcblxyXG5mdW5jdGlvbiBub3JtYWxpemVDaGFyc2V0IChjaGFyc2V0ID0gJ3V0Zi04Jykge1xyXG4gIGxldCBtYXRjaFxyXG5cclxuICBpZiAoKG1hdGNoID0gY2hhcnNldC5tYXRjaCgvXnV0ZlstX10/KFxcZCspJC9pKSkpIHtcclxuICAgIHJldHVybiAnVVRGLScgKyBtYXRjaFsxXVxyXG4gIH1cclxuXHJcbiAgaWYgKChtYXRjaCA9IGNoYXJzZXQubWF0Y2goL153aW5bLV9dPyhcXGQrKSQvaSkpKSB7XHJcbiAgICByZXR1cm4gJ1dJTkRPV1MtJyArIG1hdGNoWzFdXHJcbiAgfVxyXG5cclxuICBpZiAoKG1hdGNoID0gY2hhcnNldC5tYXRjaCgvXmxhdGluWy1fXT8oXFxkKykkL2kpKSkge1xyXG4gICAgcmV0dXJuICdJU08tODg1OS0nICsgbWF0Y2hbMV1cclxuICB9XHJcblxyXG4gIHJldHVybiBjaGFyc2V0XHJcbn1cclxuIl19