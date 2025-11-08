"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft } from "lucide-react"
import { format } from "date-fns"
import type { Product } from "@/lib/firebase-service"
import type { JobOrder } from "@/lib/types/job-order"
import { teamsService } from "@/lib/teams-service"
import type { Team } from "@/lib/types/team"
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

import { ServiceAssignmentViewForm } from '@/components/logistics/assignments/view/ServiceAssignmentViewForm';

export default function ViewServiceAssignmentPage() {
  const { user, userData } = useAuth()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const assignmentId = params.id as string

  const [loading, setLoading] = useState(true)
  const [assignmentData, setAssignmentData] = useState<any>(null)
  const [jobOrderId, setJobOrderId] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [jobOrderData, setJobOrderData] = useState<JobOrder | null>(null)

  // Fetch assignment data
  useEffect(() => {
    const fetchAssignment = async () => {
      if (!assignmentId) return

      try {
        setLoading(true)
        const assignmentDoc = await getDoc(doc(db, "service_assignments", assignmentId))

        if (assignmentDoc.exists()) {
          const data = { id: assignmentDoc.id, ...assignmentDoc.data() } as any
          setAssignmentData(data)

          // Fetch job order if present
          if (data.jobOrderId) {
            const jobOrderDoc = await getDoc(doc(db, "job_orders", data.jobOrderId))
            if (jobOrderDoc.exists()) {
              setJobOrderData({ id: jobOrderDoc.id, ...jobOrderDoc.data() } as JobOrder)
            }
          }
        } else {
          toast({
            title: "Assignment not found",
            description: "The service assignment you're looking for doesn't exist.",
            variant: "destructive",
          })
          router.push("/logistics/assignments")
        }
      } catch (error) {
        console.error("Error fetching assignment:", error)
        toast({
          title: "Error",
          description: "Failed to load service assignment.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAssignment()
  }, [assignmentId, router, toast])

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, "products")
        const q = query(productsRef, where("deleted", "==", false), orderBy("name", "asc"), limit(100))
        const querySnapshot = await getDocs(q)

        const fetchedProducts: Product[] = []
        querySnapshot.forEach((doc) => {
          fetchedProducts.push({ id: doc.id, ...doc.data() } as Product)
        })

        setProducts(fetchedProducts)
      } catch (error) {
        console.error("Error fetching products:", error)
      }
    }

    fetchProducts()
  }, [])

  // Fetch teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsData = await teamsService.getAllTeams()
        const activeTeams = teamsData.filter((team) => team.status === "active")
        setTeams(activeTeams)
      } catch (error) {
        console.error("Error fetching teams:", error)
      }
    }

    fetchTeams()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto py-4">
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Loading assignment...</span>
        </div>
      </div>
    )
  }

  if (!assignmentData) {
    return (
      <div className="container mx-auto py-4">
        <div className="flex justify-center items-center py-8">
          <span className="text-gray-500">Assignment not found</span>
        </div>
      </div>
    )
  }

  return (
    <section className="p-8 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">
          View Service Assignment
        </h1>
      </div>

      {/* Form Card */}
      <ServiceAssignmentViewForm
        assignmentData={assignmentData}
        products={products}
        teams={teams}
        jobOrderData={jobOrderData}
      />
    </section>
  )
}