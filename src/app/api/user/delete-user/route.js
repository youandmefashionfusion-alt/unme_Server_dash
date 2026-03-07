import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import UserModel from "../../../../../models/userModel";

export async function DELETE(req) {
  try {
    await connectDb();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const token = searchParams.get('token');
    await authMiddleware(token);
    await UserModel.findByIdAndDelete(id);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
