export type TodoStatus = "todo" | "in-progress" | "done"

import { Timestamp } from "firebase/firestore"

export interface Todo {
  id: string
  title: string
  description: string
  start_date: Timestamp | string
  end_date: Timestamp | string
  allDay: boolean
  repeat: string
  completed: boolean
  status: TodoStatus
  company_id: string
  user_id: string
  department?: string
  created_at: Date
  updated_at: Date
  attachments?: string[] // URLs to uploaded files
  isDeleted: boolean
}