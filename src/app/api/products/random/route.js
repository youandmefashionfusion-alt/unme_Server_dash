import { NextResponse } from "next/server";
import ProductModel from "../../../../../models/productModel";
import connectDb from "../../../../../config/connectDb";

export async function GET() {
    try {
        await connectDb();

        // your 7 image links
        const imageLinks = [
            "https://res.cloudinary.com/dkfkwavmc/image/upload/v1762884128/MA-48102381001_1_h2ykfe.jpg",
            "https://res.cloudinary.com/dkfkwavmc/image/upload/v1762884154/1662045248_c0a2b802b8ff3e7ae2fa_owj6vq.png",
            "https://res.cloudinary.com/dkfkwavmc/image/upload/v1762884173/IMG_2638_83ca4948-6d4a-4196-af06-990c4cb4c16f_lk3br7.jpg",
            "https://res.cloudinary.com/dkfkwavmc/image/upload/v1762884197/1659169825_184c8850aa0aee753be5_a5pkwr.jpg",
            "https://res.cloudinary.com/dkfkwavmc/image/upload/v1762884213/2_Line_Heavy_Bridal_Pearl_Hanging_Necklace_with_Diamond_Look_1200x1200_vc4b21.jpg",
            "https://res.cloudinary.com/dkfkwavmc/image/upload/v1762884241/C001952__1_ivmyhu.jpg",
            "https://res.cloudinary.com/dkfkwavmc/image/upload/v1762884278/artificial-design-bridal-hairpin-hair-clip-hair-accessories-1-original-imaghet2sxg5wgkq_crpajy.jpg"
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
