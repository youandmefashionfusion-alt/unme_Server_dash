import connectDb from "../../../../../config/connectDb";
import CollectionModel from "../../../../../models/collectionModel";
import ProductModel from "../../../../../models/productModel";

export const config = {
  maxDuration: 10,
};
export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  try {
    await connectDb();

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const collections = await CollectionModel.find(filter).sort({ order: 1, createdAt: -1 });

    if (collections.length === 0) {
      return Response.json([]);
    }

    const collectionIds = collections.map((item) => item._id);
    const collectionHandles = collections
      .map((item) => item.handle)
      .filter((handle) => typeof handle === "string" && handle.trim() !== "");

    const [countsByIdRaw, countsByHandleRaw, countsByLegacyNameRaw] = await Promise.all([
      ProductModel.aggregate([
        { $match: { collectionName: { $in: collectionIds } } },
        { $group: { _id: "$collectionName", count: { $sum: 1 } } },
      ]),
      ProductModel.aggregate([
        {
          $match: {
            collectionHandle: { $in: collectionHandles },
            $or: [
              { collectionName: { $exists: false } },
              { collectionName: null },
              { collectionName: { $nin: collectionIds } },
            ],
          },
        },
        { $group: { _id: "$collectionHandle", count: { $sum: 1 } } },
      ]),
      ProductModel.aggregate([
        {
          $match: {
            collectionName: { $in: collectionHandles },
            $or: [
              { collectionHandle: { $exists: false } },
              { collectionHandle: null },
              { collectionHandle: "" },
            ],
          },
        },
        { $group: { _id: "$collectionName", count: { $sum: 1 } } },
      ]),
    ]);

    const countsById = new Map(
      countsByIdRaw.map((item) => [String(item._id), item.count || 0])
    );
    const countsByHandle = new Map(
      countsByHandleRaw.map((item) => [item._id, item.count || 0])
    );
    const countsByLegacyName = new Map(
      countsByLegacyNameRaw.map((item) => [item._id, item.count || 0])
    );

    const collectionsWithProductCount = collections.map((item) => {
      const byIdCount = countsById.get(String(item._id)) || 0;
      const byHandleCount = countsByHandle.get(item.handle) || 0;
      const byLegacyNameCount = countsByLegacyName.get(item.handle) || 0;

      return {
        ...item.toObject(),
        productCount: byIdCount + byHandleCount + byLegacyNameCount,
      };
    });

    return Response.json(collectionsWithProductCount);
  } catch (error) {
    console.error("Error fetching collections:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch collection" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
