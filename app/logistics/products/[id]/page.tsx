import ProductDetailPage from "@/app/sales/products/[id]/page"

export default function LogisticsProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <ProductDetailPage params={params} />
}