import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      unique: false,
    },
    handle: {
      type: String,
      unique: true,
      lowercase: true,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    crossPrice: {
      type: Number,
    },
    order: {
      type: Number,
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
    },
    sold: {
      type: Number,
      default: 0,
    },
    ratings: [
      {
        star: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
        name: {
          type: String
        },
        email: {
          type: String
        },
        image: {
          type: String
        }
      },
    ],
    totalRating: {
      type: Number,
      default: 0,
    },
    state: {
      type: String,
      enum: ["active", "draft"],
      default: "draft",
    },
    images: [
      {
        url: {
          type: String,
          default: 'https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372'
        },
      },
    ],
    collectionName: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection",
      required: true,
    },
    collectionHandle: {
      type: String
    },
    quantity: {
      type: Number,
      default: 0,
    },
    color: {
      type: [String],
      default: [],
    },
    material: {
      type: [String],
      default: [],
    },
    type: {
      type: [String],
      default: [],
    },
    necklaceType: {
      type: [String],
      default: [],
    },
    ringDesign: {
      type: [String],
      default: [],
    },
    sizes: {
      type: [String],
      default: [],
    },
    gender: {
      type: String,
      enum: ["male", "female", "unisex"],
      default: "unisex",
    },
    bossPicks: {
      type: Boolean,
      default: true,
    },
    gatawayJewels: {
      type: Boolean,
      default: true,
    },
    metaDesc: {
      type: String,
      trim: true,
    },
    metaTitle: {
      type: String,
      trim: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    is999Sale: {
      type: Boolean,
      default: false,
    },
    is899Sale: {
      type: Boolean,
      default: false,
    },
    is1499Sale: {
      type: Boolean,
      default: false,
    },
    saleCollections:[
      {
        type:mongoose.Schema.Types.ObjectId,
        ref:"SaleCollection"
      }
    ]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const ProductModel =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default ProductModel;

