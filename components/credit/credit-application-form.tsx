'use client'

import { useState, useRef } from 'react'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/auth-context'
import { pezeshaClient, type PezeshaCreditApplication } from '@/lib/pezesha-api'
import { assessCredit, type CreditAssessmentInput } from '@/lib/credit-engine'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DocumentUpload } from './document-upload'
import {
  FileText,
  Building,
  User,
  DollarSign,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Info,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface FormData {
  // Business Information
  businessName: string
  businessRegistrationNumber: string
  kraPinNumber: string
  businessEmail: string
  businessPhone: string
  businessAddress: string
  
  // Owner Information
  ownerName: string
  ownerIdNumber: string
  ownerPhone: string
  ownerEmail: string
  
  // Credit Request
  requestedAmount: number
  
  // Documents
  documents: {
    kraPin: string
    businessCertificate: string
    ownerId: string
    bankStatement: string
  }
  
  // Consent
  consent: {
    kyc: boolean
    crb: boolean
    dataSharing: boolean
    termsAndConditions: boolean
    autoDebit: boolean
    signature: string
  }
}

interface CreditApplicationFormProps {
  onSuccess?: (applicationId: string) => void
  onError?: (error: string) => void
}

// ============================================================================
// Credit Application Form Component
// ============================================================================

export function CreditApplicationForm({ onSuccess, onError }: CreditApplicationFormProps) {
  const { user, userData, organization } = useAuth()
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const [currentTab, setCurrentTab] = useState('business')
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    businessName: userData?.organizationDisplayName || '',
    businessRegistrationNumber: '',
    kraPinNumber: '',
    businessEmail: userData?.email || '',
    businessPhone: userData?.contactNumber || '',
    businessAddress: userData?.location || '',
    ownerName: userData?.displayName || '',
    ownerIdNumber: '',
    ownerPhone: userData?.contactNumber || '',
    ownerEmail: userData?.email || '',
    requestedAmount: 50000,
    documents: {
      kraPin: '',
      businessCertificate: '',
      ownerId: '',
      bankStatement: '',
    },
    consent: {
      kyc: false,
      crb: false,
      dataSharing: false,
      termsAndConditions: false,
      autoDebit: false,
      signature: '',
    },
  })

  // ============================================================================
  // Form Validation
  // ============================================================================

  function validateBusinessInfo(): string | null {
    if (!formData.businessName.trim()) return 'Business name is required'
    if (!formData.businessRegistrationNumber.trim()) return 'Registration number is required'
    if (!formData.kraPinNumber.trim()) return 'KRA PIN is required'
    if (!formData.businessEmail.trim()) return 'Business email is required'
    if (!formData.businessPhone.trim()) return 'Business phone is required'
    if (!formData.businessAddress.trim()) return 'Business address is required'
    return null
  }

  function validateOwnerInfo(): string | null {
    if (!formData.ownerName.trim()) return 'Owner name is required'
    if (!formData.ownerIdNumber.trim()) return 'ID number is required'
    if (!formData.ownerPhone.trim()) return 'Owner phone is required'
    if (!formData.ownerEmail.trim()) return 'Owner email is required'
    return null
  }

  function validateCreditRequest(): string | null {
    if (formData.requestedAmount < 10000) return 'Minimum credit amount is KES 10,000'
    if (formData.requestedAmount > 500000) return 'Maximum credit amount is KES 500,000'
    return null
  }

  function validateDocuments(): string | null {
    if (!formData.documents.kraPin) return 'KRA PIN document is required'
    if (!formData.documents.businessCertificate) return 'Business certificate is required'
    if (!formData.documents.ownerId) return 'Owner ID document is required'
    return null
  }

  function validateConsent(): string | null {
    if (!formData.consent.kyc) return 'KYC consent is required'
    if (!formData.consent.crb) return 'CRB check consent is required'
    if (!formData.consent.dataSharing) return 'Data sharing consent is required'
    if (!formData.consent.termsAndConditions) return 'Terms and conditions acceptance is required'
    if (!formData.consent.signature) return 'Signature is required'
    return null
  }

  // ============================================================================
  // Tab Navigation
  // ============================================================================

  function canProceedToNextTab(): boolean {
    switch (currentTab) {
      case 'business':
        return validateBusinessInfo() === null
      case 'owner':
        return validateOwnerInfo() === null
      case 'credit':
        return validateCreditRequest() === null
      case 'documents':
        return validateDocuments() === null
      default:
        return true
    }
  }

  function handleNextTab() {
    const tabs = ['business', 'owner', 'credit', 'documents', 'consent']
    const currentIndex = tabs.indexOf(currentTab)
    if (currentIndex < tabs.length - 1) {
      setCurrentTab(tabs[currentIndex + 1])
    }
  }

  // ============================================================================
  // Signature Handling
  // ============================================================================

  function startDrawing(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
    canvas.onmousemove = (e) => drawSignature(e)
  }

  function drawSignature(e: MouseEvent) {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.stroke()
  }

  function stopDrawing() {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    canvas.onmousemove = null

    // Save signature as base64
    const signatureData = canvas.toDataURL()
    setFormData((prev) => ({
      ...prev,
      consent: { ...prev.consent, signature: signatureData },
    }))
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setFormData((prev) => ({
      ...prev,
      consent: { ...prev.consent, signature: '' },
    }))
  }

  // ============================================================================
  // Form Submission
  // ============================================================================

  async function handleSubmit() {
    if (!user || !userData || !organization || !db) {
      onError?.('Authentication required')
      return
    }

    // Final validation
    const validationError =
      validateBusinessInfo() ||
      validateOwnerInfo() ||
      validateCreditRequest() ||
      validateDocuments() ||
      validateConsent()

    if (validationError) {
      onError?.(validationError)
      alert(validationError)
      return
    }

    setSubmitting(true)

    try {
      // TODO: Fetch real retailer metrics from Firestore
      // For now, using placeholder data
      const creditInput: CreditAssessmentInput = {
        retailerId: user.uid,
        trailingVolume90d: 150000,
        trailingGrowthRate: 0.15,
        orders90d: 45,
        averageOrderValue: 3333,
        onTimePaymentRate: 0.92,
        disputeRate: 0.01,
        repaymentLagDays: 1.5,
        creditUtilization: 0,
        currentOutstanding: 0,
        existingCreditLimit: 0,
        consecutiveOnTimePayments: 12,
        daysSinceSignup: 180,
        sectorRisk: 'medium',
      }

      // Calculate credit score
      const creditAssessment = assessCredit(creditInput)

      // Prepare Pezesha application
      const pezeshaApplication: PezeshaCreditApplication = {
        businessName: formData.businessName,
        businessRegistrationNumber: formData.businessRegistrationNumber,
        kraPinNumber: formData.kraPinNumber,
        businessEmail: formData.businessEmail,
        businessPhone: formData.businessPhone,
        businessAddress: formData.businessAddress,
        ownerName: formData.ownerName,
        ownerIdNumber: formData.ownerIdNumber,
        ownerPhone: formData.ownerPhone,
        ownerEmail: formData.ownerEmail,
        requestedAmount: formData.requestedAmount,
        creditScore: creditAssessment.score,
        scoreBreakdown: creditAssessment.breakdown,
        monthlySalesVolume: creditInput.trailingVolume90d / 3,
        averageOrderValue: creditInput.averageOrderValue,
        orderFrequency: creditInput.orders90d / 3,
        businessTenureDays: creditInput.daysSinceSignup,
        documents: formData.documents,
        consent: {
          ...formData.consent,
          timestamp: new Date().toISOString(),
          ipAddress: 'unknown', // Would get from request in production
        },
        retailerId: user.uid,
        organizationId: organization.id,
        applicationDate: new Date().toISOString(),
      }

      // Submit to Pezesha
      const pezeshaResponse = await pezeshaClient.submitCreditApplication(pezeshaApplication)

      // Save to Firestore
      const applicationRef = collection(
        db,
        'organizations',
        organization.id,
        'credit_applications'
      )
      const docRef = await addDoc(applicationRef, {
        applicationId: pezeshaResponse.applicationId,
        retailerId: user.uid,
        organizationId: organization.id,
        status: pezeshaResponse.status,
        submittedAt: Timestamp.now(),
        business: {
          name: formData.businessName,
          registrationNumber: formData.businessRegistrationNumber,
          kraPinNumber: formData.kraPinNumber,
          email: formData.businessEmail,
          phone: formData.businessPhone,
          address: formData.businessAddress,
        },
        owner: {
          name: formData.ownerName,
          idNumber: formData.ownerIdNumber,
          phone: formData.ownerPhone,
          email: formData.ownerEmail,
        },
        creditRequest: {
          amount: formData.requestedAmount,
          currency: 'KES',
          purpose: 'working_capital',
          requestedTenorDays: 30,
        },
        creditAssessment: {
          score: creditAssessment.score,
          breakdown: creditAssessment.breakdown,
          tier: creditAssessment.tier.id,
          recommendedLimit: creditAssessment.recommendedLimit,
        },
        financialMetrics: {
          monthlySalesVolume: creditInput.trailingVolume90d / 3,
          averageOrderValue: creditInput.averageOrderValue,
          orderFrequency: creditInput.orders90d / 3,
          businessTenureDays: creditInput.daysSinceSignup,
          outstandingBalance: 0,
          existingCreditLimit: 0,
        },
        documents: formData.documents,
        consent: {
          ...formData.consent,
          timestamp: Timestamp.now(),
          ipAddress: 'unknown',
        },
        pezeshaResponse: {
          approvedAmount: pezeshaResponse.approvedAmount || null,
          creditLimit: pezeshaResponse.creditLimit || null,
          interestRate: pezeshaResponse.interestRate || null,
          tenorDays: pezeshaResponse.tenorDays || null,
          rejectionReason: pezeshaResponse.rejectionReason || null,
          message: pezeshaResponse.message,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user.uid,
        updatedBy: user.uid,
      })

      onSuccess?.(docRef.id)
      alert(`Application submitted successfully! Application ID: ${pezeshaResponse.applicationId}`)
    } catch (error: any) {
      console.error('Application submission error:', error)
      const errorMessage = error.message || 'Failed to submit application'
      onError?.(errorMessage)
      alert(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication Required</CardTitle>
          <CardDescription>Please log in to apply for credit</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Credit Application</CardTitle>
          <CardDescription>
            Apply for working capital credit up to KES 500,000. Complete all sections to submit your
            application.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Application Form */}
      <Tabs value={currentTab} onValueChange={setCurrentTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="business">
            <Building className="h-4 w-4 mr-2" />
            Business
          </TabsTrigger>
          <TabsTrigger value="owner">
            <User className="h-4 w-4 mr-2" />
            Owner
          </TabsTrigger>
          <TabsTrigger value="credit">
            <DollarSign className="h-4 w-4 mr-2" />
            Credit
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="consent">
            <Shield className="h-4 w-4 mr-2" />
            Consent
          </TabsTrigger>
        </TabsList>

        {/* Business Information Tab */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Provide your business registration details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, businessName: e.target.value }))
                    }
                    placeholder="ABC Supermarket Ltd"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessRegistrationNumber">Registration Number *</Label>
                  <Input
                    id="businessRegistrationNumber"
                    value={formData.businessRegistrationNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        businessRegistrationNumber: e.target.value,
                      }))
                    }
                    placeholder="C.12345/2020"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kraPinNumber">KRA PIN *</Label>
                  <Input
                    id="kraPinNumber"
                    value={formData.kraPinNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, kraPinNumber: e.target.value }))
                    }
                    placeholder="A001234567Z"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessEmail">Business Email *</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={formData.businessEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, businessEmail: e.target.value }))
                    }
                    placeholder="info@business.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessPhone">Business Phone *</Label>
                  <Input
                    id="businessPhone"
                    value={formData.businessPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, businessPhone: e.target.value }))
                    }
                    placeholder="+254712345678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address *</Label>
                  <Input
                    id="businessAddress"
                    value={formData.businessAddress}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, businessAddress: e.target.value }))
                    }
                    placeholder="123 Main St, Nairobi"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNextTab} disabled={!canProceedToNextTab()}>
                  Next: Owner Information
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Owner Information Tab */}
        <TabsContent value="owner">
          <Card>
            <CardHeader>
              <CardTitle>Owner Information</CardTitle>
              <CardDescription>Primary business owner or director details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Full Name *</Label>
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ownerName: e.target.value }))
                    }
                    placeholder="John Doe"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerIdNumber">ID Number *</Label>
                  <Input
                    id="ownerIdNumber"
                    value={formData.ownerIdNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ownerIdNumber: e.target.value }))
                    }
                    placeholder="12345678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerPhone">Phone Number *</Label>
                  <Input
                    id="ownerPhone"
                    value={formData.ownerPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ownerPhone: e.target.value }))
                    }
                    placeholder="+254712345678"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownerEmail">Email Address *</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, ownerEmail: e.target.value }))
                    }
                    placeholder="john@business.com"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNextTab} disabled={!canProceedToNextTab()}>
                  Next: Credit Request
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Credit Request Tab */}
        <TabsContent value="credit">
          <Card>
            <CardHeader>
              <CardTitle>Credit Request</CardTitle>
              <CardDescription>How much credit do you need?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="requestedAmount">Requested Amount (KES) *</Label>
                <Input
                  id="requestedAmount"
                  type="number"
                  value={formData.requestedAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      requestedAmount: parseInt(e.target.value) || 0,
                    }))
                  }
                  min={10000}
                  max={500000}
                  step={5000}
                />
                <p className="text-sm text-muted-foreground">
                  Min: KES 10,000 • Max: KES 500,000
                </p>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Your credit limit will be determined based on your sales performance, payment
                  history, and credit score. You may be approved for a different amount than
                  requested.
                </AlertDescription>
              </Alert>

              <div className="flex justify-end">
                <Button onClick={handleNextTab} disabled={!canProceedToNextTab()}>
                  Next: Upload Documents
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Required Documents</CardTitle>
              <CardDescription>Upload clear copies of the following documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DocumentUpload
                organizationId={organization?.id || ''}
                retailerId={user.uid}
                documentType="kraPin"
                label="KRA PIN Certificate"
                description="Upload your KRA PIN certificate"
                required
                onUploadComplete={(url) =>
                  setFormData((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, kraPin: url },
                  }))
                }
              />

              <DocumentUpload
                organizationId={organization?.id || ''}
                retailerId={user.uid}
                documentType="businessCertificate"
                label="Business Registration Certificate"
                description="Certificate of incorporation or business registration"
                required
                onUploadComplete={(url) =>
                  setFormData((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, businessCertificate: url },
                  }))
                }
              />

              <DocumentUpload
                organizationId={organization?.id || ''}
                retailerId={user.uid}
                documentType="ownerId"
                label="Owner ID Copy"
                description="National ID or passport of the business owner"
                required
                onUploadComplete={(url) =>
                  setFormData((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, ownerId: url },
                  }))
                }
              />

              <DocumentUpload
                organizationId={organization?.id || ''}
                retailerId={user.uid}
                documentType="bankStatement"
                label="Bank Statement (Optional)"
                description="Last 3 months bank statement (recommended)"
                onUploadComplete={(url) =>
                  setFormData((prev) => ({
                    ...prev,
                    documents: { ...prev.documents, bankStatement: url },
                  }))
                }
              />

              <div className="flex justify-end">
                <Button onClick={handleNextTab} disabled={!canProceedToNextTab()}>
                  Next: Review & Consent
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consent Tab */}
        <TabsContent value="consent">
          <Card>
            <CardHeader>
              <CardTitle>Consent & Signature</CardTitle>
              <CardDescription>Review and accept the terms and conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Consent Checkboxes */}
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="kyc"
                    checked={formData.consent.kyc}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        consent: { ...prev.consent, kyc: checked as boolean },
                      }))
                    }
                  />
                  <Label htmlFor="kyc" className="text-sm leading-relaxed cursor-pointer">
                    <strong>KYC Consent:</strong> I authorize VendAI and Pezesha to verify my
                    identity and business information through official government databases and third-party services.
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="crb"
                    checked={formData.consent.crb}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        consent: { ...prev.consent, crb: checked as boolean },
                      }))
                    }
                  />
                  <Label htmlFor="crb" className="text-sm leading-relaxed cursor-pointer">
                    <strong>CRB Check Consent:</strong> I authorize Pezesha to access my credit
                    report from licensed Credit Reference Bureaus (CRBs) in Kenya to assess my
                    creditworthiness.
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="dataSharing"
                    checked={formData.consent.dataSharing}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        consent: { ...prev.consent, dataSharing: checked as boolean },
                      }))
                    }
                  />
                  <Label htmlFor="dataSharing" className="text-sm leading-relaxed cursor-pointer">
                    <strong>Data Sharing:</strong> I consent to VendAI sharing my business
                    transaction data, sales performance, and payment history with Pezesha for credit
                    assessment purposes.
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="terms"
                    checked={formData.consent.termsAndConditions}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        consent: { ...prev.consent, termsAndConditions: checked as boolean },
                      }))
                    }
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                    <strong>Terms & Conditions:</strong> I have read and accept the{' '}
                    <a href="#" className="text-primary underline">
                      credit terms and conditions
                    </a>
                    , including interest rates, repayment schedules, and late payment penalties.
                  </Label>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="autoDebit"
                    checked={formData.consent.autoDebit}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        consent: { ...prev.consent, autoDebit: checked as boolean },
                      }))
                    }
                  />
                  <Label htmlFor="autoDebit" className="text-sm leading-relaxed cursor-pointer">
                    <strong>Auto-Debit Authorization:</strong> I authorize Pezesha to automatically
                    deduct repayments from my registered M-Pesa account or bank account on due dates.
                  </Label>
                </div>
              </div>

              <Separator />

              {/* Signature */}
              <div className="space-y-3">
                <Label>Digital Signature *</Label>
                <p className="text-sm text-muted-foreground">
                  Sign below using your mouse or touchscreen
                </p>
                <div className="border-2 border-dashed rounded-lg p-2">
                  <canvas
                    ref={signatureCanvasRef}
                    width={600}
                    height={200}
                    className="w-full bg-white cursor-crosshair rounded"
                    onMouseDown={startDrawing}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={clearSignature}>
                    Clear Signature
                  </Button>
                  {formData.consent.signature && (
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Signature Captured
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* Submit Button */}
              <div className="space-y-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    By submitting this application, you confirm that all information provided is
                    accurate and complete. Pezesha will review your application and notify you of
                    the decision within 24-48 hours.
                  </AlertDescription>
                </Alert>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting || validateConsent() !== null}
                  className="w-full"
                  size="lg"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting Application...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Credit Application
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
