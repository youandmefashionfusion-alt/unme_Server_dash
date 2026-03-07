import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";

export async function GET(request) {
  try {
    // Connect to the database
    await connectDb();

    // Fetch only the required fields from the Product model
    const products = await ProductModel.find({}, "title category brand collectionName");

    // Build the `words` array
    const words = [];
    products.forEach((product) => {
      const { title, category, brand, collectionName } = product;

      // Push each field as an object with name (lowercase) and value (original)
      if (title) {
        words.push({ name: title.toLowerCase(), value: title });
      }
      if (category) {
        words.push({ name: category.toLowerCase(), value: category });
      }
      if (brand) {
        words.push({ name: brand.toLowerCase(), value: brand });
      }
      if (collectionName) {
        words.push({ name: collectionName.toLowerCase(), value: collectionName });
      }
    });

    // Remove duplicates from the `words` array
    const uniqueWords = words.filter(
      (item, index, self) =>
        index ===
        self.findIndex(
          (t) => t.name === item.name && t.value === item.value
        )
    );

    return Response.json({ success: true, words: uniqueWords }, { status: 200 });
  } catch (error) {
    console.error("Error fetching words:", error.message);
    return Response.json(
      { success: false, error: "Failed to fetch words" },
      { status: 500 }
    );
  }
}
