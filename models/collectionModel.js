const mongoose = require("mongoose"); // Erase if already required

// Declare the Schema of the Mongo model
var collectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    isTrending: {
      type: String,
      default: "false",
    },
    order:{
      type:Number,
      default:0
    },
    mostTrending: {
      type: String,
      default: "false",
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
      enum: ["active", "draft"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);
const CollectionModel =mongoose.models.Collection || mongoose.model("Collection", collectionSchema);

export default CollectionModel;
