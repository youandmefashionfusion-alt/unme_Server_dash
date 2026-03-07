import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  try {
    await connectDb();

    // Extract query parameters
    const search = searchParams.get("search");
    const colors = searchParams.get("color")?.split(",").filter(Boolean) || [];
    const genders = searchParams.get("gender")?.split(",").filter(Boolean) || [];
    const materials = searchParams.get("material")?.split(",").filter(Boolean) || [];
    const types = searchParams.get("type")?.split(",").filter(Boolean) || [];
    const state = searchParams.get("state");
    const limit = parseInt(searchParams.get("limit")) || 16;
    const sort = searchParams.get("sort") || "-createdAt";
    const page = parseInt(searchParams.get("page")) || 1;

    if (!search) {
      return Response.json(
        { success: false, error: "Search query is required" },
        { status: 400 }
      );
    }

    // Create case-insensitive regex patterns
    const createCaseInsensitiveRegex = (pattern) => new RegExp(pattern, "i");

    // Construct search query based on your schema
    const searchKeywords = search
      .toLowerCase()
      .split(" ")
      .filter(Boolean);

    const baseQuery = {
      $and: searchKeywords.map((keyword) => ({
        $or: [
          { title: createCaseInsensitiveRegex(keyword) },
          { sku: createCaseInsensitiveRegex(keyword) },
          { description: createCaseInsensitiveRegex(keyword) },
          { collectionHandle: createCaseInsensitiveRegex(keyword) },
          // Search in array fields
          { color: { $elemMatch: { $regex: keyword, $options: "i" } } },
          { material: { $elemMatch: { $regex: keyword, $options: "i" } } },
          { type: { $elemMatch: { $regex: keyword, $options: "i" } } },
          { necklaceType: { $elemMatch: { $regex: keyword, $options: "i" } } },
          { ringDesign: { $elemMatch: { $regex: keyword, $options: "i" } } },
        ],
      })),
    };

    // Add state filter
    if (state) {
      baseQuery.$and.push({ state: "active" });
    }

    // Add filters based on your schema
    if (colors.length > 0) {
      baseQuery.$and.push({
        color: { $in: colors.map(color => createCaseInsensitiveRegex(color)) }
      });
    }

    if (genders.length > 0) {
      baseQuery.$and.push({
        gender: { $in: genders.map(gender => createCaseInsensitiveRegex(gender)) }
      });
    }

    if (materials.length > 0) {
      baseQuery.$and.push({
        material: { $in: materials.map(material => createCaseInsensitiveRegex(material)) }
      });
    }

    if (types.length > 0) {
      baseQuery.$and.push({
        type: { $in: types.map(type => createCaseInsensitiveRegex(type)) }
      });
    }

    // Get initial results for available filters (without current filters)
    const initialFilterQuery = {
      $and: searchKeywords.map((keyword) => ({
        $or: [
          { title: createCaseInsensitiveRegex(keyword) },
          { sku: createCaseInsensitiveRegex(keyword) },
          { description: createCaseInsensitiveRegex(keyword) },
          { collectionHandle: createCaseInsensitiveRegex(keyword) },
        ],
      })),
    };

    if (state) {
      initialFilterQuery.state = "active";
    }

    const initialResults = await ProductModel.find(initialFilterQuery);

    // Extract available filters based on your schema
    const availableFilters = {
      genders: [...new Set(initialResults.map(p => p.gender).filter(Boolean))].sort(),
      colors: [...new Set(initialResults.flatMap(p => p.color).filter(Boolean))].sort(),
      materials: [...new Set(initialResults.flatMap(p => p.material).filter(Boolean))].sort(),
      types: [...new Set(initialResults.flatMap(p => p.type).filter(Boolean))].sort(),
    };

    // Define sort criteria
    let sortCriteria = {};
    switch (sort) {
      case "price":
        sortCriteria = { price: 1 };
        break;
      case "-price":
        sortCriteria = { price: -1 };
        break;
      case "title":
        sortCriteria = { title: 1 };
        break;
      case "-title":
        sortCriteria = { title: -1 };
        break;
      case "createdAt":
        sortCriteria = { createdAt: 1 };
        break;
      case "-createdAt":
      default:
        sortCriteria = { createdAt: -1 };
    }

    // Get paginated results
    const products = await ProductModel.find(baseQuery)
      .sort(sortCriteria)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('collectionName', 'title handle'); // Populate collection data if needed

    const totalProducts = await ProductModel.countDocuments(baseQuery);
    const totalPages = Math.ceil(totalProducts / limit);

    return Response.json(
      {
        success: true,
        products,
        filters: availableFilters,
        pagination: {
          currentPage: page,
          totalPages,
          totalProducts,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        searchQuery: search
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching products:", error.message);
    return Response.json(
      { 
        success: false, 
        error: "Failed to fetch products", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}