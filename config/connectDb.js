import mongoose from "mongoose";

const connectDb = async () => {
      console.log("ENV CHECK:", process.env.MONGO_URL);
  try {

    if (mongoose.connection.readyState === 1) {
      console.log("Already connected");
      return;
    }

    await mongoose.connect(process.env.MONGO_URL);


  } catch (error) {
    console.log("MongoDB Error:", error.message);
  }
};

export default connectDb;