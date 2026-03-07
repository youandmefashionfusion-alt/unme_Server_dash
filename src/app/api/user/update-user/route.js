// /app/api/update-user/route.js
import bcrypt from 'bcrypt';
import authMiddleware from '../../../../../controller/authController';
import connectDb from '../../../../../config/connectDb';
import UserModel from '../../../../../models/userModel';

export async function PUT(req) {
  try {
    await connectDb();
    const body = await req.json();
    const { _id, firstname, email, mobile, password } = body;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    await authMiddleware(token);
    const updateData = { firstname, email, mobile };
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const updated = await UserModel.findByIdAndUpdate(_id, updateData, { new: true });
    return Response.json(updated);
  } catch (err) {
    return Response.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
