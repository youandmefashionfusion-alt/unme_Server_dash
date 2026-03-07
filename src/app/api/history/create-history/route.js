import connectDb from "../../../../../config/connectDb";
import HistoryModel from "../../../../../models/historyModel";
export async function POST(req){
    const body = await req.json();
    try {
        await connectDb()
      const newHistory = await HistoryModel.create(body);


      if(newHistory){
        return Response.json({
            status:200,message:"History Created"
        })
      }
      else{
        return Response.json({
            status:400,message:"Unable to Create History"
        },{status:400})
      }

    } catch (error) {
        return Response.json({
            status:500,message:error
        },{status:500})
    }
  }