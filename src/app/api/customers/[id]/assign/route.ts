import { NextRequest, NextResponse } from "next/server";
import { assignCustomer, getCustomerOwnerById } from "@/lib/customer-assignment";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const { salesPersonEmail } = await request.json();

    if (!salesPersonEmail) {
      return NextResponse.json({ error: "Sales person email is required" }, { status: 400 });
    }

    const success = assignCustomer(customerId, salesPersonEmail);
    
    if (!success) {
      return NextResponse.json({ error: "Failed to assign customer" }, { status: 500 });
    }

    return NextResponse.json({ 
      message: "Customer assigned successfully",
      assignedTo: salesPersonEmail
    });

  } catch (error) {
    console.error('Error assigning customer:', error);
    return NextResponse.json(
      { error: "Failed to assign customer", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: customerId } = await params;
    const assignedOwner = getCustomerOwnerById(customerId);

    return NextResponse.json({ 
      customerId,
      assignedTo: assignedOwner
    });

  } catch (error) {
    console.error('Error getting customer assignment:', error);
    return NextResponse.json(
      { error: "Failed to get customer assignment", details: error.message },
      { status: 500 }
    );
  }
}
