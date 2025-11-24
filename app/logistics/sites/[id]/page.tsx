import { Document, Page, pdfjs } from "react-pdf";

// Configure PDF.js worker with a compatible version for pdfjs-dist v5.4.149
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.js`;
