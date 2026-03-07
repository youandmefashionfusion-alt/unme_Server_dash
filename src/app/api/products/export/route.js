import * as XLSX from 'xlsx';
import connectDb from '../../../../../config/connectDb';
import ProductModel from '../../../../../models/productModel';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        await connectDb();
        // Find products by collection ID
        const products = await ProductModel.find({ state: 'active' });

        if (products.length === 0) {
            return NextResponse.json({ error: 'No products found for this collection' }, { status: 404 });
        }
        let data = [];
        data = products.map((prdt, index) => ({
            id: index,
            title: prdt?.title,
            desciption: `Buy ${prdt?.title} at upto 20% off on U n Me`,
            link: `https://unmejewels.com/products/${prdt?.handle}`,
            image_link: prdt?.images[0]?.url,
            brand: 'U n Me',
            condition: "New",
            availability: 'in stock',
            price: prdt?.price,
            'identifier exist': 'yes',
            gtin: prdt?.sku,
            mpn: prdt?.sku
        }));

        // Create Excel workbook
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
        const uint8Array = new Uint8Array(buffer);
        let filename = `youandme-products.xlsx`;
        return new Response(uint8Array, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Length': uint8Array.length.toString(),
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return Response.json({ error: error }, { status: 500 });
    }
}