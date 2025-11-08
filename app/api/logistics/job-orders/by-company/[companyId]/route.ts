import { NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Assuming firebase initialization is here

export async function GET(
  request: Request,
  { params }: { params: { companyId: string } }
) {
  const { companyId } = params;
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('productId');

  console.log("Fetching job orders for companyId:", companyId, "and productId:", productId);

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
  }

  try {
    let jobOrdersQuery = query(
      collection(db, 'job_orders'),
      where('company_id', '==', companyId)
    );

    if (productId) {
      jobOrdersQuery = query(jobOrdersQuery, where('product_id', '==', productId));
    }

    const querySnapshot = await getDocs(jobOrdersQuery);
    const jobOrders = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log("Fetched job orders:", jobOrders); // Log fetched data
    return NextResponse.json(jobOrders);
  } catch (error) {
    console.error("Error fetching job orders from Firebase:", error);
    return NextResponse.json({ error: 'Failed to fetch job orders' }, { status: 500 });
  }
}
