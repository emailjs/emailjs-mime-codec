import { splitTypedArrayEvery } from './utils'

describe('groupsOfTypedArray', () => {
  it('should not slice shorter array', () => {
    expect(splitTypedArrayEvery(3, Uint8Array.from([1, 2]))).to.deep.equal([Uint8Array.from([1, 2])])
  })
  it('should slice array', () => {
    const res = splitTypedArrayEvery(3, Uint8Array.from([1, 2, 3, 4, 5]))
    expect(res).to.deep.equal([Uint8Array.from([1, 2, 3]), Uint8Array.from([4, 5])])
  })
})
