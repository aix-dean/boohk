export interface User {
  id: string
  email: string
  displayName: string
  photoURL?: string
  role?: string
}

export interface Role {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
}

export interface Permission {
  id: string
  name: string
  description: string
  module: string
  action: "view" | "create" | "edit" | "delete"
}

export interface UserRole {
  userId: string
  roleId: string
  assignedAt: number
}

export interface RolePermission {
  roleId: string
  permissionId: string
  assignedAt: number
}

export interface Department {
  id: string
  name: string
  description: string
}

export const DEPARTMENTS = [
  { id: "sales", name: "Sales", description: "Sales department" },
  { id: "logistics", name: "Logistics", description: "Logistics department" },
  { id: "cms", name: "CMS", description: "Content Management System" },
  { id: "admin", name: "Admin", description: "Administration" },
  { id: "it", name: "IT", description: "Information Technology" },
  { id: "treasury", name: "Treasury", description: "Treasury department" },
]

export const PERMISSION_ACTIONS = [
  { id: "view", name: "View" },
  { id: "create", name: "Create" },
  { id: "edit", name: "Edit" },
  { id: "delete", name: "Delete" },
]
