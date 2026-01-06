import { NextRequest, NextResponse } from 'next/server'
import { generateAiringVideo } from '@/lib/airing-video-service'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { bookingId } = await request.json()

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    }

    // Fetch booking data
    const bookingRef = doc(db, 'booking', bookingId)
    const bookingSnap = await getDoc(bookingRef)

    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const booking = { id: bookingSnap.id, ...bookingSnap.data() } as any

    // Generate video
    const videoUrl = await generateAiringVideo(booking)

    return NextResponse.json({ success: true, videoUrl })
  } catch (error) {
    console.error('Error generating airing video:', error)
    return NextResponse.json({ error: 'Failed to generate video' }, { status: 500 })
  }
}