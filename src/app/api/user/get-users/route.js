import connectDb from "../../../../../config/connectDb";
import UserModel from "../../../../../models/userModel";

export async function GET(req) {
  try {
    await connectDb();
    const users = await UserModel.find({}, '-__v'); // exclude version key
    return Response.json({users},{status: 200});
  } catch (err) {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}