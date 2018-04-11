import { TextDecoder, TextEncoder } from 'text-encoding'

/**
 * Encodes an unicode string into an Uint8Array object as UTF-8
 *
 * @param {String} str String to be encoded
 * @return {Uint8Array} UTF-8 encoded typed array
 */
export const encode = str => new TextEncoder('UTF-8').encode(str)

export const arr2str = arr => String.fromCharCode.apply(null, arr)

/**
 * Decodes a string from Uint8Array to an unicode string using specified encoding
 *
 * @param {Uint8Array} buf Binary data to be decoded
 * @param {String} fromCharset Binary data is decoded into string using this charset
 * @return {String} Decoded string
 */
export const decode = (buf, fromCharset = 'utf-8') => decodeStream(buf, fromCharset).result

/**
 * Decodes a string from Uint8Array to an unicode string using specified encoding or specified decoder
 *
 * @param {Uint8Array} buf Binary data to be decoded
 * @param {String} fromCharset Binary data is decoded into string using this charset
 * @param {TextDecoder} decoder Decoder to be used
 * @param {Boolean} stream If true, store undecodable trailing bytes until next call
 * @return {Object} A pair {decoder, result}, this decoder can be used for further streaming calls
 */
export function decodeStream (buf, fromCharset = 'utf-8', decoder, stream) {
  const charsets = [
    { dec: decoder },
    { charset: normalizeCharset(fromCharset), fatal: false },
    { charset: 'utf-8', fatal: true },
    { charset: 'iso-8859-15', fatal: false }
  ]

  for (let {dec, charset, fatal} of charsets) {
    if (!dec && !charset) {
      continue
    }
    try {
      dec = dec || new TextDecoder(charset, { fatal })
      const result = dec.decode(buf, { stream })
      return { decoder: dec, result }
    } catch (e) { }
  }

  return { result: arr2str(buf) } // all else fails, treat it as binary
}

/**
 * Convert a string from specific encoding to UTF-8 Uint8Array
 *
 * @param {String|Uint8Array} data Data to be encoded
 * @param {String} Source encoding for the string (optional for data of type String)
 * @return {Uint8Array} UTF-8 encoded typed array
 */
export const convert = (data, fromCharset) => typeof data === 'string' ? encode(data) : encode(decode(data, fromCharset))

function normalizeCharset (charset = 'utf-8') {
  let match

  if ((match = charset.match(/^utf[-_]?(\d+)$/i))) {
    return 'UTF-' + match[1]
  }

  if ((match = charset.match(/^win[-_]?(\d+)$/i))) {
    return 'WINDOWS-' + match[1]
  }

  if ((match = charset.match(/^latin[-_]?(\d+)$/i))) {
    return 'ISO-8859-' + match[1]
  }

  return charset
}
