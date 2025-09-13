"use client";

import { useState, useMemo, useCallback } from "react";
import { useAppData } from "@/hooks/useAppData";
import { VirtualList } from "@/components/VirtualList";
import { useAuth } from "@/contexts/AuthContext";

type Category = "bulk" | "issues" | "questions";
type TabType = "home" | "queue" | "actions" | "orders" | "customers";

interface Inquiry {
  id: string;
  createdAt: string;
  category: Category;
  originalMessage?: string;
  customerEmail: string;
  customerName?: string;
  assignedOwner?: string;
  status: "new" | "active" | "assigned" | "closed" | "not_relevant";
}

interface Order {
  id: string;
  createdAt: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  totalAmount?: number;
  currency: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  shippingAddress?: string;
  trackingNumber?: string;
  notes?: string;
  assignedOwner?: string;
}

interface Quote {
  id: string;
  quoteId: string;
  shopifyDraftOrderId: string;
  customerId: string;
  customerEmail: string;
  invoiceEmail?: string;
  poNumber?: string;
  status: "quoted" | "pending" | "processing";
  totalAmount: string | number;
  palletItems: Array<[string, number]>;
  customMessage?: string;
  createdAt: string;
  updatedAt: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  customerCompany?: string;
}

export default function OptimizedHome() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [category, setCategory] = useState<"all" | Category>("all");

  // Use optimized data loading with caching
  const {
    data: { inquiries, orders, quotes, users, customers, salesData, topCustomers },
    loading,
    error,
    refreshAll,
    refreshInquiries,
    refreshOrders,
    refreshQuotes
  } = useAppData({ userEmail: user?.email, enabled: true });

  // Filter inquiries by category
  const filteredInquiries = useMemo(() => {
    if (category === "all") return inquiries;
    return inquiries.filter((inquiry: Inquiry) => inquiry.category === category);
  }, [inquiries, category]);

  // Memoized inquiry renderer for virtual scrolling
  const renderInquiry = useCallback((inquiry: Inquiry, index: number) => (
    <div key={inquiry.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 text-xs rounded-full ${
              inquiry.category === 'bulk' ? 'bg-blue-100 text-blue-800' :
              inquiry.category === 'issues' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {inquiry.category}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              inquiry.status === 'new' ? 'bg-green-100 text-green-800' :
              inquiry.status === 'active' ? 'bg-blue-100 text-blue-800' :
              inquiry.status === 'assigned' ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {inquiry.status}
            </span>
          </div>
          <h3 className="font-medium text-gray-900">{inquiry.customerName || inquiry.customerEmail}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {inquiry.originalMessage ? 
              inquiry.originalMessage.substring(0, 100) + (inquiry.originalMessage.length > 100 ? '...' : '') :
              'No message available'
            }
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{new Date(inquiry.createdAt).toLocaleDateString()}</span>
            <span>{inquiry.assignedOwner || 'Unassigned'}</span>
          </div>
        </div>
      </div>
    </div>
  ), []);

  // Memoized order renderer for virtual scrolling
  const renderOrder = useCallback((order: Order, index: number) => (
    <div key={order.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="font-medium text-gray-900">#{order.orderNumber}</span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
              order.status === 'shipped' ? 'bg-green-100 text-green-800' :
              order.status === 'delivered' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {order.status}
            </span>
          </div>
          <h3 className="font-medium text-gray-900">{order.customerName || order.customerEmail}</h3>
          <p className="text-sm text-gray-600 mt-1">
            {order.totalAmount ? `$${order.totalAmount} ${order.currency}` : 'Amount not available'}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{new Date(order.createdAt).toLocaleDateString()}</span>
            <span>{order.assignedOwner || 'Unassigned'}</span>
          </div>
        </div>
      </div>
    </div>
  ), []);

  // Memoized quote renderer for virtual scrolling
  const renderQuote = useCallback((quote: Quote, index: number) => (
    <div key={quote.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="font-medium text-gray-900">#{quote.quoteId}</span>
            <span className={`px-2 py-1 text-xs rounded-full ${
              quote.status === 'quoted' ? 'bg-blue-100 text-blue-800' :
              quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {quote.status}
            </span>
          </div>
          <h3 className="font-medium text-gray-900">
            {quote.customerFirstName} {quote.customerLastName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {quote.palletItems.length} items • ${quote.totalAmount}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>{new Date(quote.createdAt).toLocaleDateString()}</span>
            <span>{quote.customerEmail}</span>
          </div>
        </div>
      </div>
    </div>
  ), []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={refreshAll}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">Team Kinetic</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshAll}
                disabled={loading}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'home', label: 'Home' },
              { id: 'queue', label: `Queue (${inquiries.length})` },
              { id: 'orders', label: `Orders (${orders.length})` },
              { id: 'customers', label: `Customers (${customers.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Category Filter */}
            <div className="flex space-x-2">
              {['all', 'bulk', 'issues', 'questions'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat as "all" | Category)}
                  className={`px-3 py-1 text-sm rounded-full ${
                    category === cat
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>

            {/* Virtual List for Inquiries */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  Inquiries ({filteredInquiries.length})
                </h2>
              </div>
              <VirtualList
                items={filteredInquiries}
                itemHeight={120}
                containerHeight={600}
                renderItem={renderInquiry}
                className="divide-y divide-gray-200"
              />
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Orders ({orders.length})
              </h2>
            </div>
            <VirtualList
              items={orders}
              itemHeight={120}
              containerHeight={600}
              renderItem={renderOrder}
              className="divide-y divide-gray-200"
            />
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Customers ({customers.length})
              </h2>
            </div>
            <VirtualList
              items={customers.slice(0, 100)} // Limit for performance
              itemHeight={80}
              containerHeight={600}
              renderItem={(customer, index) => (
                <div key={customer.id} className="p-4 border-b border-gray-200 hover:bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {customer.firstName} {customer.lastName}
                      </h3>
                      <p className="text-sm text-gray-600">{customer.email}</p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{customer.totalOrders} orders</p>
                      <p>${customer.totalSpent}</p>
                    </div>
                  </div>
                </div>
              )}
              className="divide-y divide-gray-200"
            />
          </div>
        )}

        {activeTab === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Data */}
            {salesData && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Overview</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Revenue:</span>
                    <span className="font-medium">${salesData.totalRevenue || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Orders:</span>
                    <span className="font-medium">{salesData.totalOrders || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Stats</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">New Inquiries:</span>
                  <span className="font-medium">{inquiries.filter(i => i.status === 'new').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Pending Orders:</span>
                  <span className="font-medium">{orders.filter(o => o.status === 'pending').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Quotes:</span>
                  <span className="font-medium">{quotes.filter(q => q.status === 'quoted').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

