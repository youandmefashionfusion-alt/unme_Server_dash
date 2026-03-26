import connectDb from "../../../../../config/connectDb";
import authMiddleware from "../../../../../controller/authController";
import OrderModel from "../../../../../models/orderModel";

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export async function PUT(request){
    const {searchParams}=new URL(request.url)
    const id = searchParams.get("id")
    const token = searchParams.get("token")

    const body=await request.json()
    try {
        await connectDb()
        await authMiddleware(token)
      const orderType = body?.orderType || 'COD';
      const totalPrice = toFiniteNumber(body?.totalPrice);
      const shippingCost = toFiniteNumber(body?.shippingCost);
      const discount = Math.max(toFiniteNumber(body?.discount), 0);
      const requestedCodCharge = Math.max(toFiniteNumber(body?.codCharge), 0);
      const codCharge = orderType === 'COD' ? requestedCodCharge : 0;
      const finalAmount = totalPrice + shippingCost + codCharge - discount;

      const payload = {
        ...body,
        totalPrice,
        shippingCost,
        discount,
        codCharge,
        finalAmount,
      };

      const updatedOrder = await OrderModel.findByIdAndUpdate(id, payload, {
        new: true,
      });
      if(updatedOrder){
        return Response.json(updatedOrder)
      }
      else{
        return Response.json({
            status:400, message:"Unable to Update Order"
          },{status:400})
      }
    } catch (error) {
      return Response.json({
        status:500, message:"Server Error",error:error
      },{status:500})
    }
  }
