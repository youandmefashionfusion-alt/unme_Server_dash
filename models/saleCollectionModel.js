const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var saleCollectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    order:{
      type:Number,
      default:0
    },
    images:[],
    metaTitle:{
      type:String,

    },
    metaDesc:{
      type:String,

    },
    handle:{
      type:String,
      unique: true,
      lowercase: true,
    },
    status:{
      type:String,
    },
  },
  {
    timestamps: true,
  }
);
const SaleCollectionModel =mongoose.models.SaleCollection || mongoose.model("SaleCollection", saleCollectionSchema);

export default SaleCollectionModel;