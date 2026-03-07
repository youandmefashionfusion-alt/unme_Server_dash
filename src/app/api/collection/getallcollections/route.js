import connectDb from "../../../../../config/connectDb";
import CollectionModel from "../../../../../models/collectionModel";
export const config = {
    maxDuration: 10,
  };
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    try {
        await connectDb();

        let filter = {};
        if (status) {
            filter.status = status;
        }

        const collection = await CollectionModel.find(filter);
        return Response.json(collection)
        

    } catch (error) {
        console.error("Error fetching collections:", error.message);
        return new Response(
            JSON.stringify({ success: false, error: "Failed to fetch collection" }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
