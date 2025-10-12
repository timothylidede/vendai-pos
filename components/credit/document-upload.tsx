'use client'

import { useState } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '@/lib/firebase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, File, X, CheckCircle, AlertCircle } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export interface DocumentFile {
  file: File
  url: string | null
  uploadProgress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

export interface DocumentUploadProps {
  organizationId: string
  retailerId: string
  documentType: 'kraPin' | 'businessCertificate' | 'ownerId' | 'bankStatement' | 'proofOfAddress'
  label: string
  description?: string
  required?: boolean
  maxSizeMB?: number
  acceptedFormats?: string[]
  onUploadComplete?: (url: string) => void
  onUploadError?: (error: string) => void
}

// ============================================================================
// Document Upload Component
// ============================================================================

export function DocumentUpload({
  organizationId,
  retailerId,
  documentType,
  label,
  description,
  required = false,
  maxSizeMB = 5,
  acceptedFormats = ['.pdf', '.jpg', '.jpeg', '.png'],
  onUploadComplete,
  onUploadError,
}: DocumentUploadProps) {
  const [document, setDocument] = useState<DocumentFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // ============================================================================
  // File Selection
  // ============================================================================

  function handleFileSelect(file: File) {
    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      const error = `File size exceeds ${maxSizeMB}MB limit`
      onUploadError?.(error)
      alert(error)
      return
    }

    // Validate file format
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!acceptedFormats.includes(fileExtension)) {
      const error = `Invalid file format. Accepted: ${acceptedFormats.join(', ')}`
      onUploadError?.(error)
      alert(error)
      return
    }

    // Create document object
    const newDocument: DocumentFile = {
      file,
      url: null,
      uploadProgress: 0,
      status: 'pending',
    }

    setDocument(newDocument)

    // Auto-upload
    uploadDocument(newDocument)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  // ============================================================================
  // Upload to Firebase Storage
  // ============================================================================

  async function uploadDocument(doc: DocumentFile) {
    setDocument((prev) => (prev ? { ...prev, status: 'uploading' } : null))

    if (!storage) {
      const errorMessage = 'Storage not initialized'
      setDocument((prev) =>
        prev ? { ...prev, status: 'error', error: errorMessage } : null
      )
      onUploadError?.(errorMessage)
      return
    }

    try {
      // Create storage path
      const timestamp = Date.now()
      const fileName = `${documentType}_${timestamp}_${doc.file.name}`
      const storagePath = `organizations/${organizationId}/credit-documents/${retailerId}/${fileName}`
      const storageRef = ref(storage, storagePath)

      // Upload file
      const uploadTask = uploadBytesResumable(storageRef, doc.file)

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setDocument((prev) => (prev ? { ...prev, uploadProgress: progress } : null))
        },
        (error) => {
          // Error
          console.error('Upload error:', error)
          const errorMessage = error.message || 'Upload failed'
          setDocument((prev) =>
            prev
              ? { ...prev, status: 'error', error: errorMessage }
              : null
          )
          onUploadError?.(errorMessage)
        },
        async () => {
          // Success
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setDocument((prev) =>
            prev
              ? { ...prev, status: 'completed', url: downloadURL, uploadProgress: 100 }
              : null
          )
          onUploadComplete?.(downloadURL)
        }
      )
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMessage = error.message || 'Upload failed'
      setDocument((prev) =>
        prev ? { ...prev, status: 'error', error: errorMessage } : null
      )
      onUploadError?.(errorMessage)
    }
  }

  // ============================================================================
  // Remove Document
  // ============================================================================

  function handleRemove() {
    setDocument(null)
    onUploadComplete?.('')
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card className={`${required ? 'border-primary' : ''}`}>
      <CardContent className="p-4">
        {/* Label */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold">{label}</label>
            {required && <Badge variant="destructive" className="text-xs">Required</Badge>}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </div>

        {/* Upload Area */}
        {!document ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors
              ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}
            `}
          >
            <input
              type="file"
              id={`file-input-${documentType}`}
              accept={acceptedFormats.join(',')}
              onChange={handleInputChange}
              className="hidden"
            />
            <label
              htmlFor={`file-input-${documentType}`}
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drop file here or click to upload
              </p>
              <p className="text-xs text-muted-foreground">
                Max {maxSizeMB}MB • {acceptedFormats.join(', ').replace(/\./g, '').toUpperCase()}
              </p>
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            {/* File Info */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <File className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{document.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(document.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              
              {/* Status Icon */}
              <div className="flex-shrink-0">
                {document.status === 'completed' && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
                {document.status === 'error' && (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                {document.status === 'uploading' && (
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Remove Button */}
              {document.status === 'completed' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={handleRemove}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Upload Progress */}
            {document.status === 'uploading' && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{document.uploadProgress.toFixed(0)}%</span>
                </div>
                <Progress value={document.uploadProgress} />
              </div>
            )}

            {/* Error Message */}
            {document.status === 'error' && (
              <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-red-700">{document.error}</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs text-red-600"
                    onClick={() => uploadDocument(document)}
                  >
                    Retry Upload
                  </Button>
                </div>
              </div>
            )}

            {/* Success Message */}
            {document.status === 'completed' && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <p className="text-xs text-green-700 font-medium">Upload successful</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
