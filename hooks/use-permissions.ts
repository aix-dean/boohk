"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../contexts/auth-context"
import { hasPermission, getUserRoles, isAdmin, type RoleType } from "../lib/hardcoded-access-service"

export function usePermission(module: string, action: "view" | "create" | "edit" | "delete") {
  const { user } = useAuth()
  const [hasAccess, setHasAccess] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function checkPermission() {
      if (!user) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      try {
        const permitted = await hasPermission(user.uid, module, action)
        setHasAccess(permitted)
      } catch (error) {
        console.error("Error checking permission:", error)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [user, module, action])

  return { hasAccess, loading }
}

export function useUserRoles() {
  const { user } = useAuth()
  const [roles, setRoles] = useState<RoleType[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function fetchUserRoles() {
      if (!user) {
        setRoles([])
        setLoading(false)
        return
      }

      try {
        const userRoles = await getUserRoles(user.uid)
        setRoles(userRoles)
      } catch (error) {
        console.error("Error fetching user roles:", error)
        setRoles([])
      } finally {
        setLoading(false)
      }
    }

    fetchUserRoles()
  }, [user])

  return { roles, loading }
}

export function useIsAdmin() {
  const { user } = useAuth()
  const [isUserAdmin, setIsUserAdmin] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    async function checkAdminStatus() {
      if (!user) {
        setIsUserAdmin(false)
        setLoading(false)
        return
      }

      try {
        const adminStatus = await isAdmin(user.uid)
        setIsUserAdmin(adminStatus)
      } catch (error) {
        console.error("Error checking admin status:", error)
        setIsUserAdmin(false)
      } finally {
        setLoading(false)
      }
    }

    checkAdminStatus()
  }, [user])

  return { isAdmin: isUserAdmin, loading }
}

export function useHasRole(requiredRoles: RoleType[]) {
  const { roles, loading } = useUserRoles()
  const [hasRequiredRole, setHasRequiredRole] = useState<boolean>(false)

  useEffect(() => {
    if (!loading) {
      const hasRole = requiredRoles.some((role) => roles.includes(role))
      setHasRequiredRole(hasRole)
    }
  }, [roles, loading, requiredRoles])

  return { hasRole: hasRequiredRole, loading }
}
