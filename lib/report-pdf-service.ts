/**
 * Utility service for generating report PDFs using client-side rendering
 */

export async function generateReportPDF(reportId: string, siteName?: string | null): Promise<File> {
  // Dynamic imports for client-side libraries
  const html2canvas = (await import('html2canvas')).default
  const jsPDF = (await import('jspdf')).default

  // Find the main report container
  const reportContainer = document.querySelector('#report-pdf-container') as HTMLElement

  if (!reportContainer) {
    console.error('DEBUG: Report container not found. Available containers:')
    const allContainers = document.querySelectorAll('[class*="container"], [class*="report"], main, article')
    allContainers.forEach((el, i) => {
      console.log(`DEBUG: Container ${i}:`, el.className, el.tagName, el)
    })
    throw new Error("Report container not found")
  }

  // Capture the report with html2canvas
  const canvas = await html2canvas(reportContainer, {
    scale: 2, // Higher quality
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    width: reportContainer.offsetWidth,
    height: reportContainer.offsetHeight,
    imageTimeout: 0,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/jpeg', 0.8)

  // Create PDF
  const pdf = new jsPDF('p', 'mm', 'a4')
  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()

  // Fill the entire PDF page without margins
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)

  // Convert to blob and create file
  const pdfBlob = pdf.output('blob')
  const fileName = siteName ? `report-${siteName}.pdf` : `report-${reportId}.pdf`
  const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' })

  return pdfFile
}