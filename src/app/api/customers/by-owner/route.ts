import { NextRequest, NextResponse } from "next/server";
import { getCustomersByOwner } from "@/lib/customer-assignment";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerEmail = searchParams.get('ownerEmail');

    if (!ownerEmail) {
      return NextResponse.json({ error: "Owner email is required" }, { status: 400 });
    }

    const customers = getCustomersByOwner(ownerEmail);

    return NextResponse.json({ 
      customers,
      total: customers.length,
      ownerEmail
    });

  } catch (error) {
    console.error('Error fetching customers by owner:', error);
    return NextResponse.json(
      { error: "Failed to fetch customers by owner", details: error.message },
      { status: 500 }
    );
  }
}
