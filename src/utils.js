import {
  splitEvery,
  map,
  pipe
} from 'ramda'

export function splitTypedArrayEvery (n, arr) {
  return pipe(
    Array.from,
    splitEvery(n),
    map(x => Uint8Array.from(x))
  )(arr)
}
