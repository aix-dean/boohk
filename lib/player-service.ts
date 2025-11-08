// Player management API service for VNNOX digital signage system
// API Documentation: https://open-eu.vnnox.com/#/ApiDocs

const getApiBaseUrl = () => process.env.NEXT_PUBLIC_PLAYER_API_URL || 'http://localhost:4000/api/v1'

export interface PlayerIdsRequest {
  playerIds: string[]
}

export interface PlayerSnsRequest {
  playerIds: string[]
  playerSns: string[]
}

export interface EmergencyAttribute {
  duration: number
  normalProgramStatus: "PAUSE" | "RESUME"
  spotsType: "IMMEDIATELY" | "TIMED"
}

export interface Widget {
  duration: number
  inAnimation?: {
    duration: number
    type: string
  }
  layout: {
    height: string
    width: string
    x: string
    y: string
  }
  md5: string
  size: number
  type: "PICTURE" | "VIDEO" | "TEXT"
  url: string
  zIndex: number
}

export interface EmergencyPage {
  name: string
  widgets: Widget[]
}

export interface SinglePageEmergencyRequest extends PlayerIdsRequest {
  attribute: EmergencyAttribute
  page: EmergencyPage
}

export interface PlayerConfigRequest extends PlayerIdsRequest {
  commands: string[]
  noticeUrl: string
}

export interface Schedule {
  startDate: string
  endDate: string
  plans: Array<{
    weekDays: number[]
    startTime: string
    endTime: string
  }>
}

export interface ProgramPage {
  name: string
  widgets: Widget[]
}

export interface CreateProgramRequest extends PlayerIdsRequest {
  schedule: Schedule
  pages: ProgramPage[]
}

export interface PlayerInfo {
  id: string
  sns: string
  status: string
  location?: string
}

class PlayerService {
  private async makeRequest(endpoint: string, method: 'GET' | 'POST' = 'POST', body?: any) {
    const url = `${getApiBaseUrl()}${endpoint}`

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Node.js fetch)',
        'Accept': '*/*',
      },
    }

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body)
    }

    try {
      console.log(`Making ${method} request to: ${url}`)
      const response = await fetch(url, config)
      console.log(`Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }

      const responseText = await response.text()
      console.log(`Response body: ${responseText.substring(0, 200)}...`)

      try {
        return JSON.parse(responseText)
      } catch (parseError) {
        console.log('Response is not JSON, returning text')
        return responseText
      }
    } catch (error) {
      console.error(`Player API error for ${endpoint}:`, error)
      throw error
    }
  }

  // Cancel emergency solutions
  async cancelEmergencySolutions(playerIds: string[]) {
    const request: PlayerIdsRequest = { playerIds }
    return this.makeRequest('/players/emergency/cancel', 'POST', request)
  }

  // Create single-page emergency solution
  async createSinglePageEmergency(request: SinglePageEmergencyRequest) {
    return this.makeRequest('/players/emergency/single-page', 'POST', request)
  }

  // Get player configuration status
  async getPlayerConfig(request: PlayerConfigRequest) {
    return this.makeRequest('/players/config/status', 'POST', request)
  }

  // Get player basic info
  async getPlayerBasicInfo(request: PlayerSnsRequest) {
    return this.makeRequest('/players/basic-info', 'POST', request)
  }

  // Create player program
  async createPlayerProgram(request: CreateProgramRequest) {
    return this.makeRequest('/players/program', 'POST', request)
  }

  // Get player list
  async getPlayerList() {
    return this.makeRequest('/players/list', 'GET')
  }

  // Helper method to create a simple program with custom image
  async createSimpleProgramWithImage(
    playerIds: string[],
    imageUrl: string,
    imageMd5: string,
    imageSize: number,
    schedule: Schedule
  ) {
    const request: CreateProgramRequest = {
      playerIds,
      schedule,
      pages: [{
        name: "service-assignment-page",
        widgets: [{
          zIndex: 1,
          type: "PICTURE",
          size: imageSize,
          md5: imageMd5,
          duration: 10000,
          url: imageUrl,
          layout: {
            x: "0%",
            y: "0%",
            width: "100%",
            height: "100%"
          }
        }]
      }]
    }

    return this.createPlayerProgram(request)
  }
}

export const playerService = new PlayerService()