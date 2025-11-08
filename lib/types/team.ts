export interface Team {
  id: string
  name: string
  description: string
  teamType: "operations" | "maintenance" | "installation" | "delivery" | "support"
  status: "active" | "inactive"
  leaderId?: string
  leaderName?: string
  members: TeamMember[]
  specializations: string[]
  location: string
  contactNumber?: string
  email?: string
  createdAt: Date
  updatedAt: Date
  createdBy: string
  company_id?: string
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: "leader" | "senior" | "junior" | "trainee"
  specializations: string[]
  contactNumber?: string
  joinedAt: Date
  status: "active" | "inactive" | "on-leave"
}

export interface CreateTeamData {
  name: string
  description: string
  teamType: "operations" | "maintenance" | "installation" | "delivery" | "support"
  leaderId?: string
  leaderName?: string
  specializations: string[]
  location: string
  contactNumber?: string
  email?: string
  company_id: string
}
