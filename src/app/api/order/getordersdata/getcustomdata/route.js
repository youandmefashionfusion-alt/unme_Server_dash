import connectDb from "../../../../../../config/connectDb";
import OrderModel from "../../../../../../models/orderModel";
export async function GET(request){
    const {searchParams}=new URL(request.url)
    const startDate=searchParams.get("startDate") || ""
    const endDate=searchParams.get("endDate") || ""

    const start = new Date(startDate);
    start.setDate(start.getDate()-1)
    start.setHours(18, 30, 0, 0); // Optional: set to start of day
    const end = new Date(endDate);
    end.setHours(18, 29, 0, 0); // Optional: set to end of day
  
  await connectDb()
  if (!start.getTime() || !end.getTime()) {
    return Response.json({
        status:200,message:"Error"
    })
  }
  const data = await OrderModel.aggregate([
    {
      $match: {
        createdAt: {
          $gte: start,
          $lte: end
        },
        orderType: { $ne: "Cancelled" } // Exclude orders with the "Cancelled" tag
      }
    },
    {
      $group: {
        _id: null, // Grouping by null means aggregating all documents that match the filter
        totalIncome: { $sum: "$finalAmount" },
        totalCount: { $sum: 1 },
        items: { $push: "$orderItems" }
      }
    },
    {
      $project: {
        _id: 0, // Exclude _id from results
        totalIncome: 1,
        totalCount: 1,
        items: 1,
        orderItemCount: { $sum: { $size: "$items" } } // Calculate the total number of items
      }
    }
  ]);
    return Response.json(data)
  }
  