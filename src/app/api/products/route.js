import ProductModel from "../../../../models/productModel";
import connectDb from "../../../../config/connectDb";
import CollectionModel from "../../../../models/collectionModel";
import mongoose from "mongoose";

export const config = {
  maxDuration: 20,
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toSlugTokens = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const appendAndCondition = (query, condition) => {
  if (Array.isArray(query.$and)) {
    query.$and.push(condition);
    return;
  }
  query.$and = [condition];
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

    // Filtering by collection (supports current and legacy mappings).
    const collectionHandleParam = (searchParams.get("collectionHandle") || "").trim();
    const collectionIdParam = (searchParams.get("collectionId") || "").trim();
    if (collectionHandleParam || collectionIdParam) {
      const collectionFilters = [];

      if (collectionHandleParam) {
        // Current mapping
        collectionFilters.push({ collectionHandle: collectionHandleParam });
        // Legacy mapping where collectionName was stored as handle string.
        collectionFilters.push({ collectionName: collectionHandleParam });
      }

      if (collectionIdParam && mongoose.Types.ObjectId.isValid(collectionIdParam)) {
        collectionFilters.push({
          collectionName: new mongoose.Types.ObjectId(collectionIdParam),
        });
      } else if (collectionHandleParam) {
        const matchedCollection = await CollectionModel.findOne({
          handle: collectionHandleParam,
        })
          .select("_id")
          .lean();

        if (matchedCollection?._id) {
          collectionFilters.push({ collectionName: matchedCollection._id });
        }
      }

      const dedupedCollectionFilters = collectionFilters.filter(
        (filter, index, arr) =>
          arr.findIndex((entry) => JSON.stringify(entry) === JSON.stringify(filter)) === index
      );

      if (dedupedCollectionFilters.length === 1) {
        Object.assign(query, dedupedCollectionFilters[0]);
      } else if (dedupedCollectionFilters.length > 1) {
        query.$or = dedupedCollectionFilters;
      }
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

    // SEO-friendly type filtering:
    // supports:
    // - legacy `type=Layered Necklace`
    // - slug query `type=layered-necklace`
    // - slug query `typeHandle=layered-necklace`
    const typeParam = (
      searchParams.get("typeHandle") ||
      searchParams.get("type") ||
      ""
    ).trim();
    if (typeParam) {
      const typeTokens = toSlugTokens(typeParam);
      if (typeTokens.length > 0) {
        const pattern = typeTokens.map((token) => escapeRegex(token)).join("[\\s-]*");
        const typeRegex = new RegExp(`^\\s*${pattern}\\s*$`, "i");
        appendAndCondition(query, {
          type: {
            $elemMatch: { $regex: typeRegex },
          },
        });
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

    // Total documents count (raw Mongo driver to avoid ObjectId cast issues
    // on legacy collectionName string values).
    const totalDocs = await ProductModel.collection.countDocuments(query);
    const totalPages = Math.ceil(totalDocs / limit);

    // Aggregation pipeline with collectionName populated (raw driver path
    // so mixed legacy types in collectionName do not fail casting).
    const pipeline = [
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
          // Prefer product-level handle; fall back to looked-up collection handle.
          collectionHandle: { $ifNull: ["$collectionHandle", "$collectionName.handle"] },
        },
      },

      { $sort: { isSoldOut: 1, ...sortCriteria } },
      { $skip: skip },
      { $limit: limit },
    ];

    // Field projection (optional)
    if (searchParams.get("fields")) {
      const fields = searchParams
        .get("fields")
        .split(",")
        .reduce((acc, field) => {
          acc[field.trim()] = 1;
          return acc;
        }, {});
      pipeline.push({ $project: fields });
    }

    const products = await ProductModel.collection.aggregate(pipeline).toArray();

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
