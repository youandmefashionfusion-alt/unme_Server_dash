const mongoose = require("mongoose"); // Erase if already required
// Declare the Schema of the Mongo model
var abondendSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
    },
    orderNumber: {
      type: String,
      unique: true,
    },
    shippingInfo: {
      firstname: {
        type: String,
      },
      lastname: {
        type: String,
      },
      email: {
        type: String,
      },
      phone: {
        type: Number,
      },
      address: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      pincode: {
        type: Number,
      },
    },
    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        quantity: {
          type: Number,
        },
        price: {
          type: Number,
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
        },
        color: {
          type: String,
        },
        size: {
          type: String,
        },
      },
    ],
    totalPrice: {
      type: Number,
    },
    shippingCost: {
      type: Number,
    },
    orderType: {
      type: String,
    },
    discount: {
      type: Number,
    },
    giftWrapTotal: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
    },
    paymentInfo: {
      orderCreationId: {
        type: String,
      },
      razorpayPaymentId: {
        type: String,
      },
      razorpayOrderId: {
        type: String,
      },
    },
    orderCalled: {
      type: String,
      default: "pending",
    },
    msg: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);
abondendSchema.pre("save", async function (next) {
  try {
    if (!this.orderNumber) {
      const latestOrder = await this.constructor.findOne({}, {}, { sort: { createdAt: -1 } });
      let latestOrderNumber = 0;

      if (latestOrder && latestOrder.orderNumber) {
        const extractedOrderNumber = parseInt(
          latestOrder.orderNumber.replace(/[^\d]/g, ""),
          10
        );
        latestOrderNumber = Number.isNaN(extractedOrderNumber) ? 0 : extractedOrderNumber;
      }

      const tagPrefix = "YM000";
      let nextOrderNumber = latestOrderNumber + 1;
      let generatedOrderNumber = `${tagPrefix}${nextOrderNumber}`;

      // Ensure uniqueness in case of concurrent writes.
      while (await this.constructor.exists({ orderNumber: generatedOrderNumber })) {
        nextOrderNumber += 1;
        generatedOrderNumber = `${tagPrefix}${nextOrderNumber}`;
      }

      this.orderNumber = generatedOrderNumber;
    }
    next();
  } catch (error) {
    next(error);
  }
});
const AbondendModel = mongoose.models.Abondend || mongoose.model("Abondend", abondendSchema);

export default AbondendModel;
