import connectDb from '../../../../../config/connectDb';
import ProductModel from '../../../../../models/productModel';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        await connectDb();
        const products = await ProductModel.find({ state: 'active' }).lean();

        if (products.length === 0) {
            return NextResponse.json({ error: 'No products found for export' }, { status: 404 });
        }

        const SITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://unmejewels.com';
        const CURRENCY = (process.env.CATALOG_CURRENCY || 'INR').toUpperCase();
        const BRAND = 'U n Me';

        const COLUMNS = [
            'id',
            'title',
            'description',
            'availability',
            'condition',
            'price',
            'link',
            'image_link',
            'brand',
            'google_product_category',
            'fb_product_category',
            'quantity_to_sell_on_facebook',
            'sale_price',
            'sale_price_effective_date',
            'item_group_id',
            'gender',
            'color',
            'size',
            'age_group',
            'material',
            'pattern',
            'shipping',
            'shipping_weight',
            'offer_disclaimer',
            'offer_disclaimer_url',
            'video[0].url',
            'video[0].tag[0]',
            'gtin',
            'product_tags[0]',
            'product_tags[1]',
            'style[0]',
        ];

        const toText = (value = '') => String(value ?? '').trim();
        const stripHtml = (value = '') =>
            toText(value)
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        const toCsvCell = (value = '') => {
            const cell = String(value ?? '');
            if (/[",\n]/.test(cell)) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        };
        const toPrice = (value = 0) => `${Number(value || 0).toFixed(2)} ${CURRENCY}`;
        const normalizeArray = (value) => {
            if (Array.isArray(value)) {
                return value.map((item) => toText(item)).filter(Boolean);
            }
            const text = toText(value);
            return text ? [text] : [];
        };

        const rows = products.map((product, index) => {
            const color = normalizeArray(product?.color);
            const material = normalizeArray(product?.material);
            const sizes = normalizeArray(product?.sizes);
            const type = normalizeArray(product?.type);
            const baseDescription = stripHtml(product?.description);

            const hasSale = Number(product?.crossPrice) > Number(product?.price);
            const regularPrice = hasSale ? Number(product?.crossPrice) : Number(product?.price || 0);
            const discountedPrice = Number(product?.price || 0);

            return {
                id: toText(product?.sku) || toText(product?.handle) || toText(product?._id) || String(index + 1),
                title: toText(product?.title),
                description: baseDescription || `Buy ${toText(product?.title)} from ${BRAND}`,
                availability: Number(product?.quantity || 0) > 0 ? 'in stock' : 'out of stock',
                condition: 'new',
                price: toPrice(regularPrice),
                link: `${SITE_URL}/products/${toText(product?.handle)}`,
                image_link: toText(product?.images?.[0]?.url),
                brand: BRAND,
                google_product_category: 'Apparel & Accessories > Jewelry',
                fb_product_category: 'Jewelry',
                quantity_to_sell_on_facebook: Math.max(Number(product?.quantity || 0), 0),
                sale_price: hasSale ? toPrice(discountedPrice) : '',
                sale_price_effective_date: '',
                item_group_id: '',
                gender: toText(product?.gender || 'unisex'),
                color: color.join(', '),
                size: sizes.join(', '),
                age_group: 'adult',
                material: material.join(', '),
                pattern: '',
                shipping: `IN:::0.00 ${CURRENCY}`,
                shipping_weight: '',
                offer_disclaimer: '',
                offer_disclaimer_url: '',
                'video[0].url': '',
                'video[0].tag[0]': '',
                gtin: toText(product?.sku),
                'product_tags[0]': toText(product?.collectionHandle),
                'product_tags[1]': type[0] || '',
                'style[0]': type[0] || '',
            };
        });

        const header = COLUMNS.join(',');
        const body = rows
            .map((row) => COLUMNS.map((key) => toCsvCell(row[key])).join(','))
            .join('\n');
        const csv = `\uFEFF${header}\n${body}`;

        const fileName = `youandme-products-catalog.csv`;

        return new Response(csv, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Type': 'text/csv; charset=utf-8',
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return Response.json({ error: 'Failed to export products' }, { status: 500 });
    }
}
