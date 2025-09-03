import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const customerEmail = searchParams.get("customerEmail");
    
    let query = 'SELECT * FROM shopify_orders WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (customerEmail) {
      query += ' AND customerEmail LIKE ?';
      params.push(`%${customerEmail}%`);
    }
    
    query += ' ORDER BY createdAt DESC';
    
    const orders = db.prepare(query).all(...params);
    
    return NextResponse.json(orders);
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
