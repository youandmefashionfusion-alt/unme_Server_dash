const mongoose = require("mongoose"); // Erase if already required
// Declare the Schema of the Mongo model
var blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    handle:{
      type:String,
      unique:true,
      required:true,
    },
    metaTitle:{
      type:String
    },
    metaDesc:{
      type:String
    },
    description: {
      type: String,
      required: true,
    },
    state: {
      type: String,
    },
    numViews: {
      type: Number,
      default: 0,
    },
    comment:[
      {
        email:{
          type:String,
        },
        name:{
          type:String,
          required:true
        },
        msg:{
          type:String,
          required:true,
        },
        time:{
          type:Date,
      default:Date.now()
        }
      }
    ]
,
    author: {
      type: String,
    },
    image: {
      type:String,
    },
  },
  {
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
    timestamps: true,
  }
);

const BlogModel =mongoose.models.Blog || mongoose.model("Blog", blogSchema);
export default BlogModel;
