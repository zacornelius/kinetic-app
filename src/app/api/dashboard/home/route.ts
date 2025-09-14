import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');
    const view = searchParams.get('view') || 'personal';

    if (!userEmail) {
      return NextResponse.json({ error: 'userEmail is required' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const timestamp = Date.now();

    // Helper function to parse API responses safely
    const parseResponse = async (response: Response) => {
      if (!response.ok) {
        console.warn(`API call failed: ${response.status} ${response.statusText}`);
        return [];
      }
      try {
        const data = await response.json();
        return Array.isArray(data) ? data : (data.data || data.customers || []);
      } catch (error) {
        console.warn('Failed to parse API response:', error);
        return [];
      }
    };

    // Only fetch the data we actually need for the home tab
    const [
      lineItemsResponse,
      customersResponse
    ] = await Promise.all([
      fetch(`${baseUrl}/api/line-items?_t=${timestamp}`),
      fetch(`${baseUrl}/api/customers/consolidated?action=list&include=basic&limit=1000&offset=0&_t=${timestamp}`)
    ]);

    // Parse responses
    const [
      lineItems,
      customersData
    ] = await Promise.all([
      parseResponse(lineItemsResponse),
      parseResponse(customersResponse)
    ]);

    // Return only the data needed for home tab
    const result = {
      success: true,
      data: {
        lineItems: Array.isArray(lineItems) ? lineItems : [],
        customers: customersData?.customers || customersData || []
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Home dashboard API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch home dashboard data', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}