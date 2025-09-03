import { NextRequest, NextResponse } from "next/server";
import { makeQBRequest, QB_ENDPOINTS } from "@/lib/quickbooks-config";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('accessToken');
    const companyId = searchParams.get('companyId');

    if (!accessToken || !companyId) {
      return NextResponse.json({ 
        error: "Missing accessToken or companyId parameters" 
      }, { status: 400 });
    }

    // Get company information
    const companyInfo = await makeQBRequest(
      QB_ENDPOINTS.companyInfo,
      accessToken,
      companyId
    );

    return NextResponse.json({
      success: true,
      company: companyInfo.QueryResponse?.CompanyInfo?.[0] || companyInfo,
    });

  } catch (error) {
    console.error('Error fetching QuickBooks company info:', error);
    return NextResponse.json({ 
      error: "Failed to fetch company information",
      details: error.message 
    }, { status: 500 });
  }
}
