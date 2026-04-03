import ProductModel from "../../../../models/productModel";
import connectDb from "../../../../config/connectDb";

export const config = {
  maxDuration: 20,
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  try {
    await connectDb();

    let query = {};
    const stateParam = (searchParams.get("state") || "").trim().toLowerCase();
    if (stateParam && stateParam !== "all") {
      query.state = stateParam;
    }

    // Filtering by collectionHandle
    if (searchParams.get("collectionHandle")) {
      query.collectionHandle = searchParams.get("collectionHandle");
    }

    // Search functionality
    if (searchParams.get("search")) {
      const searchKeywords = searchParams.get("search").toLowerCase().split(" ");
      const searchConditions = [];

      searchKeywords.forEach((keyword) => {
        let regexPattern = new RegExp(`^${keyword}$`, "i");
        if (regexPattern) {
          searchConditions.push({
            $or: [
              { title: { $regex: regexPattern } },
              { description: { $regex: regexPattern } },
              { sku: { $regex: regexPattern } },
            ],
          });
        }
      });

      if (searchConditions.length > 0) {
        query.$and = searchConditions;
      }
    }

    // Sorting
    const sortQuery = searchParams.get("sort");
    let sortCriteria = { order: 1, createdAt: -1 };
    if (sortQuery) {
      if (sortQuery === "title") sortCriteria = { title: 1 };
      else if (sortQuery === "-title") sortCriteria = { title: -1 };
      else if (sortQuery === "price") sortCriteria = { price: 1 };
      else if (sortQuery === "-price") sortCriteria = { price: -1 };
    }

    // Pagination
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 16;
    const skip = (page - 1) * limit;

    // Total documents count
    const totalDocs = await ProductModel.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limit);

    // Aggregation pipeline with collectionName populated
    let productQuery = ProductModel.aggregate([
      { $match: query },

      // Lookup to populate collection details
      {
        $lookup: {
          from: "collections",               // name of your MongoDB collection for collections
          localField: "collectionName",       // field in products (ObjectId or handle)
          foreignField: "_id",                // field in collection model
          as: "collectionName",
        },
      },
      {
        $unwind: {
          path: "$collectionName",
          preserveNullAndEmptyArrays: true,   // in case product has no collection
        },
      },

      // Add virtual fields
      {
        $addFields: {
          totalQuantity: { $sum: "$quantity" },
          isSoldOut: {
            $cond: { if: { $eq: [{ $sum: "$quantity" }, 0] }, then: 1, else: 0 },
          },
          collectionTitle: "$collectionName.title",      // add readable name
          collectionHandle: "$collectionName.handle",    // add handle
        },
      },

      { $sort: { isSoldOut: 1, ...sortCriteria } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Field projection (optional)
    if (searchParams.get("fields")) {
      const fields = searchParams
        .get("fields")
        .split(",")
        .reduce((acc, field) => {
          acc[field.trim()] = 1;
          return acc;
        }, {});
      productQuery = productQuery.project(fields);
    }

    const products = await productQuery;

    return Response.json(
      {
        success: true,
        products,
        pagination: {
          currentPage: page,
          totalPages,
          totalDocs,
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
        }
      }
    );
  } catch (error) {
    console.error("Error fetching products:", error.message);
    return Response.json(
      { success: false, error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}
