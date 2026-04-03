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
      const latestOrder = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
      let latestOrderNumber = 0;

      if (latestOrder && latestOrder.orderNumber) {
        latestOrderNumber = parseInt(latestOrder.orderNumber.replace(/[^\d]/g, ''), 10);
      }

      const tagPrefix = "YM"
      const newOrderNumber = `${tagPrefix}${latestOrderNumber + 1}`;
      this.orderNumber = newOrderNumber;
    }
    next();
  } catch (error) {
    next(error);
  }
});
const OrderModel = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default OrderModel;
