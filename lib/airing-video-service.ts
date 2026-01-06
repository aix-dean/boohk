import puppeteer from 'puppeteer'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { doc, updateDoc } from 'firebase/firestore'
import { storage, db } from './firebase'

interface Booking {
  id: string
  reservation_id?: string
  start_date: any
  end_date: any
  client: {
    company_id: string
    id: string
    name: string
    company_name: string
  }
  total_cost: number
  product_name?: string
  project_name?: string
  url?: string
  type?: string
  airing_code?: string
  airing_url?: string
}

function generateTicketHTML(booking: Booking): string {
  const ticketCode = booking.airing_code || "BH" + Date.now()
  const dateAccepted = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const company = booking.client?.company_name || booking.client?.name || 'Unknown Client'
  const dates = formatBookingDates(booking.start_date, booking.end_date)
  const formatSchedule = (startDate: any, endDate: any): string => {
    if (!startDate || !endDate) return ""
    try {
      const start = startDate.toDate ? startDate.toDate() : new Date(startDate)
      const end = endDate.toDate ? endDate.toDate() : new Date(endDate)
      const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
      const startDay = start.getDate()
      const endDay = end.getDate()
      const year = start.getFullYear()
      return `${startMonth} ${startDay}-${endDay}, ${year}`
    } catch {
      return ""
    }
  }
  const schedule = formatSchedule(booking.start_date, booking.end_date)
  const displayName = booking.product_name || booking.project_name || "N/A"
  const totalPayout = `₱${booking.total_cost?.toLocaleString() || "0"}`
  const bookingCode = booking.reservation_id
  const contentLabel = "Content"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Airing Ticket</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: white; }
    .ticket { background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(to right, #8B5CF6, #64748B, #0EA5E9); height: 44px; display: flex; align-items: center; padding: 0 24px; color: white; }
    .header .title { font-size: 16px; }
    .header .code { margin-left: auto; font-size: 16px; font-weight: bold; }
    .body { padding: 16px; position: relative; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 16px; }
    .section-title { color: #374151; font-size: 12px; font-weight: bold; margin-bottom: 8px; }
    .label { color: #374151; font-size: 12px; margin-bottom: 4px; }
    .value { color: #374151; font-size: 16px; font-weight: bold; margin-bottom: 8px; }
    .value-sm { color: #374151; font-size: 14px; font-weight: bold; }
    .content { width: 320px; height: 160px; background: #F3F4F6; border-radius: 8px; overflow: hidden; transform: translate(-80px, 0); }
    .content-label { color: #374151; font-size: 12px; margin-bottom: 8px; transform: translate(-80px, 0); }
    .barcode-container { position: absolute; right: 16px; top: 48px; display: flex; flex-direction: column; align-items: center; transform: translate(25px, 30px); }
    .barcode { transform: rotate(90deg); }
    .barcode-text { color: black; font-size: 12px; font-weight: bold; margin-top: 4px; transform: translate(45px, -40px) rotate(270deg); }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="header">
      <div class="title">Airing Ticket Code</div>
      <div class="code">${ticketCode}</div>
    </div>
    <div class="body">
      <div class="grid">
        <div>
          <div class="section-title">Confirmation Details</div>
          <div class="label">Date Accepted</div>
          <div class="value">${dateAccepted}</div>
          <div class="label">Company</div>
          <div class="value">${company}</div>
        </div>
        <div>
          <div class="section-title">Booking Details</div>
          <div class="label">Dates</div>
          <div class="value" style="margin-bottom: 16px;">${schedule}</div>
          <div class="label">Display Name</div>
          <div class="value truncate">${displayName}</div>
          <div class="label">Total Payout</div>
          <div class="value">₱${booking.total_cost?.toLocaleString() || "0"}</div>
          <div class="label">Booking Code</div>
          <div class="value-sm">${bookingCode}</div>
        </div>
        <div>
          <div class="content-label">${contentLabel}</div>
          <div class="content">
            ${booking.url ? (
              booking.url.includes('.mp4') || booking.url.includes('video') ?
                `<video src="${booking.url}" style="width: 100%; height: 100%; object-fit: cover;" controls autoplay></video>` :
                `<img src="${booking.url}" alt="Content preview" style="width: 100%; height: 100%; object-fit: cover;" />`
            ) : (
              `<div style="width: 100%; height: 100%; background: #D1D5DB; display: flex; align-items: center; justify-content: center;"><span style="color: #6B7280; font-size: 12px;">No Media</span></div>`
            )}
          </div>
        </div>
      </div>
      <div class="barcode-container">
        <div class="barcode">
          <canvas id="barcode"></canvas>
        </div>
        <div class="barcode-text">${ticketCode}</div>
      </div>
    </div>
  </div>
  <script>
    // Generate barcode
    if (window.JsBarcode) {
      JsBarcode("#barcode", '${ticketCode}', {
        format: "CODE128",
        width: 1,
        height: 50,
        displayValue: false,
        lineColor: "#000000"
      });
    }
  </script>
</body>
</html>
  `
}

function formatBookingDates(startDate: any, endDate: any): string {
  // Implement the formatBookingDates function if needed, but since it's not used in HTML, maybe not necessary
  return ""
}

export async function generateAiringVideo(booking: Booking): Promise<string> {
  try {
    const html = generateTicketHTML(booking)

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const page = await browser.newPage()

    // Important: fixed viewport for video consistency
    await page.setViewport({
      width: 1024,
      height: 600,
      deviceScaleFactor: 1,
    })

    await page.setContent(html, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.ticket')

    // Wait until barcode is rendered
    await page.waitForFunction(() => {
      const canvas = document.getElementById('barcode') as HTMLCanvasElement
      return canvas && canvas.width > 0
    })

    // Screenshot the ticket
    const ticketElement = await page.$('.ticket')
    if (!ticketElement) throw new Error('Ticket element not found')
    const screenshotBuffer = await ticketElement.screenshot()

    await browser.close()

    // Upload to Firebase Storage as image
    const imageRef = ref(storage, `airing-tickets/${booking.id}.png`)
    await uploadBytes(imageRef, screenshotBuffer, { contentType: 'image/png' })
    const downloadURL = await getDownloadURL(imageRef)

    // Update booking document
    const bookingRef = doc(db, 'booking', booking.id)
    await updateDoc(bookingRef, { airing_url: downloadURL })

    return downloadURL
  } catch (err) {
    console.error('Error generating airing video:', err)
    throw err
  }
}