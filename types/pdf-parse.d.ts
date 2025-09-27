declare module 'pdf-parse' {
  interface PDFInfo {
    numpages: number
    numrender: number
    info: Record<string, any>
    metadata?: any
    version?: string
    text: string
  }
  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: Record<string, any>): Promise<PDFInfo>
  export = pdfParse
}
