# Cost Estimate PDF Generation Logic Update

## Current Understanding

The task requires modifying the PDF generation logic in `/sales/cost-estimates/[id]/page.tsx` to check if the document already has a PDF. If it does, compare the `signature_date` (stored in the cost estimate document) with the creator user's current `signature.updated` timestamp. If they are equal, continue with the action. If not equal, generate a new PDF before proceeding.

## Key Components

1. **PDF Check**: Check if `costEstimate.pdf` exists
2. **Signature Date Comparison**: Compare `costEstimate.signature_date` with current user's `signature.updated`
3. **PDF Generation**: If dates don't match, generate new PDF
4. **Action Continuation**: Proceed with download/send after PDF validation

## Functions to Modify

1. `handleDownloadPDF` - Add signature date check before downloading
2. `handleSendWithPDFGeneration` - Add signature date check before sending
3. `generatePDFIfNeeded` - Add signature date check logic

## Implementation Steps

### 1. Create Helper Function
Add a helper function to fetch the current user's signature.updated date:

```typescript
const getCurrentUserSignatureDate = async (): Promise<Date | null> => {
  if (!costEstimate?.createdBy) return null
  try {
    const userDocRef = doc(db, "iboard_users", costEstimate.createdBy)
    const userDoc = await getDoc(userDocRef)
    if (userDoc.exists()) {
      const userData = userDoc.data()
      if (userData.signature && typeof userData.signature === 'object' && userData.signature.updated) {
        return userData.signature.updated.toDate ? userData.signature.updated.toDate() : new Date(userData.signature.updated)
      }
    }
    return null
  } catch (error) {
    console.error('Error fetching current user signature date:', error)
    return null
  }
}
```

### 2. Modify handleDownloadPDF
Add signature date check before proceeding with download:

```typescript
const handleDownloadPDF = async () => {
  if (!costEstimate) return

  console.log('[PDF_DOWNLOAD] Starting PDF download process for cost estimate:', costEstimate.id)
  setDownloadingPDF(true)
  try {
    // Check if PDF exists and signature dates match
    if (costEstimate.pdf) {
      const currentSignatureDate = await getCurrentUserSignatureDate()
      const storedSignatureDate = costEstimate.signature_date

      if (currentSignatureDate && storedSignatureDate) {
        const currentDate = new Date(currentSignatureDate).getTime()
        const storedDate = new Date(storedSignatureDate).getTime()

        if (currentDate !== storedDate) {
          console.log('[PDF_DOWNLOAD] Signature dates do not match, regenerating PDF')
          await generatePDFIfNeeded(costEstimate)
        } else {
          console.log('[PDF_DOWNLOAD] Signature dates match, using existing PDF')
        }
      } else {
        console.log('[PDF_DOWNLOAD] Missing signature date info, regenerating PDF')
        await generatePDFIfNeeded(costEstimate)
      }
    }

    // Continue with existing download logic...
```

### 3. Modify handleSendWithPDFGeneration
Add signature date check before sending:

```typescript
const handleSendWithPDFGeneration = async () => {
  if (!costEstimate) return

  console.log("=== DEBUG SEND BUTTON ===")
  console.log("Current costEstimate.pdf:", costEstimate?.pdf, "Type:", typeof costEstimate?.pdf)

  // Check if current cost estimate has PDF
  if (costEstimate.pdf) {
    // Check signature dates
    const currentSignatureDate = await getCurrentUserSignatureDate()
    const storedSignatureDate = costEstimate.signature_date

    if (currentSignatureDate && storedSignatureDate) {
      const currentDate = new Date(currentSignatureDate).getTime()
      const storedDate = new Date(storedSignatureDate).getTime()

      if (currentDate === storedDate) {
        console.log("✅ Signature dates match, skipping PDF generation")
        setIsSendOptionsDialogOpen(true)
        return
      } else {
        console.log("⚠️ Signature dates do not match, regenerating PDF")
      }
    }
  }

  // Continue with existing PDF generation logic...
```

### 4. Update generatePDFIfNeeded
Ensure signature date is captured and stored:

```typescript
const generatePDFIfNeeded = async (costEstimate: CostEstimate) => {
  if (costEstimate.pdf) {
    return { pdfUrl: costEstimate.pdf, password: costEstimate.password }
  }

  try {
    // ... existing code ...

    // Fetch signature date directly if not available from creatorUser
    let signatureDate: Date | null = null
    if (costEstimate.createdBy) {
      try {
        const userDocRef = doc(db, "iboard_users", costEstimate.createdBy)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const userDataFetched = userDoc.data()
          if (userDataFetched.signature && typeof userDataFetched.signature === 'object' && userDataFetched.signature.updated) {
            signatureDate = userDataFetched.signature.updated.toDate ? userDataFetched.signature.updated.toDate() : new Date(userDataFetched.signature.updated)
          }
        }
      } catch (error) {
        console.error('Error fetching signature date:', error)
      }
    }

    const { pdfUrl, password } = await generateAndUploadCostEstimatePDF(costEstimate, creatorUser ? {
      first_name: creatorUser.first_name || undefined,
      last_name: creatorUser.last_name || undefined,
      email: creatorUser.email || undefined,
      company_id: creatorUser.company_id || undefined,
    } : undefined, companyData ? {
      name: companyData.name || "Company Name",
      address: companyData.address,
      phone: companyData.phone,
      email: companyData.email,
      website: companyData.website || companyData.company_website,
    } : undefined, userSignatureDataUrl)

    await updateCostEstimate(costEstimate.id, { pdf: pdfUrl, password: password, signature_date: signatureDate })
    setCostEstimate(prev => prev ? { ...prev, pdf: pdfUrl, password: password } : null)
    // Also update the relatedCostEstimates if this estimate is in there
    setRelatedCostEstimates(prev => prev.map(est =>
      est.id === costEstimate.id ? { ...est, pdf: pdfUrl, password: password } : est
    ))
    console.log("Cost estimate PDF generated and uploaded successfully:", pdfUrl)
    return { pdfUrl, password }
  } catch (error) {
    console.error("Error generating cost estimate PDF:", error)
    toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" })
    throw error
  }
}
```

## Testing

1. Test with existing PDF where signature dates match - should skip regeneration
2. Test with existing PDF where signature dates don't match - should regenerate
3. Test with no PDF - should generate new PDF
4. Test download and send actions in both scenarios

## Files to Modify

- `app/sales/cost-estimates/[id]/page.tsx` - Main logic changes

## Dependencies

- Firebase Firestore for user signature data
- Existing PDF generation functions
- Toast notifications for user feedback