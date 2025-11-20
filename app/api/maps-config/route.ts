import { NextResponse } from "next/server"

export async function GET() {
  // Use environment variable or fallback to provided key
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyDeLrUgnPTRk36Gwq9V2RlDJEyhUO5fwO8"

  return NextResponse.json({ apiKey })
}
