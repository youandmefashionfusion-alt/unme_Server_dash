const mongoose = require("mongoose"); // Erase if already required
// Declare the Schema of the Mongo model
var orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    shippingInfo: {
      firstname: {
        type: String,
        required: true
      },
      lastname: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      phone: {
        type: Number,
        required: true
      },
      address: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      pincode: {
        type: Number,
        required: true
      },
    },
    trackingInfo: {
      partner: {
        type: String,
      },
      link: {
        type: String,
      },
      trackingId: {
        type: String,
      },
      trackingLink: {
        type: String,
      },
      pickupDatetime: {
        type: String,
      },
      pickupId: {
        type: String,
      },
      pickupRequestedAt: {
        type: Date,
      },
    },
    paymentInfo: {
      razorpayOrderId: {
        type: String,
        required: true,
      },
      razorpayPaymentId: {
        type: String,
        required: true,
      },
      paymentId: {
        type: String,
      },
      razorpayAmountPaise: {
        type: Number,
      },
      lineItemsTotalPaise: {
        type: Number,
      },
      currency: {
        type: String,
      },
      receipt: {
        type: String,
      },
    },
    orderItems: [{
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
      },
      quantity: {
        type: Number,
        required: true
      },
      isGift: {
        type: Boolean,
        default: false,
      },
      giftWrap: {
        type: Boolean,
        default: false,
      },
      giftWrapCharge: {
        type: Number,
        default: 0,
      },
      giftMessage: {
        type: String,
        trim: true,
        default: "",
        maxlength: 180,
      },
    }],
    paidAt: {
      type: Date,
      default: Date.now()
    },
    totalPrice: {
      type: Number,
      required: true
    },
    shippingCost: {
      type: Number,
      required: true
    },
    codCharge: {
      type: Number,
      default: 0,
    },
    orderType: {
      type: String,
      required: true
    },
    discount: {
      type: Number,
      required: true,
    },
    giftWrapTotal: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true
    },
    orderStatus: {
      type: String,
      default: "Ordered"
    },
    orderComment: [
      {
        name: String,
        message: String,
        time: Date,
      }
    ],
    orderCalled: {
      type: String,
    },
    orderHistory: [
      {
        name: String,
        message: String,
        time: Date,
      }
    ]
  },
  {
    timestamps: true,
  }
);
orderSchema.pre("save", async function (next) {
  try {
    if (!this.orderNumber) {
      const tagPrefix = "YM";

      // Derive the next number from the HIGHEST existing order number (the order
      // shown at the top of the orders list) so dashboard and website creation
      // stay in sync. We cannot sort orderNumber as a string ("YM9" > "YM100")
      // or by createdAt (numbers drift from creation order), so we compute the
      // numeric sequence and take the max.
      const [maxDoc] = await this.constructor.aggregate([
        { $match: { orderNumber: { $regex: /\d/ } } },
        {
          $addFields: {
            _seq: {
              $let: {
                vars: {
                  orderNumberMatch: {
                    $regexFind: { input: { $ifNull: ["$orderNumber", ""] }, regex: "\\d+" },
                  },
                },
                in: {
                  $convert: {
                    input: { $ifNull: ["$$orderNumberMatch.match", "0"] },
                    to: "double",
                    onError: 0,
                    onNull: 0,
                  },
                },
              },
            },
          },
        },
        { $sort: { _seq: -1 } },
        { $limit: 1 },
        { $project: { _seq: 1 } },
      ]);

      let nextSeq = (maxDoc?._seq || 0) + 1;
      let candidate = `${tagPrefix}${nextSeq}`;

      // Skip any number already in use (gaps, imported numbers, or an order
      // created concurrently by the website) so we never clash.
      // eslint-disable-next-line no-await-in-loop
      while (await this.constructor.exists({ orderNumber: candidate })) {
        nextSeq += 1;
        candidate = `${tagPrefix}${nextSeq}`;
      }

      this.orderNumber = candidate;
    }
    next();
  } catch (error) {
    next(error);
  }
});
// In development, drop the cached model so schema/hook edits take effect on
// hot-reload (Mongoose caches compiled models across Next.js reloads, which
// would otherwise keep running an outdated pre-save hook). In production the
// model is compiled once and reused.
if (process.env.NODE_ENV !== "production" && mongoose.models.Order) {
  delete mongoose.models.Order;
}
const OrderModel = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default OrderModel;
