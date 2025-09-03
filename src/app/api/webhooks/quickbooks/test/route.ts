import { NextResponse } from "next/server";

// Test endpoint to verify webhook is working
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    return NextResponse.json({ 
      success: true, 
      message: "Webhook test successful",
      receivedData: body,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({ 
      error: "Test failed",
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "QuickBooks webhook test endpoint is ready",
    url: "/api/webhooks/quickbooks/test"
  });
}
