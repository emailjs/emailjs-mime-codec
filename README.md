# MIME Functions

`mimefuncs` allows you to encode and decode between different MIME related encodings. Quoted-Printable, Base64 etc.

All input can use any charset (in this case, the value must not be a string but an arraybuffer of Uint8Array) but output is always unicode.

**NB!** `mimefuncs` uses the following functions that might not be available on every browser: `ArrayBuffer`, `Uint8Array`, `TextEncoder`, `TextDecoder`. Most probably you can't use this module outside Firefox.

## Usage

### Volo

Install with [volo](http://volojs.org/):

    volo add Kreata/mimefuncs/v0.1.3

### AMD

Require [mimefuncs.js](mimefuncs.js) as `mimefuncs`

### Global context

Include file [mimefuncs.js](mimefuncs.js) on the page.

```html
<script src="mimefuncs.js"></script>
```

This exposes global variable `mimefuncs`

## Methods

### foldLines

Folds a long line according to the RFC 5322 <http://tools.ietf.org/html/rfc5322#section-2.1.1>

    mimefuncs.foldLines(str [, lineLengthMax[, afterSpace]]) -> String

  * **str** - String to be folded
  * **lineLengthMax** - Maximum length of a line (defaults to 76)
  * **afterSpace** - If true, leave a space in th end of a line

For example:

    mimefuncs.foldLines("Content-Type: multipart/alternative; boundary=\"----zzzz----\"")

results in

    Content-Type: multipart/alternative;
         boundary="----zzzz----"

### mimeWordEncode

Encodes a string into mime encoded word format <http://en.wikipedia.org/wiki/MIME#Encoded-Word>  (see also `mimeWordDecode`)

    mimefuncs.mimeWordEncode(str [, mimeWordEncoding[, maxLength[, fromCharset]]]) -> String

  * **str** - String or ArrayBuffer (Uint8Array) to be encoded
  * **mimeWordEncoding** - Encoding for the mime word, either Q or B (default is "Q")
  * **maxLength** - If set, split mime words into several chunks if needed
  * **fromCharset** - If the first parameter is an arraybuffer, use this encoding to decode the value to unicode

For example:

    mimefuncs.mimeWordEncode("See on õhin test", "Q");

Becomes with UTF-8 and Quoted-printable encoding

    =?UTF-8?Q?See_on_=C3=B5hin_test?=

### mimeWordDecode

Decodes a string from mime encoded word format (see also `mimeWordEncode`)

    mimefuncs.mimeWordDecode(str) -> String

  * **str** - String to be decoded

For example

    mimefuncs.mimeWordDecode("=?UTF-8?Q?See_on_=C3=B5hin_test?=");

will become

    See on õhin test

### quotedPrintableEncode

Encodes a string into Quoted-printable format (see also `quotedPrintableDecode`). Maximum line
length for the generated string is 76 + 2 bytes.

    mimefuncs.quotedPrintableEncode(str [, fromCharset]) -> String

  * **str** - String or an arraybuffer to mime encode
  * **fromCharset** - If the first parameter is an arraybuffer, use this charset to decode the value to unicode before encoding

### quotedPrintableDecode

Decodes a string from Quoted-printable format  (see also `quotedPrintableEncode`).

    mimefuncs.quotedPrintableDecode(str [, fromCharset]) -> String

  * **str** - Mime encoded string
  * **fromCharset** - Use this charset to decode mime encoded string to unicode

### base64Encode

Encodes a string into Base64 format (see also `base64Decode`). Maximum line
length for the generated string is 76 + 2 bytes.

    mimefuncs.base64Encode(str [, fromCharset]) -> String

  * **str** - String or an arraybuffer to base64 encode
  * **fromCharset** - If the first parameter is an arraybuffer, use this charset to decode the value to unicode before encoding

### base64Decode

Decodes a string from Base64 format (see also `base64Encode`) to an unencoded unicode string.

    mimefuncs.base64Decode(str [, fromCharset]) -> String

  * **str** Base64 encoded string
  * **fromCharset** Use this charset to decode base64 encoded string to unicode

### base64.decode

Decodes a string from Base64 format to an ArrayBuffer.

    mimefuncs.base64.decode(str) -> ArrayBuffer

  * **str** Base64 encoded string

### mimeWordEncode

Encodes a string to a mime word.

    mimefuncs.mimeWordEncode(str[, mimeWordEncoding[, maxLength[, fromCharset]]]) -> String

  * **str** - String or arraybuffer to be encoded
  * **mimeWordEncoding** - Encoding for the mime word, either Q or B (default is "Q")
  * **maxLength** - If set, split mime words into several chunks if needed
  * **fromCharset** - If the first parameter is an arraybuffer, use this charset to decode the value to unicode before encoding

### mimeWordsEncode

Encodes non ascii sequences in a string to mime words.

    mimefuncs.mimeWordsEncode(str[, mimeWordEncoding[, maxLength[, fromCharset]]]) -> String

  * **str** - String or arraybuffer to be encoded
  * **mimeWordEncoding** - Encoding for the mime word, either Q or B (default is "Q")
  * **maxLength** - If set, split mime words into several chunks if needed
  * **fromCharset** - If the first parameter is an arraybuffer, use this charset to decode the value to unicode before encoding

### mimeWordDecode

Decodes a complete mime word encoded string

    mimefuncs.mimeWordDecode(str) -> String

  * **str** - String to be decoded. Mime words have charset information included so need to specify it here

### mimeWordsDecode

Decodes a string that might include one or several mime words. If no mime words are found from the string, the original string is returned

    mimefuncs.mimeWordsDecode(str) -> String

  * **str** - String to be decoded

### headerLineEncode

Encodes and folds a header line for a MIME message header. Shorthand for `mimeWordsEncode` + `foldLines`.

    mimefuncs.headerLineEncode(key, value[, fromCharset])

  * **key** - Key name, will not be encoded
  * **value** - Value to be encoded
  * **fromCharset** - If the `value` parameter is an arraybuffer, use this charset to decode the value to unicode before encoding

### headerLineDecode

Unfolds a header line and splits it to key and value pair. The return value is in the form of `{key: "subject", value: "test"}`. The value is not mime word decoded, you need to do your own decoding based on the rules for the specific header key.

    mimefuncs.headerLineDecode(headerLine) -> Object

  * **headerLine** - Single header line, might include linebreaks as well if folded

### headerLinesDecode

Parses a block of header lines. Does not decode mime words as every header
might have its own rules (eg. formatted email addresses and such).

Return value is an object of headers, where header keys are object keys. NB! Several values with the same key make up an array of values for the same key.

    mimefuncs.headerLinesDecode(headers) -> Object

  * **headers** - Headers string

### fromArrayBuffer

Converts an `ArrayBuffer` or `Uint8Array` value to "binary" string.

    mimefuncs.fromArrayBuffer(arrayBuffer) -> String

  * **arrayBuffer** - an `ArrayBuffer` or `Uint8Array` value

### parseHeaderValue

Parses a header value with `key=value` arguments into a structured object. Useful when dealing with
`content-type` and such.

    parseHeaderValue(valueString) -> Object

  * **valueString** - a header value without the key

Example

```javascript
parseHeaderValue('content-type: text/plain; CHARSET="UTF-8"');
```

Outputs

```json
{
    "value": "text/plain",
    "params": {
        "charset": "UTF-8"
    }
}
```

## Tests

Download `mimefuncs` source and install dependencies

```bash
git clone git@github.com:Kreata/mimefuncs.git
cd mimefuncs
volo install
```

Tests are handled by QUnit. Open [testrunner.html](tests/testrunner.html) to run the tests.

## License

**MIT**
