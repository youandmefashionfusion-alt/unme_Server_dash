import { NextResponse } from "next/server";
import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";

export async function GET() {
    try {
        await connectDb();

        // sample image links for random assignment
        const imageLinks = [
            "https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372",
            "https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372",
            "https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372",
            "https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372",
            "https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372",
            "https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372",
            "https://cdn.shopify.com/s/files/1/0652/8542/3187/files/IMG_0480.heic?v=1752684372"
        ];

        // fetch all products
        const products = await ProductModel.find();

        // update each product
        for (const product of products) {
            // shuffle and pick 3–5 random images
            const shuffled = [...imageLinks].sort(() => 0.5 - Math.random());
            const count = Math.floor(Math.random() * 3) + 3; // random between 3–5
            const selected = shuffled.slice(0, count);

            // set in correct format
            product.images = selected.map((url) => ({ url }));
            product.sku = "YM-01"

            await product.save();
        }

        return NextResponse.json({
            success: true,
            message: `✅ Updated ${products.length} products with random images.`,
        });
    } catch (error) {
        console.error("Error updating product images:", error);
        return NextResponse.json(
            { success: false, message: error.message },
            { status: 500 }
        );
    }
}
