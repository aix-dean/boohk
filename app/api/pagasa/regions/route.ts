import { NextResponse } from "next/server"

// These are the actual regions used by PAGASA for their forecasts
const pagasaRegions = [
  { id: "NCR", name: "Metro Manila" },
  { id: "REGION_I", name: "Ilocos Region" },
  { id: "REGION_II", name: "Cagayan Valley" },
  { id: "REGION_III", name: "Central Luzon" },
  { id: "REGION_IV_A", name: "CALABARZON" },
  { id: "REGION_IV_B", name: "MIMAROPA" },
  { id: "REGION_V", name: "Bicol Region" },
  { id: "REGION_VI", name: "Western Visayas" },
  { id: "REGION_VII", name: "Central Visayas" },
  { id: "REGION_VIII", name: "Eastern Visayas" },
  { id: "REGION_IX", name: "Zamboanga Peninsula" },
  { id: "REGION_X", name: "Northern Mindanao" },
  { id: "REGION_XI", name: "Davao Region" },
  { id: "REGION_XII", name: "SOCCSKSARGEN" },
  { id: "REGION_XIII", name: "Caraga" },
  { id: "CAR", name: "Cordillera Administrative Region" },
  { id: "BARMM", name: "Bangsamoro Autonomous Region in Muslim Mindanao" },
]

export async function GET() {
  try {
    // In a production environment, you might fetch this from PAGASA's API
    return NextResponse.json(pagasaRegions)
  } catch (error) {
    console.error("Error fetching PAGASA regions:", error)
    return NextResponse.json({ error: "Failed to fetch regions from PAGASA" }, { status: 503 })
  }
}
