"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ChevronDown, Building2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { type RoleType } from "@/lib/hardcoded-access-service"
import { cn } from "@/lib/utils"
import { doc, onSnapshot, collection, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface DepartmentOption {
  name: string
  path: string
  role: RoleType
  color: string
}

const departmentMapping: Partial<Record<RoleType, DepartmentOption>> = {
  admin: {
    name: "Admin",
    path: "/sales/dashboard",
    role: "admin",
    color: "bg-purple-500"
  },
  it: {
    name: "IT",
    path: "/it",
    role: "it",
    color: "bg-teal-500"
  },
  sales: {
    name: "Sales",
    path: "/sales/dashboard",
    role: "sales",
    color: "bg-red-500"
  },
  logistics: {
    name: "Logistics",
    path: "/logistics/dashboard",
    role: "logistics",
    color: "bg-blue-500"
  },
  cms: {
    name: "CMS",
    path: "/cms/dashboard",
    role: "cms",
    color: "bg-orange-500"
  },
  business: {
    name: "Business Dev",
    path: "/business/inventory",
    role: "business",
    color: "bg-purple-500"
  },
  treasury: {
    name: "Treasury",
    path: "/treasury",
    role: "treasury",
    color: "bg-green-500"
  },
  accounting: {
    name: "Accounting",
    path: "/accounting/transactions",
    role: "accounting",
    color: "bg-blue-500"
  },
  finance: {
    name: "Finance",
    path: "/finance",
    role: "finance",
    color: "bg-emerald-500"
  }
}

export function DepartmentDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [userRoles, setUserRoles] = useState<RoleType[]>([])
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { userData } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Set up real-time snapshot listener for user's roles
  useEffect(() => {
    if (!userData?.uid) {
      setUserRoles([])
      return
    }

    const userRolesCollection = collection(db, "user_roles")
    const userRolesQuery = query(userRolesCollection, where("userId", "==", userData.uid))
    const unsubscribe = onSnapshot(userRolesQuery, (querySnapshot) => {
      const roles: RoleType[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.roleId && [
          "admin", "sales", "logistics", "cms", "it", "business",
          "treasury", "accounting", "finance"
        ].includes(data.roleId)) {
          roles.push(data.roleId as RoleType)
        }
      })

      setUserRoles(roles)
    }, (error) => {
      console.error("Error in user roles snapshot listener:", error)
      setUserRoles([])
    })

    return () => unsubscribe()
  }, [userData?.uid])

  if (!userRoles || userRoles.length === 0) {
    return null // Don't show dropdown if user has no roles
  }

  // Get accessible departments based on user roles
  const accessibleDepartments = userRoles
    .map(role => departmentMapping[role])
    .filter((dept): dept is DepartmentOption => dept !== undefined)
    .filter(dept => ['Sales', 'IT', 'Business Dev', 'Accounting'].includes(dept.name))
    .sort((a, b) => {
      // Prioritize Sales to be at the top
      if (a.name === 'Sales') return -1
      if (b.name === 'Sales') return 1
      return 0
    })

  if (accessibleDepartments.length === 0) {
    return null
  }

  // Find current department based on pathname
  const currentDepartment = accessibleDepartments.find(dept =>
    pathname.startsWith(`/${dept.role}`)
  ) || accessibleDepartments[0]

  const handleDepartmentSelect = (department: DepartmentOption) => {
    router.push(department.path)
    setIsOpen(false)
  }

  const handleButtonClick = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const newPosition = {
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      }
      setDropdownPosition(newPosition)
    }
    setIsOpen(!isOpen)
  }

  // useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
  //       setIsOpen(false)
  //     }
  //   }

  //   if (isOpen) {
  //     document.addEventListener('mousedown', handleClickOutside)
  //   }

  //   return () => {
  //     document.removeEventListener('mousedown', handleClickOutside)
  //   }
  // }, [isOpen])

  const hasMultipleRoles = userRoles.length > 1

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={hasMultipleRoles ? handleButtonClick : undefined}
        disabled={!hasMultipleRoles}
        className="flex items-center gap-2 text-white font-semibold text-lg w-full"
      >
        <Building2 className="h-4 w-4" />
        <span>{currentDepartment.name}</span>
        {hasMultipleRoles && (
          <ChevronDown className={cn("w-5 h-5 transition-transform", isOpen && "rotate-180")} />
        )}
      </button>

      {isOpen && hasMultipleRoles && (
        <div className="absolute top-full left-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-[9999] text-gray-900 mt-1">
          <div className="py-1">
            {accessibleDepartments.map((department) => (
              <button
                key={department.role}
                onClick={(e) => {
                  e.stopPropagation()
                  handleDepartmentSelect(department)
                }}
                className={cn(
                  "w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-50 transition-colors flex items-center space-x-3",
                  department.role === currentDepartment.role && "bg-gray-200 font-medium"
                )}
              >
                <div className={cn("w-3 h-3 rounded-full", department.color)} />
                <span>{department.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}