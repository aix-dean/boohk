import { NextResponse } from "next/server"
import { philippineRegions } from "@/lib/open-meteo-service"

export async function GET() {
  return NextResponse.json(philippineRegions)
}
