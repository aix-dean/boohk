import { Document, Page, pdfjs } from "react-pdf";

// Configure PDF.js worker with a compatible version for pdfjs-dist v5.4.149
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.js`;
}

import SiteDetailsPage from "@/app/admin/inventory/[id]/page"

export default function LogisticsSiteDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return <SiteDetailsPage params={params} />
}
