import * as XLSX from 'xlsx';
import connectDb from '../../../../../config/connectDb';
import OrderModel from '../../../../../models/orderModel';
// Import the Product model so its schema is registered for populate('orderItems.product').
import '../../../../../models/productModel';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const fromOrderNumber = searchParams.get('fromOrderNumber'); // e.g., "YM001"
    const toOrderNumber = searchParams.get('toOrderNumber');     // e.g., "YM100"
    const dataType = searchParams.get('data'); // 'youandme' or 'shopify'

    if (!dataType) {
      return NextResponse.json({ error: 'Data type is required' }, { status: 400 });
    }

    await connectDb();

    let orders = [];
    let filename = '';

    if (dataType === 'youandme') {
      let filter = {};

      // Order number range (string comparison)
      if (fromOrderNumber && toOrderNumber) {
        if (fromOrderNumber > toOrderNumber) {
          return NextResponse.json({ error: 'From order number cannot be greater than to order number' }, { status: 400 });
        }
        filter.orderNumber = { $gte: fromOrderNumber, $lte: toOrderNumber };
        filename = `youandme-orders-${fromOrderNumber}-to-${toOrderNumber}.xlsx`;
      }
      // Fallback to date range
      else if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }
        if (start > end) {
          return NextResponse.json({ error: 'Start date cannot be later than end date' }, { status: 400 });
        }
        end.setHours(23, 59, 59, 999);
        filter.createdAt = { $gte: start, $lte: end };
        filename = `youandme-orders-${startDate}-to-${endDate}.xlsx`;
      } else {
        return NextResponse.json({ error: 'Either order number range or date range must be provided' }, { status: 400 });
      }

      orders = await OrderModel.find(filter).populate({
        path: 'orderItems.product',
        select: 'title sku price',
      });
    } else {
      return NextResponse.json({ error: 'Invalid data type. Use "youandme" or "shopify"' }, { status: 400 });
    }

    if (orders.length === 0) {
      return NextResponse.json({ error: 'No orders found for the specified criteria' }, { status: 404 });
    }

    // ── Formatting helpers ────────────────────────────────────────────
    const formatDate = (dateValue) => {
      if (!dateValue) return '';
      try {
        let date;
        if (typeof dateValue === 'string') {
          if (dateValue.includes('+') || dateValue.includes('-')) {
            const dateWithoutTz = dateValue.split(' +')[0].split(' -')[0];
            date = new Date(dateWithoutTz);
          } else {
            date = new Date(dateValue);
          }
        } else {
          date = new Date(dateValue);
        }
        return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch (error) {
        console.error('Date formatting error:', error);
        return '';
      }
    };

    const getArrayValue = (arr, index = 0) => {
      return Array.isArray(arr) && arr.length > index ? arr[index] : '';
    };

    // Build readable product detail columns from populated orderItems.
    const buildItemDetails = (order) => {
      const items = Array.isArray(order.orderItems) ? order.orderItems : [];
      const titles = [];
      const skus = [];
      const quantities = [];
      const prices = [];
      const lines = [];
      let totalQty = 0;

      items.forEach((item) => {
        const product = item?.product || {};
        const title = product.title || 'Product removed';
        const sku = product.sku || '';
        const qty = Number(item?.quantity) || 0;
        const price = Number(product.price) || 0;
        totalQty += qty;

        titles.push(title);
        skus.push(sku);
        quantities.push(qty);
        prices.push(price);
        lines.push(`${title}${sku ? ` (${sku})` : ''} x${qty} @${price}`);
      });

      return {
        Products: lines.join(' | '),
        ProductTitles: titles.join(' | '),
        ProductSKUs: skus.join(' | '),
        ProductQuantities: quantities.join(' | '),
        ProductPrices: prices.join(' | '),
        ItemsCount: items.length,
        TotalQuantity: totalQty,
      };
    };

    // ── Prepare Excel data ─────────────────────────────────────────────
    let data = [];

    if (dataType === 'youandme') {
      data = orders.map(order => {
        const itemDetails = buildItemDetails(order);
        return {
          OrderNumber: order.orderNumber || '',
          Email: order.shippingInfo?.email || '',
          Mobile: order.shippingInfo?.phone || '',
          FirstName: order.shippingInfo?.firstname || '',
          LastName: order.shippingInfo?.lastname || '',
          OrderType: order.orderType || '',
          OrderStatus: order.orderStatus || '',
          OrderCalled: order.orderCalled || '',
          Address: order.shippingInfo?.address || '',
          City: order.shippingInfo?.city || '',
          State: order.shippingInfo?.state || '',
          Pincode: order.shippingInfo?.pincode || '',
          // Product details
          Products: itemDetails.Products,
          ProductTitles: itemDetails.ProductTitles,
          ProductSKUs: itemDetails.ProductSKUs,
          ProductQuantities: itemDetails.ProductQuantities,
          ProductPrices: itemDetails.ProductPrices,
          ItemsCount: itemDetails.ItemsCount,
          TotalQuantity: itemDetails.TotalQuantity,
          // Order amount details
          TotalPrice: order.totalPrice || 0,
          ShippingCost: order.shippingCost || 0,
          CodCharge: order.codCharge || 0,
          GiftWrapTotal: order.giftWrapTotal || 0,
          Discount: order.discount || 0,
          Amount: order.finalAmount || 0,
          PaymentId: order.paymentInfo?.razorpayPaymentId || order.paymentInfo?.paymentId || '',
          RazorpayOrderId: order.paymentInfo?.razorpayOrderId || '',
          CreatedAt: formatDate(order.createdAt),
        };
      });
    } else if (dataType === 'shopify') {
      data = orders.map(order => ({
        OrderNumber: order.orderNumber || order.id || '',
        Email: order.email || order.customer?.email || '',
        Mobile: getArrayValue(order.phone) || order.customer?.phone || '',
        OrderType: order.orderType || '',
        FirstName: getArrayValue(order.name) || order.customer?.firstName || '',
        Address: getArrayValue(order.address) || order.shippingAddress?.address || '',
        City: getArrayValue(order.city) || order.shippingAddress?.city || '',
        State: getArrayValue(order.state) || order.shippingAddress?.province || '',
        Pincode: order.zipcode || order.shippingAddress?.zip || '',
        Amount: order.finalAmount || order.total_price || 0,
        CreatedAt: formatDate(order.dateTime || order.createdAt),
      }));
    }

    // ── Create Excel file ──────────────────────────────────────────────
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const uint8Array = new Uint8Array(buffer);

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
    return NextResponse.json({ error: 'Something went wrong during export' }, { status: 500 });
  }
}