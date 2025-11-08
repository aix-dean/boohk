import { db } from "./firebase"
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy, limit, startAfter } from "firebase/firestore"
import type { Todo } from "./types/todo"

const TODOS_COLLECTION = "todos"

export async function getTodosByUser(userId: string, companyId?: string, department?: string): Promise<Todo[]> {
  try {
    let q = query(
      collection(db, TODOS_COLLECTION),
      where("isDeleted", "==", false),
      orderBy("created_at", "desc"),
    )

    if (companyId) {
      q = query(q, where("company_id", "==", companyId))
    }

    if (department) {
      q = query(q, where("department", "==", department))
    }

    const querySnapshot = await getDocs(q)
    const todos: Todo[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate(),
      updated_at: doc.data().updated_at?.toDate(),
    })) as Todo[]
    return todos
  } catch (error: any) {
    console.error("Error fetching todos:", error)
    throw error
  }
}

export async function getTodoById(todoId: string): Promise<Todo | null> {
  try {
    const docRef = doc(db, TODOS_COLLECTION, todoId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        ...data,
        created_at: data.created_at?.toDate(),
        updated_at: data.updated_at?.toDate(),
      } as Todo
    } else {
      return null
    }
  } catch (error: any) {
    console.error("Error fetching todo by ID:", error)
    throw error
  }
}

export async function createTodo(
  todoData: Omit<Todo, "id" | "created_at" | "updated_at">,
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, TODOS_COLLECTION), {
      ...todoData,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    })
    console.log("Todo successfully added with ID:", docRef.id)
    return docRef.id
  } catch (error: any) {
    console.error("Error adding todo to Firestore:", error)
    throw error
  }
}

export async function updateTodo(
  todoId: string,
  updates: Partial<Omit<Todo, "id" | "created_at" | "updated_at">>,
): Promise<void> {
  try {
    const docRef = doc(db, TODOS_COLLECTION, todoId)
    await updateDoc(docRef, {
      ...updates,
      updated_at: serverTimestamp(),
    })
    console.log("Todo successfully updated:", todoId)
  } catch (error: any) {
    console.error("Error updating todo:", error)
    throw error
  }
}

export async function deleteTodo(todoId: string): Promise<void> {
  try {
    const docRef = doc(db, TODOS_COLLECTION, todoId)
    await deleteDoc(docRef)
    console.log("Todo successfully deleted:", todoId)
  } catch (error: any) {
    console.error("Error deleting todo:", error)
    throw error
  }
}

export async function toggleTodoComplete(todoId: string, completed: boolean): Promise<void> {
  try {
    await updateTodo(todoId, { completed })
  } catch (error: any) {
    console.error("Error toggling todo completion:", error)
    throw error
  }
}

export async function createTodoHistory(
  todoId: string,
  fromStatus: Todo["status"],
  toStatus: Todo["status"],
  userId: string,
  userFullName: string,
  companyId?: string
): Promise<void> {
  try {
    const historyData = {
      todo_id: todoId,
      from_column: fromStatus,
      to_column: toStatus,
      user_id: userId,
      user_full_name: userFullName,
      company_id: companyId,
      created_at: serverTimestamp(),
    }

    await addDoc(collection(db, "todos_history"), historyData)
    console.log("Todo history successfully created for todo:", todoId)
  } catch (error: any) {
    console.error("Error creating todo history:", error)
    throw error
  }
}

export async function getTodoHistory(todoId: string, page: number = 1, limit: number = 5): Promise<{ history: any[], total: number, hasMore: boolean }> {
  try {
    // Fetch all history for the todo
    const q = query(
      collection(db, "todos_history"),
      where("todo_id", "==", todoId),
      orderBy("created_at", "desc")
    )

    const querySnapshot = await getDocs(q)
    const allHistory: any[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate(),
    }))

    const total = allHistory.length
    const offset = (page - 1) * limit
    const history = allHistory.slice(offset, offset + limit)
    const hasMore = total > offset + limit

    return { history, total, hasMore }
  } catch (error: any) {
    console.error("Error fetching todo history:", error)
    throw error
  }
}