import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 })
    }

    const assignmentsRef = collection(db, 'service_assignments')
    const q = query(
      assignmentsRef,
      where('company_id', '==', companyId),
      orderBy('created', 'desc')
    )

    const querySnapshot = await getDocs(q)
    const assignments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json({ assignments })
  } catch (error) {
    console.error('Error fetching service assignments:', error)
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
  }
}