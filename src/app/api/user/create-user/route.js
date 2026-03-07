import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import UserModel from "../../../../../models/userModel";

export async function POST(req) {
  try {
    await connectDb();
    const body = await req.json();
    const { firstname, email ="", mobile, password = "" } = body;
    const { searchParams } = new URL(req.url);
    // const token = searchParams.get('token');
    // await authMiddleware(token);
    const user = new UserModel({ firstname, email, mobile, password });
    await user.save();

    return Response.json({ success: true, user });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
