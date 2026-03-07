import HistoryModel from "../../../../../models/historyModel";
export async function GET(request){
    const {searchParams}=new Url(request.url)
    const limit = parseInt(searchParams.get("limit") || 50); // Number of items per page
    const page = parseInt(searchParams.get("page") || 1); // Current page, default is 1
    try {
      const count = await HistoryModel.countDocuments(); // Total number of orders
  
      // Calculate the skipping value based on the current page
      const skip = count - (page * limit);
  
      // Query orders with reverse pagination
      const history = await HistoryModel.find()
        .skip(Math.max(skip, 0)) // Ensure skip is non-negative
        .limit(limit);
  

        return Response.json(
            {
                history,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                totalHistory: count
              }
        )
    } catch (error) {
      console.error(error);
      return Response.json({
        status:500,message:"Server Error"
      })
    }
  }