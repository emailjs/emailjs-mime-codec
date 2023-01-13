import { expect } from 'chai'
import { encode, decode, convert } from './charset'

describe('#charset', function () {
  describe('#encode', function () {
    it('should encode UTF-8 to ArrayBuffer', function () {
      const str = '신'
      const encoded = new Uint8Array([0xec, 0x8b, 0xa0])

      expect(encode(str)).to.deep.equal(encoded)
    })
  })

  describe('#decode', function () {
    it('should decode utf-8 arraybuffer', function () {
      const str = '신'
      const encoded = new Uint8Array([0xec, 0x8b, 0xa0])

      expect(decode(encoded)).to.deep.equal(str)
    })

    it('should decode non utf-8 arraybuffer', function () {
      const str = '신'
      const encoding = 'ks_c_5601-1987'
      const encoded = new Uint8Array([0xbd, 0xc5])

      expect(decode(encoded, encoding)).to.deep.equal(str)
    })

    describe('Missing and unknown charsets', function () {
      it('should detect utf-8', function () {
        const str = '신'
        const encoded = new Uint8Array([0xec, 0x8b, 0xa0])
        const encoding = 'x-illegal'
        expect(decode(encoded, encoding)).to.deep.equal(str)
      })

      it('should fall back to latin_15 conversion for illegal charset', function () {
        const str = 'a1Šÿ'
        const encoded = new Uint8Array([0x61, 0x31, 0xa6, 0xff])
        const encoding = 'x-illegal'
        expect(decode(encoded, encoding)).to.deep.equal(str)
      })
    })
  })

  describe('#convert', function () {
    it('should convert non utf-8 to arraybuffer', function () {
      const converted = new Uint8Array([0xec, 0x8b, 0xa0])
      const encoding = 'ks_c_5601-1987'
      const encoded = new Uint8Array([0xbd, 0xc5])

      expect(convert(encoded, encoding)).to.deep.equal(converted)
    })
  })
})
