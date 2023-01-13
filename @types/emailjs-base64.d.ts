declare module 'emailjs-base64' {
  export function encode(input: string | Uint8Array): string
  export function decode(input: string, option: string): Uint8Array
  export const OUTPUT_TYPED_ARRAY: string
}
