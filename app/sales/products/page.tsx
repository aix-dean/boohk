const ProductsPage = () => {
  // Dummy product data
  const products = [
    {
      id: 1,
      name: "Awesome Product 1",
      description: "This is a fantastic product that you will love.",
      imageUrl: "https://via.placeholder.com/600x400",
      price: 99.99,
    },
    {
      id: 2,
      name: "Amazing Product 2",
      description: "Another great product with amazing features.",
      imageUrl: "https://via.placeholder.com/600x400",
      price: 149.99,
    },
    {
      id: 3,
      name: "Incredible Product 3",
      description: "The most incredible product you will ever find.",
      imageUrl: "https://via.placeholder.com/600x400",
      price: 199.99,
    },
  ]

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Products</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="relative h-64 bg-gray-100 rounded-t-lg overflow-hidden aspect-[16/9]">
              <img
                src={product.imageUrl || "/placeholder.svg"}
                alt={product.name}
                className="object-cover w-full h-full"
              />
            </div>
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-2">{product.name}</h2>
              <p className="text-gray-600 text-sm mb-2">{product.description}</p>
              <p className="text-blue-500 font-bold">${product.price}</p>
              <button className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Add to Cart
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ProductsPage
