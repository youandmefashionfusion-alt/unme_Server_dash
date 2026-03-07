import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import AbondendModel from "../../../../../models/abandonedModel";

export async function PUT(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");
  const msg = searchParams.get("msg");

  try {
    // connect both databases
    await connectDb();

    // validate token
    await authMiddleware(token);

    // update Abandoned in both DBs
    const updatedOrder = await AbondendModel.findByIdAndUpdate(
      id,
      { msg: msg },  // ✅ wrapped in object
      { new: true }
    );

    if (updatedOrder) {
      return Response.json({
        success: true,
        message: "Abandoned message updated successfully",
        data: updatedOrder,
      });
    } else {
      return Response.json(
        {
          success: false,
          status: 400,
          message: "Unable to update Abandoned",
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Error updating Abandoned:", error.message);
    return Response.json(
      {
        success: false,
        message: "Server Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
