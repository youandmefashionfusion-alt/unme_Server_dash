import mongoose from "mongoose";

let connectPromise = null;

const maskMongoUrl = (url) => {
  if (!url) return "MONGO_URL is not set";
  return url.replace(/\/\/([^:@/]+):([^@/]+)@/, "//$1:***@");
};

const connectDb = async () => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_URL is missing");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = mongoose
    .connect(mongoUrl, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })
    .then((conn) => {
      console.log("MongoDB connected:", maskMongoUrl(mongoUrl));
      return conn.connection;
    })
    .catch((error) => {
      console.error("MongoDB connection failed:", error.message);
      throw error;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export default connectDb;
