const mongoose = require("mongoose"); // Erase if already required
// Declare the Schema of the Mongo model
var couponSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    uppercase: true,
  },
  expiry: {
    type: Date,
    required: true,
  },
  discount: {
    type: String,
  },
  discounttype:{
    type:String,
    required:true,
  },
  customertype:{
    type:String,
    required:true,
  },
  status:{
    type:String,
    required:true,
  }
  ,
  minItem:{
    type:Number,
  },
  cEmail:{
    type:String,
  },

},{
  timestamps:true,
}
);

const CouponModel =mongoose.models.Coupon || mongoose.model("Coupon", couponSchema);

export default CouponModel;
