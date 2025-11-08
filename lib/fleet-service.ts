import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Fleet } from "@/types/fleet"

// Fleet service functions for Firestore operations
export class FleetService {
  private static collectionName = "fleet"

  // Get all fleet vehicles
  static async getAllVehicles(): Promise<Fleet[]> {
    try {
      const fleetCollection = collection(db, this.collectionName)
      const q = query(fleetCollection, orderBy("createdAt", "desc"))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        purchaseDate: doc.data().purchaseDate?.toDate(),
        insuranceExpiry: doc.data().insuranceExpiry?.toDate(),
        registrationExpiry: doc.data().registrationExpiry?.toDate(),
      })) as Fleet[]
    } catch (error) {
      console.error("Error fetching fleet vehicles:", error)
      throw new Error("Failed to fetch fleet vehicles")
    }
  }

  // Get a single vehicle by ID
  static async getVehicleById(id: string): Promise<Fleet | null> {
    try {
      const docRef = doc(db, this.collectionName, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
          purchaseDate: data.purchaseDate?.toDate(),
          insuranceExpiry: data.insuranceExpiry?.toDate(),
          registrationExpiry: data.registrationExpiry?.toDate(),
        } as Fleet
      }

      return null
    } catch (error) {
      console.error("Error fetching vehicle:", error)
      throw new Error("Failed to fetch vehicle")
    }
  }

  // Create a new vehicle
  static async createVehicle(vehicleData: Omit<Fleet, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const fleetCollection = collection(db, this.collectionName)

      // Convert date strings to Firestore timestamps
      const dataToSave = {
        ...vehicleData,
        purchaseDate: vehicleData.purchaseDate ? new Date(vehicleData.purchaseDate) : null,
        insuranceExpiry: vehicleData.insuranceExpiry ? new Date(vehicleData.insuranceExpiry) : null,
        registrationExpiry: vehicleData.registrationExpiry ? new Date(vehicleData.registrationExpiry) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      const docRef = await addDoc(fleetCollection, dataToSave)
      return docRef.id
    } catch (error) {
      console.error("Error creating vehicle:", error)
      throw new Error("Failed to create vehicle")
    }
  }

  // Update a vehicle
  static async updateVehicle(id: string, vehicleData: Partial<Omit<Fleet, "id" | "createdAt">>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id)

      // Convert date strings to Firestore timestamps
      const dataToUpdate = {
        ...vehicleData,
        purchaseDate: vehicleData.purchaseDate ? new Date(vehicleData.purchaseDate) : undefined,
        insuranceExpiry: vehicleData.insuranceExpiry ? new Date(vehicleData.insuranceExpiry) : undefined,
        registrationExpiry: vehicleData.registrationExpiry ? new Date(vehicleData.registrationExpiry) : undefined,
        updatedAt: serverTimestamp(),
      }

      // Remove undefined values
      Object.keys(dataToUpdate).forEach((key) => {
        if (dataToUpdate[key as keyof typeof dataToUpdate] === undefined) {
          delete dataToUpdate[key as keyof typeof dataToUpdate]
        }
      })

      await updateDoc(docRef, dataToUpdate)
    } catch (error) {
      console.error("Error updating vehicle:", error)
      throw new Error("Failed to update vehicle")
    }
  }

  // Delete a vehicle
  static async deleteVehicle(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, id)
      await deleteDoc(docRef)
    } catch (error) {
      console.error("Error deleting vehicle:", error)
      throw new Error("Failed to delete vehicle")
    }
  }

  // Search vehicles by various criteria
  static async searchVehicles(searchTerm: string): Promise<Fleet[]> {
    try {
      const fleetCollection = collection(db, this.collectionName)
      const querySnapshot = await getDocs(fleetCollection)

      const vehicles = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        purchaseDate: doc.data().purchaseDate?.toDate(),
        insuranceExpiry: doc.data().insuranceExpiry?.toDate(),
        registrationExpiry: doc.data().registrationExpiry?.toDate(),
      })) as Fleet[]

      // Filter vehicles based on search term
      return vehicles.filter(
        (vehicle) =>
          vehicle.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehicle.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehicle.assignedDriver?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vehicle.currentLocation?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    } catch (error) {
      console.error("Error searching vehicles:", error)
      throw new Error("Failed to search vehicles")
    }
  }

  // Filter vehicles by status
  static async getVehiclesByStatus(status: string): Promise<Fleet[]> {
    try {
      const fleetCollection = collection(db, this.collectionName)
      const q = query(fleetCollection, where("status", "==", status), orderBy("createdAt", "desc"))
      const querySnapshot = await getDocs(q)

      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        purchaseDate: doc.data().purchaseDate?.toDate(),
        insuranceExpiry: doc.data().insuranceExpiry?.toDate(),
        registrationExpiry: doc.data().registrationExpiry?.toDate(),
      })) as Fleet[]
    } catch (error) {
      console.error("Error fetching vehicles by status:", error)
      throw new Error("Failed to fetch vehicles by status")
    }
  }
}
