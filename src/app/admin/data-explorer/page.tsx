"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import ProfileDropdown from "@/components/ProfileDropdown";

type Inquiry = {
  id: string;
  createdAt: string;
  category: "bulk" | "issues" | "questions";
  subject: string;
  customerEmail: string;
  ownerEmail?: string;
  status: "open" | "assigned" | "closed";
};

type Order = {
  id: string;
  createdAt: string;
  orderNumber: string;
  customerEmail: string;
  customerName?: string;
  totalAmount?: number;
  currency: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "paid" | "overdue";
  shippingAddress?: string;
  billingAddress?: string;
  trackingNumber?: string;
  dueDate?: string;
  notes?: string;
  ownerEmail?: string;
  assignedOwner?: string; // Customer's assigned owner
  source: "shopify" | "quickbooks" | "manual";
  sourceId: string;
  lineItems?: string;
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

type OrderLineItem = {
  id: string;
  orderId: string;
  productId?: string;
  shopifyVariantId?: string;
  sku?: string;
  title: string;
  quantity: number;
  price: number;
  totalPrice: number;
  vendor?: string;
};

type Customer = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  createdAt: string;
  totalOrders: number;
  lifetimeValue: number;
  lastOrderDate?: string;
  firstOrderDate?: string;
};

export default function DataExplorer() {
  const { user, logout } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [shopifyOrders, setShopifyOrders] = useState<any[]>([]);
  const [shopifyCustomers, setShopifyCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"inquiries" | "orders" | "lineItems" | "customers" | "debug">("inquiries");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [editingCell, setEditingCell] = useState<{ table: string; id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "shopify" | "quickbooks" | "manual">("all");

  async function loadData() {
    if (isLoading) {
      return;
    }
    
    setIsLoading(true);
    try {
      
      // Load data sequentially to avoid race conditions
      const inquiriesRes = await fetch("/api/inquiries");
      const inquiriesData = await inquiriesRes.json();
      
      const ordersRes = await fetch("/api/orders");
      const ordersData = await ordersRes.json();
      
      const usersRes = await fetch("/api/users");
      const usersData = await usersRes.json();
      
      const customersRes = await fetch("/api/customers/enhanced");
      const customersData = await customersRes.json();
      
      const shopifyOrdersRes = await fetch("/api/shopify/orders");
      const shopifyOrdersData = await shopifyOrdersRes.json();
      
      const shopifyCustomersRes = await fetch("/api/shopify/customers");
      const shopifyCustomersData = await shopifyCustomersRes.json();
      
      const lineItemsRes = await fetch("/api/line-items");
      const lineItemsData = await lineItemsRes.json();
      
      setInquiries(inquiriesData);
      setOrders(ordersData);
      setUsers(usersData);
      setCustomers(customersData.customers || customersData);
      setShopifyOrders(shopifyOrdersData);
      setShopifyCustomers(shopifyCustomersData);
      setLineItems(lineItemsData);
      
      // Log the data for debugging
    } catch (error) {
      console.error("Error loading data:", error);
      // Set empty arrays on error to prevent undefined states
      setInquiries([]);
      setOrders([]);
      setUsers([]);
      setCustomers([]);
      setShopifyOrders([]);
      setShopifyCustomers([]);
      setLineItems([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCustomerOrders(customer: Customer) {
    try {
      // Use the working customer detail API from the main dashboard
      const customerResponse = await fetch(`/api/customers/enhanced?search=${customer.email}&limit=1&_t=${Date.now()}`);
      if (!customerResponse.ok) {
        throw new Error(`Failed to fetch customer: ${customerResponse.status}`);
      }
      const customerData = await customerResponse.json();
      
      if (customerData.customers && customerData.customers.length > 0) {
        const customerDetails = customerData.customers[0];
        setSelectedCustomer(customerDetails);
        
        // Load orders directly from orders API for complete data
        const ordersResponse = await fetch(`/api/orders?customerEmail=${encodeURIComponent(customerDetails.email)}`);
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          
          // Process line items for each order
          const processedOrders = ordersData.map((order: any) => {
            let processedLineItems = [];
            if (order.lineItems) {
              try {
                const lineItems = JSON.parse(order.lineItems);
                processedLineItems = lineItems.map((item: any) => {
                  // Use the same logic as the line items table
                  const effectiveSKU = (() => {
                    // Handle "Build a Pallet" - extract product name from name field
                    if (item.title === 'Build a Pallet') {
                      return item.name?.replace('Build a Pallet - ', '') || `V-${item.variantId}`;
                    }
                    // Handle pre-built pallet products - extract base SKU
                    else if (item.title?.includes('Pallet')) {
                      if (item.title.includes('Active 26K Pallet')) {
                        return 'Active 26K';
                      } else if (item.title.includes('Power 30K Pallet')) {
                        return 'Power 30K';
                      } else if (item.title.includes('Vital 24K Pallet')) {
                        return 'Vital 24K';
                      } else if (item.title.includes('Pallet')) {
                        // Generic pallet handling - extract base product name
                        return item.title.replace(' Pallet', '');
                      }
                    }
                    // For non-pallet products, show the product name or SKU
                    return item.name || item.sku || (item.variantId ? `V-${item.variantId}` : "N/A");
                  })();
                  
                  const effectiveQuantity = (() => {
                    // Handle "Build a Pallet" - quantity is units of that SKU on the pallet
                    if (item.title === 'Build a Pallet') {
                      return item.quantity;
                    }
                    // Handle pre-built pallet products - multiply quantity by 50
                    else if (item.title?.includes('Pallet')) {
                      return item.quantity * 50;
                    }
                    // For non-pallet products, show regular quantity
                    return item.quantity;
                  })();
                  
                  return {
                    effectiveSKU,
                    effectiveQuantity,
                    title: item.title,
                    vendor: item.vendor || 'Unknown'
                  };
                });
              } catch (error) {
                console.error('Error parsing line items:', error);
                processedLineItems = [];
              }
            }
            
            return {
              ...order,
              processedLineItems
            };
          });
          
          setCustomerOrders(processedOrders);
        } else {
          setCustomerOrders([]);
        }
      }
    } catch (error) {
      console.error("Error loading customer orders:", error);
    }
  }

  // Filter orders by source
  function getFilteredOrders() {
    if (sourceFilter === "all") {
      return orders;
    }
    return orders.filter(order => order.source === sourceFilter);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateInquiry(id: string, field: string, value: string) {
    try {
      const updateData: any = { id };
      updateData[field] = value;
      
      await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      
      loadData();
    } catch (error) {
      console.error("Error updating inquiry:", error);
    }
  }

  async function updateOrder(id: string, field: string, value: string) {
    try {
      const updateData: any = { id };
      updateData[field] = value;
      
      await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      
      loadData();
    } catch (error) {
      console.error("Error updating order:", error);
    }
  }

  function startEdit(table: string, id: string, field: string, currentValue: string) {
    setEditingCell({ table, id, field });
    setEditValue(currentValue || "");
  }

  function saveEdit() {
    if (!editingCell) return;
    
    const { table, id, field } = editingCell;
    
    if (table === "inquiries") {
      updateInquiry(id, field, editValue);
    } else if (table === "orders") {
      updateOrder(id, field, editValue);
    }
    
    setEditingCell(null);
    setEditValue("");
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  return (
    <ProtectedRoute adminOnly={true}>
      <div className="min-h-screen p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl kinetic-title">Data Explorer {isLoading && <span className="text-sm text-blue-600">(Loading...)</span>}</h1>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <button
                onClick={loadData}
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isLoading ? "Loading..." : "Refresh Data"}
              </button>
              <button
                onClick={() => setActiveTab("inquiries")}
                className={`px-4 py-2 rounded ${activeTab === "inquiries" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Website Inquiries
              </button>
              <button
                onClick={() => setActiveTab("customers")}
                className={`px-4 py-2 rounded ${activeTab === "customers" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Customers
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`px-4 py-2 rounded ${activeTab === "orders" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Orders
              </button>
              <button
                onClick={() => setActiveTab("lineItems")}
                className={`px-4 py-2 rounded ${activeTab === "lineItems" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                Line Items
              </button>
              <button
                onClick={() => setActiveTab("debug")}
                className={`px-4 py-2 rounded ${activeTab === "debug" ? "bg-red-600 text-white" : "bg-gray-200"}`}
              >
                Debug Data
              </button>
            </div>
            <ProfileDropdown />
          </div>
        </div>

      {activeTab === "inquiries" && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{inquiry.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(inquiry.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "inquiries" && editingCell.id === inquiry.id && editingCell.field === "category" ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1"
                          autoFocus
                        >
                          <option value="bulk">bulk</option>
                          <option value="issues">issues</option>
                          <option value="questions">questions</option>
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("inquiries", inquiry.id, "category", inquiry.category)}
                        >
                          {inquiry.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "inquiries" && editingCell.id === inquiry.id && editingCell.field === "subject" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1 w-full"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("inquiries", inquiry.id, "subject", inquiry.subject)}
                        >
                          {inquiry.subject}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "inquiries" && editingCell.id === inquiry.id && editingCell.field === "customerEmail" ? (
                        <input
                          type="email"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1 w-full"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("inquiries", inquiry.id, "customerEmail", inquiry.customerEmail)}
                        >
                          {inquiry.customerEmail}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "inquiries" && editingCell.id === inquiry.id && editingCell.field === "ownerEmail" ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1"
                          autoFocus
                        >
                          <option value="">Unassigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.email}>
                              {user.firstName} {user.lastName} ({user.email})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("inquiries", inquiry.id, "ownerEmail", inquiry.ownerEmail || "")}
                        >
                          {inquiry.ownerEmail || "Unassigned"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "inquiries" && editingCell.id === inquiry.id && editingCell.field === "status" ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1"
                          autoFocus
                        >
                          <option value="open">open</option>
                          <option value="assigned">assigned</option>
                          <option value="closed">closed</option>
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("inquiries", inquiry.id, "status", inquiry.status)}
                        >
                          {inquiry.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Pallet Orders Summary */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Pallet Orders Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded border">
                <div className="font-medium text-blue-700">Total Pallet Orders</div>
                <div className="text-2xl font-bold text-blue-600">
                  {getFilteredOrders()
                    .filter(order => {
                      return lineItems.some(item => 
                        item.orderNumber === order.orderNumber && 
                        (item.title === 'Build a Pallet' || item.title?.includes('Pallet'))
                      );
                    }).length}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded border">
                <div className="font-medium text-green-700">Pre-built Pallet Orders</div>
                <div className="text-2xl font-bold text-green-600">
                  {getFilteredOrders()
                    .filter(order => {
                      return lineItems.some(item => 
                        item.orderNumber === order.orderNumber && 
                        item.title?.includes('Pallet') && item.title !== 'Build a Pallet'
                      );
                    }).length}
                </div>
              </div>
              <div className="bg-orange-50 p-3 rounded border">
                <div className="font-medium text-orange-700">Build a Pallet Orders</div>
                <div className="text-2xl font-bold text-orange-600">
                  {getFilteredOrders()
                    .filter(order => {
                      return lineItems.some(item => 
                        item.orderNumber === order.orderNumber && 
                        item.title === 'Build a Pallet'
                      );
                    }).length}
                </div>
              </div>
            </div>
          </div>
          
          {/* Source Filter */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Source:</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as "all" | "shopify" | "quickbooks" | "manual")}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(() => {
                  const palletOrders = getFilteredOrders().filter(order => {
                    // Include QuickBooks orders regardless of pallet products
                    if (order.source === 'quickbooks') {
                      return true;
                    }
                    // For other sources, check if they have pallet products
                    return lineItems.some(item => 
                      item.orderNumber === order.orderNumber && 
                      (item.title === 'Build a Pallet' || item.title?.includes('Pallet'))
                    );
                  });
                  
                  return (
                    <>
                      <option value="all">All Sources ({palletOrders.length})</option>
                      <option value="shopify">Shopify ({palletOrders.filter(o => o.source === 'shopify').length})</option>
                      <option value="quickbooks">QuickBooks ({palletOrders.filter(o => o.source === 'quickbooks').length})</option>
                      <option value="manual">Manual ({palletOrders.filter(o => o.source === 'manual').length})</option>
                    </>
                  );
                })()}
              </select>
              <div className="text-sm text-gray-500">
                Showing {getFilteredOrders()
                  .filter(order => {
                    // Include QuickBooks orders regardless of pallet products
                    if (order.source === 'quickbooks') {
                      return true;
                    }
                    // For other sources, check if they have pallet products
                    return lineItems.some(item => 
                      item.orderNumber === order.orderNumber && 
                      (item.title === 'Build a Pallet' || item.title?.includes('Pallet'))
                    );
                  }).length} orders
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracking</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {getFilteredOrders()
                  .filter(order => {
                    // Include QuickBooks orders regardless of pallet products
                    if (order.source === 'quickbooks') {
                      return true;
                    }
                    // For other sources, only show orders that have pallet products
                    return lineItems.some(item => 
                      item.orderNumber === order.orderNumber && 
                      (item.title === 'Build a Pallet' || item.title?.includes('Pallet'))
                    );
                  })
                  .map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{order.id}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "orders" && editingCell.id === order.id && editingCell.field === "orderNumber" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1 w-full"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("orders", order.id, "orderNumber", order.orderNumber)}
                        >
                          {order.orderNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.source === 'shopify' ? 'bg-green-100 text-green-800' :
                        order.source === 'quickbooks' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        {editingCell?.table === "orders" && editingCell.id === order.id && editingCell.field === "customerName" ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyPress}
                            className="border rounded px-2 py-1 w-full mb-1"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded mb-1"
                            onClick={() => startEdit("orders", order.id, "customerName", order.customerName || "")}
                          >
                            {order.customerName || "N/A"}
                          </div>
                        )}
                        {editingCell?.table === "orders" && editingCell.id === order.id && editingCell.field === "customerEmail" ? (
                          <input
                            type="email"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyPress}
                            className="border rounded px-2 py-1 w-full"
                            autoFocus
                          />
                        ) : (
                          <div
                            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded text-xs text-gray-600"
                            onClick={() => startEdit("orders", order.id, "customerEmail", order.customerEmail)}
                          >
                            {order.customerEmail}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "orders" && editingCell.id === order.id && editingCell.field === "totalAmount" ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1 w-full"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("orders", order.id, "totalAmount", order.totalAmount?.toString() || "")}
                        >
                          {order.totalAmount ? `$${order.totalAmount.toFixed(2)}` : "N/A"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "orders" && editingCell.id === order.id && editingCell.field === "status" ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1"
                          autoFocus
                        >
                          <option value="pending">pending</option>
                          <option value="processing">processing</option>
                          <option value="shipped">shipped</option>
                          <option value="delivered">delivered</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("orders", order.id, "status", order.status)}
                        >
                          {order.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "orders" && editingCell.id === order.id && editingCell.field === "trackingNumber" ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1 w-full"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("orders", order.id, "trackingNumber", order.trackingNumber || "")}
                        >
                          {order.trackingNumber || "N/A"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {editingCell?.table === "orders" && editingCell.id === order.id && editingCell.field === "ownerEmail" ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={handleKeyPress}
                          className="border rounded px-2 py-1"
                          autoFocus
                        >
                          <option value="">Unassigned</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.email}>
                              {user.firstName} {user.lastName} ({user.email})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                          onClick={() => startEdit("orders", order.id, "ownerEmail", order.ownerEmail || order.assignedOwner || "")}
                        >
                          {order.ownerEmail || order.assignedOwner || "Unassigned"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {activeTab === "lineItems" && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Effective Qty</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineItems
                  .filter(item => {
                    // Only show pallet-related products
                    return item.title === 'Build a Pallet' || item.title?.includes('Pallet');
                  })
                  .map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{item.orderNumber || "N/A"}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{item.customerName || "N/A"}</div>
                        <div className="text-xs text-gray-500">{item.customerEmail || "N/A"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {(() => {
                        // Handle "Build a Pallet" - extract product name from name field
                        if (item.title === 'Build a Pallet') {
                          return item.name?.replace('Build a Pallet - ', '') || `V-${item.variantId}`;
                        }
                        // Handle pre-built pallet products - extract base SKU
                        else if (item.title?.includes('Pallet')) {
                          if (item.title.includes('Active 26K Pallet')) {
                            return 'Active 26K';
                          } else if (item.title.includes('Power 30K Pallet')) {
                            return 'Power 30K';
                          } else if (item.title.includes('Vital 24K Pallet')) {
                            return 'Vital 24K';
                          } else if (item.title.includes('Pallet')) {
                            // Generic pallet handling - extract base product name
                            return item.title.replace(' Pallet', '');
                          }
                        }
                        // For non-pallet products, show the product name or SKU
                        return item.name || item.sku || (item.variantId ? `V-${item.variantId}` : "N/A");
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {(() => {
                        // Handle "Build a Pallet" - quantity is units of that SKU on the pallet
                        if (item.title === 'Build a Pallet') {
                          return item.quantity;
                        }
                        // Handle pre-built pallet products - multiply quantity by 50
                        else if (item.title?.includes('Pallet')) {
                          return item.quantity * 50;
                        }
                        // For non-pallet products, show regular quantity
                        return item.quantity;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">${parseFloat(item.price || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">${parseFloat(item.totalPrice || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{item.vendor || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "customers" && (
        <div className="space-y-4">
          {/* Pallet Customers Summary */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">Pallet Customers Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="bg-blue-50 p-3 rounded border">
                <div className="font-medium text-blue-700">Total Pallet Customers</div>
                <div className="text-2xl font-bold text-blue-600">
                  {customers
                    .filter(customer => {
                      return lineItems.some(item => 
                        item.customerEmail === customer.email && 
                        (item.title === 'Build a Pallet' || item.title?.includes('Pallet'))
                      );
                    }).length}
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded border">
                <div className="font-medium text-green-700">Total Pallet Orders</div>
                <div className="text-2xl font-bold text-green-600">
                  {getFilteredOrders()
                    .filter(order => {
                      return lineItems.some(item => 
                        item.orderNumber === order.orderNumber && 
                        (item.title === 'Build a Pallet' || item.title?.includes('Pallet'))
                      );
                    }).length}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lifetime Value</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customers
                  .filter(customer => {
                    // Only show customers who have pallet orders
                    return lineItems.some(item => 
                      item.customerEmail === customer.email && 
                      (item.title === 'Build a Pallet' || item.title?.includes('Pallet'))
                    );
                  })
                  .map((customer, index) => (
                  <tr key={customer.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => loadCustomerOrders(customer)}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-gray-100 text-gray-800' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{customer.firstName} {customer.lastName}</div>
                        <div className="text-xs text-gray-500">{customer.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{customer.totalOrders}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      ${(customer.lifetimeValue || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {customer.firstOrderDate ? new Date(customer.firstOrderDate).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {customer.lastOrderDate ? new Date(customer.lastOrderDate).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {/* Customer Orders Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {selectedCustomer.firstName} {selectedCustomer.lastName} - Purchase History
              </h2>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4 text-sm text-gray-600">
              <p><strong>Email:</strong> {selectedCustomer.email}</p>
              <p><strong>Total Orders:</strong> {selectedCustomer.totalOrders}</p>
              <p><strong>Lifetime Value:</strong> ${(selectedCustomer.lifetimeValue || 0).toFixed(2)}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipping Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products (Effective SKU & Qty)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customerOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.orderNumber}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        ${order.totalAmount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{order.status}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="max-w-xs">
                          {order.shippingAddress ? (
                            <div className="text-xs" title={order.shippingAddress}>
                              {order.shippingAddress.length > 50 
                                ? `${order.shippingAddress.substring(0, 50)}...` 
                                : order.shippingAddress
                              }
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">No address</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="max-w-xs">
                          {order.processedLineItems && order.processedLineItems.length > 0 ? (
                            <div className="space-y-1">
                              {order.processedLineItems.map((item, index) => (
                                <div key={index} className="text-xs border-b border-gray-100 pb-1 last:border-b-0">
                                  <div className="font-medium">{item.effectiveSKU}</div>
                                  <div className="text-gray-600">
                                    Qty: {item.effectiveQuantity}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">No products</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "debug" && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Data Debug Information</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-3">All Tables (What Data Explorer Shows)</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>All Orders:</span>
                  <span className="font-mono">{orders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>All Customers:</span>
                  <span className="font-mono">{customers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Line Items (from JSON):</span>
                  <span className="font-mono">{lineItems.length}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3">Source Tables (Where Sync Puts Data)</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Shopify Orders:</span>
                  <span className="font-mono">{shopifyOrders.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shopify Customers:</span>
                  <span className="font-mono">{shopifyCustomers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Line Items:</span>
                  <span className="font-mono">{lineItems.length}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h4 className="font-medium text-yellow-800 mb-2">Issue Analysis:</h4>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• If All tables are empty but Source tables have data, the sync to unified tables failed</li>
              <li>• If Source tables have fewer orders than expected, the Shopify sync hit a limit</li>
              <li>• If Line Items are 0, there's an issue with the line item JSON processing</li>
            </ul>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Next Steps:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Use the RED "Sync ALL Orders (No Limit)" button in Admin Cockpit</li>
              <li>2. After sync completes, click "Sync to Unified Tables"</li>
              <li>3. Refresh this page to see updated counts</li>
            </ol>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        <p>💡 Click on any cell to edit. Press Enter to save, Escape to cancel. Click on customers to view their purchase history.</p>
      </div>
      </div>
    </ProtectedRoute>
  );
}

