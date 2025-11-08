"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Switch } from "@/components/ui/switch"
import { Search, MoreVertical, Grid3X3, List, Plus, Loader2, Edit, Trash2, Download } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getTodosByUser, createTodo, updateTodo, toggleTodoComplete, createTodoHistory, getTodoHistory } from "@/lib/todo-service"
import type { Todo } from "@/lib/types/todo"
import { DEPARTMENTS } from "@/lib/types/access-management"
import { FileUpload } from "@/components/file-upload"
import { storage } from "@/lib/firebase"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { Timestamp } from "firebase/firestore"
import { toast } from "sonner"
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

// Helper function to convert timestamp to ISO string
const timestampToISOString = (timestamp: Timestamp | string): string => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate().toISOString()
  }
  return timestamp
}

// Helper function to convert ISO string to Date for display
const getDateForDisplay = (timestamp: Timestamp | string): Date => {
  if (timestamp instanceof Timestamp) {
    return timestamp.toDate()
  }
  return new Date(timestamp)
}

// Color mapping function for todo statuses
const getStatusColors = (status: Todo["status"]) => {
  switch (status) {
    case "todo":
      return {
        color: "bg-yellow-500",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        cardBorder: "border-yellow-300"
      }
    case "in-progress":
      return {
        color: "bg-blue-500",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        cardBorder: "border-blue-300"
      }
    case "done":
      return {
        color: "bg-green-500",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        cardBorder: "border-green-300"
      }
    default:
      return {
        color: "bg-gray-500",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        cardBorder: "border-gray-300"
      }
  }
}

// Draggable Todo Card Component
function DraggableTodoCard({
  todo,
  onStatusChange,
  onDragStart,
  onClick,
  onEdit,
  onDelete
}: {
  todo: Todo
  onStatusChange: (id: string, status: Todo["status"]) => void
  onDragStart: (e: React.DragEvent, todo: Todo) => void
  onClick: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}) {
  const colors = getStatusColors(todo.status)

  return (
    <Card
      className={`p-4 border-2 ${colors.cardBorder} bg-white relative cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow`}
      draggable
      data-todo-id={todo.id}
      onDragStart={(e) => onDragStart(e, todo)}
      onClick={() => onClick(todo)}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-6 w-6"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(todo); }}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDelete(todo); }}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 mb-1">{todo.title}</h3>
        {todo.description && <p className="text-gray-700 text-sm">{todo.description}</p>}
      </div>

      <hr className="border-gray-300 mb-4" />

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="font-medium">Start:</span>
          <span>{getDateForDisplay(todo.start_date).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}</span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium">End:</span>
          <span>{getDateForDisplay(todo.end_date).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="font-medium">All Day:</span>
          <Switch checked={todo.allDay} disabled />
        </div>

        <div className="flex justify-between">
          <span className="font-medium">Repeat:</span>
          <span>{todo.repeat}</span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium">Created:</span>
          <span>{todo.created_at?.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}</span>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        {todo.status === "todo" && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange(todo.id, "in-progress")
            }}
            size="sm"
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
          >
            Start
          </Button>
        )}
        {todo.status === "in-progress" && (
          <>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onStatusChange(todo.id, "todo")
              }}
              size="sm"
              variant="outline"
              className="flex-1"
            >
              Return
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onStatusChange(todo.id, "done")
              }}
              size="sm"
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              Complete
            </Button>
          </>
        )}
        {todo.status === "done" && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              onStatusChange(todo.id, "in-progress")
            }}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            Reopen
          </Button>
        )}
      </div>
    </Card>
  )
}

// Droppable Column Component
function DroppableColumn({
  id,
  title,
  count,
  color,
  bgColor,
  borderColor,
  children,
  onDrop
}: {
  id: string
  title: string
  count: number
  color: string
  bgColor: string
  borderColor: string
  children: React.ReactNode
  onDrop: (e: React.DragEvent, status: Todo["status"]) => void
}) {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(true)
  }

  const handleDragLeave = () => {
    setIsOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    setIsOver(false)
    onDrop(e, id as Todo["status"])
  }

  return (
    <div className={`${bgColor} rounded-lg p-4 min-h-[400px]`}>
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
        <div className={`w-3 h-3 ${color} rounded-full mr-2`}></div>
        {title} ({count})
      </h3>
      <div
        className={`space-y-3 min-h-[300px] p-2 rounded-md border-2 border-dashed ${
          isOver ? "border-blue-500 bg-blue-50" : borderColor
        } transition-colors`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {children}
      </div>
    </div>
  )
}

export default function TodoApp() {
  const { userData } = useAuth()
  const [todos, setTodos] = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDepartment, setSelectedDepartment] = useState<string>("it")
  const [isGridView, setIsGridView] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [todoToDelete, setTodoToDelete] = useState<Todo | null>(null)
  const [todoHistory, setTodoHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyHasMore, setHistoryHasMore] = useState(false)
  const historyLimit = 5
  const [creating, setCreating] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [editSelectedFiles, setEditSelectedFiles] = useState<File[]>([])
  const [activeTodo, setActiveTodo] = useState<Todo | null>(null)
  const [newTodo, setNewTodo] = useState({
    title: "",
    description: "",
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour later
    allDay: false,
    repeat: "Once",
    department: "it",
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    if (userData?.uid) {
      fetchTodos()
    }
  }, [userData])

  // Helper function to convert timestamp to ISO string
  const timestampToISOString = (timestamp: Timestamp | string): string => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toISOString()
    }
    return timestamp
  }

  // Helper function to convert ISO string to Date for display
  const getDateForDisplay = (timestamp: Timestamp | string): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate()
    }
    return new Date(timestamp)
  }

  // Validation for start date/time not being after end date/time
  useEffect(() => {
    if (newTodo.start_date && newTodo.end_date) {
      const startDateTime = new Date(timestampToISOString(newTodo.start_date))
      const endDateTime = new Date(timestampToISOString(newTodo.end_date))

      if (startDateTime > endDateTime) {
        // Auto-adjust end date/time to be after start
        const newEndDateTime = new Date(startDateTime.getTime() + (60 * 60 * 1000)) // Add 1 hour
        setNewTodo(prev => ({
          ...prev,
          end_date: newEndDateTime.toISOString()
        }))
      }
    }
  }, [newTodo.start_date, newTodo.end_date])

  const fetchTodos = async () => {
    if (!userData?.uid) return

    try {
      setLoading(true)
      const fetchedTodos = await getTodosByUser(userData.uid, userData.company_id || undefined)
      setTodos(fetchedTodos)
    } catch (error) {
      console.error("Error fetching todos:", error)
      toast.error("Failed to load todos")
    } finally {
      setLoading(false)
    }
  }

  const filteredTodos = todos.filter(
    (todo) => {
      const matchesSearch = todo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        todo.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesDepartment = selectedDepartment === "all" || todo.department === selectedDepartment
      return matchesSearch && matchesDepartment
    }
  )

  const handleCreateTodo = async () => {
    if (!userData?.uid || !userData?.company_id) {
      toast.error("User not authenticated")
      return
    }

    try {
      setCreating(true)

      // Upload files if any
      let attachmentUrls: string[] = []
      if (selectedFiles.length > 0) {
        toast.info("Uploading files...")
        attachmentUrls = await uploadFiles(selectedFiles)
      }

      const todoData = {
          title: newTodo.title || "New Task",
          description: newTodo.description,
          start_date: Timestamp.fromDate(new Date(newTodo.start_date)),
          end_date: Timestamp.fromDate(new Date(newTodo.end_date)),
          allDay: newTodo.allDay,
          repeat: newTodo.repeat,
          completed: false,
          status: "todo" as const,
          company_id: userData.company_id,
          user_id: userData.uid,
          department: newTodo.department,
          attachments: attachmentUrls,
          isDeleted: false,
        }

      const todoId = await createTodo(todoData)
      toast.success("Todo created successfully")

      // Reset form
      setNewTodo({
        title: "",
        description: "",
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour later
        allDay: false,
        repeat: "Once",
        department: "it",
      })
      setSelectedFiles([])
      setIsDialogOpen(false)

      // Refresh todos
      await fetchTodos()
    } catch (error) {
      console.error("Error creating todo:", error)
      toast.error("Failed to create todo")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleComplete = async (id: string) => {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return

    try {
      await toggleTodoComplete(id, !todo.completed)
      // Update local state
      setTodos(todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
      toast.success(`Todo ${!todo.completed ? "completed" : "marked as incomplete"}`)
    } catch (error) {
      console.error("Error toggling todo:", error)
      toast.error("Failed to update todo")
    }
  }

  const handleStatusChange = async (id: string, newStatus: Todo["status"]) => {
    try {
      const currentTodo = todos.find((t) => t.id === id)
      if (!currentTodo) {
        throw new Error("Todo not found")
      }

      const oldStatus = currentTodo.status

      // Only proceed if status is actually changing
      if (oldStatus === newStatus) {
        return
      }

      await updateTodo(id, { status: newStatus })

      // Update local state
      setTodos(todos.map((t) => (t.id === id ? { ...t, status: newStatus } : t)))

      // Create history record
      if (userData) {
        const fullName = `${userData.first_name || ""} ${userData.middle_name || ""} ${userData.last_name || ""}`.trim()
        await createTodoHistory(id, oldStatus, newStatus, userData.uid, fullName, userData.company_id || undefined)
      }

      toast.success(`Todo moved to ${newStatus.replace("-", " ")}`)
    } catch (error) {
      console.error("Error updating todo status:", error)
      toast.error("Failed to update todo status")
    }
  }

  const handleDragStart = (e: React.DragEvent, todo: Todo) => {
    e.dataTransfer.setData("text/plain", todo.id)
    setActiveTodo(todo)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, newStatus: Todo["status"]) => {
    e.preventDefault()
    const todoId = e.dataTransfer.getData("text/plain")

    const currentTodo = todos.find((t) => t.id === todoId)
    if (!currentTodo || currentTodo.status === newStatus) {
      setActiveTodo(null)
      return
    }

    await handleStatusChange(todoId, newStatus)
    setActiveTodo(null)
  }

  const fetchTodoHistory = async (todoId: string, page: number = 1) => {
    try {
      setLoadingHistory(true)
      const result = await getTodoHistory(todoId, page, historyLimit)
      setTodoHistory(result.history)
      setHistoryTotal(result.total)
      setHistoryHasMore(result.hasMore)
      setHistoryPage(page)
    } catch (error) {
      console.error("Error fetching todo history:", error)
      setTodoHistory([])
      setHistoryTotal(0)
      setHistoryHasMore(false)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleTodoClick = async (todo: Todo) => {
    setSelectedTodo(todo)
    setIsDetailDialogOpen(true)

    // Fetch todo history
    await fetchTodoHistory(todo.id, 1)
  }

  const handleEditTodo = (todo: Todo) => {
    setSelectedTodo(todo)
    setEditSelectedFiles([])
    setIsEditDialogOpen(true)
  }

  const handleDeleteTodo = (todo: Todo) => {
    setTodoToDelete(todo)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!todoToDelete) return

    try {
      await updateTodo(todoToDelete.id, { isDeleted: true })
      setTodos(todos.filter((t) => t.id !== todoToDelete.id))
      toast.success("Todo deleted successfully")
      setIsDeleteDialogOpen(false)
      setTodoToDelete(null)
    } catch (error) {
      console.error("Error deleting todo:", error)
      toast.error("Failed to delete todo")
    }
  }

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const uploadPromises = files.map(async (file) => {
      const storageRef = ref(storage, `todos/${userData?.uid}/${Date.now()}_${file.name}`)
      await uploadBytes(storageRef, file)
      return getDownloadURL(storageRef)
    })
    return Promise.all(uploadPromises)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">To-Do-List</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-gray-600">{filteredTodos.filter(t => t.status === "todo").length}</div>
            <div className="text-sm text-gray-500">To Do</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{filteredTodos.filter(t => t.status === "in-progress").length}</div>
            <div className="text-sm text-gray-500">In Progress</div>
          </div>
          <div className="bg-white p-4 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{filteredTodos.filter(t => t.status === "done").length}</div>
            <div className="text-sm text-gray-500">Done</div>
          </div>
        </div>

        {/* Kanban Board */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading todos...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* To Do Column */}
              <DroppableColumn
                id="todo"
                title="To Do"
                count={filteredTodos.filter(t => t.status === "todo").length}
                {...getStatusColors("todo")}
                onDrop={handleDrop}
              >
                {filteredTodos.filter(t => t.status === "todo").map((todo) => (
                  <DraggableTodoCard
                    key={todo.id}
                    todo={todo}
                    onStatusChange={handleStatusChange}
                    onDragStart={handleDragStart}
                    onClick={handleTodoClick}
                    onEdit={handleEditTodo}
                    onDelete={handleDeleteTodo}
                  />
                ))}
              </DroppableColumn>

              {/* In Progress Column */}
              <DroppableColumn
                id="in-progress"
                title="In Progress"
                count={filteredTodos.filter(t => t.status === "in-progress").length}
                {...getStatusColors("in-progress")}
                onDrop={handleDrop}
              >
                {filteredTodos.filter(t => t.status === "in-progress").map((todo) => (
                  <DraggableTodoCard
                    key={todo.id}
                    todo={todo}
                    onStatusChange={handleStatusChange}
                    onDragStart={handleDragStart}
                    onClick={handleTodoClick}
                    onEdit={handleEditTodo}
                    onDelete={handleDeleteTodo}
                  />
                ))}
              </DroppableColumn>

              {/* Done Column */}
              <DroppableColumn
                id="done"
                title="Done"
                count={filteredTodos.filter(t => t.status === "done").length}
                {...getStatusColors("done")}
                onDrop={handleDrop}
              >
                {filteredTodos.filter(t => t.status === "done").map((todo) => (
                  <DraggableTodoCard
                    key={todo.id}
                    todo={todo}
                    onStatusChange={handleStatusChange}
                    onDragStart={handleDragStart}
                    onClick={handleTodoClick}
                    onEdit={handleEditTodo}
                    onDelete={handleDeleteTodo}
                  />
                ))}
              </DroppableColumn>
            </div>
        )}

        {/* Floating Add Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md border-2 border-yellow-300">
            <DialogHeader>
              <DialogTitle className="sr-only">Create New Todo</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="Write here..."
                value={`${newTodo.title}${newTodo.description ? "\n" + newTodo.description : ""}`}
                onChange={(e) => {
                  const lines = e.target.value.split("\n")
                  setNewTodo({
                    ...newTodo,
                    title: lines[0] || "",
                    description: lines.slice(1).join("\n"),
                  })
                }}
                className="min-h-[120px] resize-none border-gray-300"
              />

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-medium">All Day:</label>
                  <Switch
                    checked={newTodo.allDay}
                    onCheckedChange={(checked) => setNewTodo({ ...newTodo, allDay: checked })}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">Start Date & Time:</label>
                  <Input
                    type="datetime-local"
                    value={newTodo.start_date.slice(0, 16)}
                    onChange={(e) => setNewTodo({ ...newTodo, start_date: e.target.value })}
                    className="w-auto"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">End Date & Time:</label>
                  <Input
                    type="datetime-local"
                    value={newTodo.end_date.slice(0, 16)}
                    onChange={(e) => setNewTodo({ ...newTodo, end_date: e.target.value })}
                    className="w-auto"
                    min={newTodo.start_date.slice(0, 16)}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">Repeat:</label>
                  <Select value={newTodo.repeat} onValueChange={(value) => setNewTodo({ ...newTodo, repeat: value })}>
                    <SelectTrigger className="w-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Once">Once</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Every December">Every December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="space-y-2">
                <label className="font-medium">Attachments (Optional)</label>
                <FileUpload
                  onFileSelect={setSelectedFiles}
                  maxFiles={5}
                  maxSize={10 * 1024 * 1024} // 10MB
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreateTodo} disabled={creating || !newTodo.title.trim()} className="flex-1 bg-blue-500 hover:bg-blue-600">
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Todo Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md border-2 border-blue-300">
            <DialogHeader>
              <DialogTitle className="sr-only">Edit Todo</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Textarea
                placeholder="Write here..."
                value={selectedTodo ? `${selectedTodo.title}${selectedTodo.description ? "\n" + selectedTodo.description : ""}` : ""}
                onChange={(e) => {
                  if (!selectedTodo) return
                  const lines = e.target.value.split("\n")
                  setSelectedTodo({
                    ...selectedTodo,
                    title: lines[0] || "",
                    description: lines.slice(1).join("\n"),
                  })
                }}
                className="min-h-[120px] resize-none border-gray-300"
              />

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-medium">All Day:</label>
                  <Switch
                    checked={selectedTodo?.allDay || false}
                    onCheckedChange={(checked) => {
                      if (!selectedTodo) return
                      setSelectedTodo({ ...selectedTodo, allDay: checked })
                    }}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">Start Date & Time:</label>
                  <Input
                    type="datetime-local"
                    value={selectedTodo?.start_date ? timestampToISOString(selectedTodo.start_date).slice(0, 16) : ""}
                    onChange={(e) => {
                      if (!selectedTodo) return
                      setSelectedTodo({ ...selectedTodo, start_date: e.target.value })
                    }}
                    className="w-auto"
                    min={new Date().toISOString().slice(0, 16)}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">End Date & Time:</label>
                  <Input
                    type="datetime-local"
                    value={selectedTodo?.end_date ? timestampToISOString(selectedTodo.end_date).slice(0, 16) : ""}
                    onChange={(e) => {
                      if (!selectedTodo) return
                      setSelectedTodo({ ...selectedTodo, end_date: e.target.value })
                    }}
                    className="w-auto"
                    min={selectedTodo?.start_date ? timestampToISOString(selectedTodo.start_date).slice(0, 16) : ""}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label className="font-medium">Repeat:</label>
                  <Select
                    value={selectedTodo?.repeat || "Once"}
                    onValueChange={(value) => {
                      if (!selectedTodo) return
                      setSelectedTodo({ ...selectedTodo, repeat: value })
                    }}
                  >
                    <SelectTrigger className="w-auto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Once">Once</SelectItem>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Every December">Every December</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="space-y-2">
                <label className="font-medium">Attachments (Optional)</label>
                <FileUpload
                  onFileSelect={setEditSelectedFiles}
                  maxFiles={5}
                  maxSize={10 * 1024 * 1024} // 10MB
                />
                {selectedTodo?.attachments && selectedTodo.attachments.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Current attachments: {selectedTodo.attachments.length} file(s)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedTodo.attachments.map((attachment, index) => (
                        <div key={index} className="border rounded-lg p-2 bg-gray-50">
                          <img
                            src={attachment}
                            alt={`Attachment ${index + 1}`}
                            className="w-full h-20 object-cover rounded mb-2"
                            onError={(e) => {
                              e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0IDE0SDhWMThIMTZWMTJIMTRWMTRaTTEyIDIuQzYuNDggMiAyIDYuNDggMiAxMlMxMCAxNy41MiAxMiAxNy41MlMxNy41MiAxNy41MkwxMiAyWk0xMiAyMEMxNi45NzMgMjAgMjAgMTYuOTczIDIwIDEyUzE2Ljk3MyA0IDEyIDRDNy4wMjcgNCA0IDcuMDI3IDQgMTJTNy4wMjcgMjAgMTIgMjBaIiBmaWxsPSIjOWNhM2FmIi8+Cjwvc3ZnPgo="
                            }}
                          />
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(attachment, '_blank')}
                              className="flex-1"
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (!selectedTodo) return
                                const newAttachments = selectedTodo.attachments?.filter((_, i) => i !== index) || []
                                setSelectedTodo({ ...selectedTodo, attachments: newAttachments })
                              }}
                              className="flex-1"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!selectedTodo) return

                    try {
                      let newAttachmentUrls: string[] = []
                      if (editSelectedFiles.length > 0) {
                        toast.info("Uploading new files...")
                        newAttachmentUrls = await uploadFiles(editSelectedFiles)
                      }

                      const currentAttachments = selectedTodo.attachments || []
                      const updatedAttachments = [...currentAttachments, ...newAttachmentUrls]

                      const updates = {
                          title: selectedTodo.title,
                          description: selectedTodo.description,
                          start_date: Timestamp.fromDate(getDateForDisplay(selectedTodo.start_date)),
                          end_date: Timestamp.fromDate(getDateForDisplay(selectedTodo.end_date)),
                          allDay: selectedTodo.allDay,
                          repeat: selectedTodo.repeat,
                          department: selectedTodo.department,
                          attachments: updatedAttachments,
                        }

                      await updateTodo(selectedTodo.id, updates)
                      setTodos(todos.map((t) => (t.id === selectedTodo.id ? { ...t, ...updates } : t)))
                      toast.success("Todo updated successfully")
                      setIsEditDialogOpen(false)
                      setEditSelectedFiles([])
                    } catch (error) {
                      console.error("Error updating todo:", error)
                      toast.error("Failed to update todo")
                    }
                  }}
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                >
                  Update
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Todo</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{todoToDelete?.title}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Todo Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Todo Details</DialogTitle>
            </DialogHeader>

            {selectedTodo && (
              <div className="space-y-6">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">{selectedTodo.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedTodo.description && (
                      <div>
                        <h4 className="font-semibold mb-2">Description</h4>
                        <p className="text-gray-700">{selectedTodo.description}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-1">Start Date & Time</h4>
                        <p>{getDateForDisplay(selectedTodo.start_date).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">End Date & Time</h4>
                        <p>{getDateForDisplay(selectedTodo.end_date).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Status</h4>
                        <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                          selectedTodo.status === "todo" ? "bg-gray-100 text-gray-800" :
                          selectedTodo.status === "in-progress" ? "bg-blue-100 text-blue-800" :
                          "bg-green-100 text-green-800"
                        }`}>
                          {selectedTodo.status.replace("-", " ").toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">All Day</h4>
                        <p>{selectedTodo.allDay ? "Yes" : "No"}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Repeat</h4>
                        <p>{selectedTodo.repeat}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Department</h4>
                        <p>IT</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-1">Created</h4>
                        <p>{selectedTodo.created_at?.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-1">Last Updated</h4>
                        <p>{selectedTodo.updated_at?.toLocaleDateString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Attachments */}
                {selectedTodo.attachments && selectedTodo.attachments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Attachments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedTodo.attachments.map((attachment, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <img
                              src={attachment}
                              alt={`Attachment ${index + 1}`}
                              className="w-full h-48 object-cover rounded mb-2"
                              onError={(e) => {
                                // If image fails to load, show a placeholder
                                e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE0IDE0SDhWMThIMTZWMTJIMTRWMTRaTTEyIDIuQzYuNDggMiAyIDYuNDggMiAxMlMxMCAxNy41MiAxMiAxNy41MlMxNy41MiAxNy41MkwxMiAyWk0xMiAyMEMxNi45NzMgMjAgMjAgMTYuOTczIDIwIDEyUzE2Ljk3MyA0IDEyIDRDNy4wMjcgNCA0IDcuMDI3IDQgMTJTNy4wMjcgMjAgMTIgMjBaIiBmaWxsPSIjOWNhM2FmIi8+Cjwvc3ZnPgo="
                              }}
                            />
                            <div className="flex justify-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(attachment)
                                    const blob = await response.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const link = document.createElement('a')
                                    link.href = url
                                    link.download = `attachment_${index + 1}`
                                    document.body.appendChild(link)
                                    link.click()
                                    document.body.removeChild(link)
                                    window.URL.revokeObjectURL(url)
                                  } catch (error) {
                                    console.error('Download failed:', error)
                                    // Fallback to opening in new tab
                                    window.open(attachment, '_blank')
                                  }
                                }}
                                className="w-full"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Todo History */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Movement History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingHistory ? (
                      <div className="flex justify-center items-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading history...</span>
                      </div>
                    ) : todoHistory.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {todoHistory.map((history, index) => (
                            <div key={history.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">{history.user_full_name}</div>
                                  <div className="text-gray-600">
                                    Moved from <span className="font-medium">{history.from_column.replace("-", " ")}</span> to{" "}
                                    <span className="font-medium">{history.to_column.replace("-", " ")}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                {history.created_at?.toLocaleDateString()} {history.created_at?.toLocaleTimeString()}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Pagination Controls */}
                        {historyTotal > historyLimit && (
                          <div className="flex items-center justify-between mt-4">
                            <div className="text-sm text-gray-500">
                              Showing {((historyPage - 1) * historyLimit) + 1}-{Math.min(historyPage * historyLimit, historyTotal)} of {historyTotal} entries
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (selectedTodo && historyPage > 1) {
                                    fetchTodoHistory(selectedTodo.id, historyPage - 1)
                                  }
                                }}
                                disabled={historyPage <= 1 || loadingHistory}
                              >
                                Previous
                              </Button>
                              <span className="text-sm text-gray-600">
                                Page {historyPage} of {Math.max(1, Math.ceil(historyTotal / historyLimit))}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (selectedTodo && historyHasMore) {
                                    fetchTodoHistory(selectedTodo.id, historyPage + 1)
                                  }
                                }}
                                disabled={!historyHasMore || loadingHistory}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No movement history found
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}