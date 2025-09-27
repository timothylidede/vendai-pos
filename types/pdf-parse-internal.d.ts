declare module 'pdf-parse/lib/pdf-parse.js' {
  const fn: (buf: Buffer | Uint8Array) => Promise<{ text: string }>
  export = fn
}
