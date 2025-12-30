import { format } from "date-fns"

interface CMSSchedule {
  startDate: string
  endDate: string
  plans: Array<{
    weekDays: number[]
    startTime: string
    endTime: string
  }>
}

interface CMSWidget {
  zIndex: number
  type: string
  size: number
  md5: string
  duration: number
  url: string
  layout: {
    x: string
    y: string
    width: string
    height: string
  }
}

interface CMSPage {
  name: string
  widgets: CMSWidget[]
}

interface CMSRequestBody {
  playerIds: string[]
  schedule: CMSSchedule
  pages: CMSPage[]
}

interface CMSResponse {
  // Define the expected response structure if known
  [key: string]: any
}

const novaCloudURL = process.env.NEXT_PUBLIC_NOVA_CLOUD_URL
export async function checkPlayerOnlineStatus(playerIds: string[]): Promise<boolean> {


  try {
    const response = await fetch(`${novaCloudURL}/api/v1/players/status/player-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ playerIds })
    })

    if (response.ok) {
      const data: any = await response.json()
      console.log("Player Status Response: ", data[0].onlineStatus) 
      return data[0].onlineStatus === 1 
    } else {
      console.error("Failed to check player status:", response.status, response.statusText)
      return false
    }
  } catch (error) {
    console.error("Error checking player online status:", error)
    return false
  }
}

export async function createCMSContentDeployment(
  playerIds: string[],
  schedule: CMSSchedule,
  pages: CMSPage[]
): Promise<CMSResponse | null> {
  
  try {
    const cmsRequestBody: CMSRequestBody = {
      playerIds,
      schedule,
      pages
    }

    console.log("CMS Request Body:", JSON.stringify(cmsRequestBody, null, 2))

    const cmsResponse = await fetch(`${novaCloudURL}/api/v1/players/solutions/common-solutions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cmsRequestBody)
    })

    console.log("CMS Response Status:", cmsResponse.status, cmsResponse.statusText)

    if (cmsResponse.ok) {
      const cmsResult = await cmsResponse.json()
      console.log("CMS API Response Details:")
      console.log("StatusCode        :", cmsResponse.status)
      console.log("StatusDescription :", cmsResponse.statusText)
      console.log("Content           :", JSON.stringify(cmsResult))
      console.log("RawContent        :", `HTTP/1.1 ${cmsResponse.status} ${cmsResponse.statusText}`)
      console.log("CMS content deployment created successfully:", cmsResult)
      return cmsResult
    } else {
      const errorText = await cmsResponse.text()
      console.error("CMS API Response Details:")
      console.error("StatusCode        :", cmsResponse.status)
      console.error("StatusDescription :", cmsResponse.statusText)
      console.error("Content           :", errorText)
      console.error("RawContent        :", `HTTP/1.1 ${cmsResponse.status} ${cmsResponse.statusText}`)
      console.error("CMS API error:", cmsResponse.status, cmsResponse.statusText, errorText)
      return null
    }
  } catch (cmsApiError) {
    console.error("Error with CMS API integration:", cmsApiError)
    return null
  }
}