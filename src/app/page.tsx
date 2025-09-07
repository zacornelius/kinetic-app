"use client";

import { useEffect, useMemo, useState } from "react";
import PWAInstaller from "@/components/PWAInstaller";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";

type Category = "bulk" | "issues" | "questions";

type Inquiry = {
  id: string;
  createdAt: string;
  category: Category;
  subject: string;
  customerEmail: string;
  ownerEmail?: string;
  status: "open" | "assigned" | "closed" | "not_relevant";
};

type Order = {
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
  ownerEmail?: string;
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

type TabType = "home" | "actions" | "orders" | "customers";

export default function Home() {
  const { user, logout } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [category, setCategory] = useState<"all" | Category>("all");
  const [subject, setSubject] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  async function refresh() {
    const params = category === "all" ? "" : `?category=${category}`;
    const [inquiriesRes, ordersRes] = await Promise.all([
      fetch(`/api/inquiries${params}`, { cache: "no-store" }),
      fetch("/api/orders", { cache: "no-store" })
    ]);
    const inquiriesData = await inquiriesRes.json();
    const ordersData = await ordersRes.json();
    setInquiries(inquiriesData);
    setOrders(ordersData);
  }

  async function loadUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
  }

  useEffect(() => {
    refresh();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function createInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !customerEmail.trim()) return;
    await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, customerEmail, category: category === "all" ? "questions" : category }),
    });
    setSubject("");
    setCustomerEmail("");
    setShowAddModal(false);
    refresh();
  }

  async function takeOwnership(id: string) {
    if (!user) {
      alert("Please sign in first");
      return;
    }
    await fetch("/api/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ownerEmail: user.email }),
    });
    refresh();
  }

  async function markNotRelevant(id: string) {
    await fetch("/api/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "not_relevant" }),
    });
    refresh();
  }

  function signOut() {
    logout();
  }

  // Data filtering
  const unassignedInquiries = useMemo(() => 
    inquiries.filter(q => !q.ownerEmail && q.status !== "not_relevant"), [inquiries]);
  
  const assignedInquiries = useMemo(() => 
    inquiries.filter(q => q.ownerEmail === user?.email), [inquiries, user]);

  const currentOrders = useMemo(() => 
    orders.filter(o => o.ownerEmail === user?.email && o.status !== "delivered" && o.status !== "cancelled"), [orders, user]);

  const allCustomerOrders = useMemo(() => {
    const customerMap = new Map();
    orders.forEach(order => {
      const key = order.customerEmail;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          email: order.customerEmail,
          name: order.customerName,
          orders: [],
          totalValue: 0
        });
      }
      customerMap.get(key).orders.push(order);
      if (order.status !== "cancelled") {
        customerMap.get(key).totalValue += order.totalAmount || 0;
      }
    });
    return Array.from(customerMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [orders]);



  // Tab content
  function renderHomeTab() {
    return (
      <div className="space-y-4">
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["all", "bulk", "issues", "questions"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c as any)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                category === c 
                  ? "bg-blue-600 text-white" 
                  : "bg-white text-gray-600 border"
              }`}
            >
              {c}
            </button>
          ))}
        </div>



        {/* Unassigned Inquiries */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-red-600">
            Unassigned Inquiries ({unassignedInquiries.length})
          </h3>
          {unassignedInquiries.map((q) => (
            <div key={q.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 mb-1">{q.subject}</div>
                  <div className="text-xs text-gray-500 mb-1">{q.customerEmail}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(q.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 ml-2">
                  {q.category}
                </span>
              </div>
              <div className="flex gap-2">
                {currentUser && (
                  <button
                    onClick={() => takeOwnership(q.id)}
                    className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium"
                  >
                    Take
                  </button>
                )}
                <button
                  onClick={() => markNotRelevant(q.id)}
                  className="px-3 py-1 bg-gray-500 text-white rounded text-xs font-medium"
                >
                  Not Relevant
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderActionsTab() {
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-green-600">
            My Assigned Inquiries ({assignedInquiries.length})
          </h3>
          {assignedInquiries.map((q) => (
            <div key={q.id} className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 mb-1">{q.subject}</div>
                  <div className="text-xs text-gray-500 mb-1">{q.customerEmail}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(q.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {q.category}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600">
                    {q.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderOrdersTab() {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-blue-600">
              Current Orders ({currentOrders.length})
            </h3>
          </div>
          <div className="divide-y">
            {currentOrders.map((order) => (
              <div key={order.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {order.orderNumber}
                    </div>
                    <div className="text-xs text-gray-500">{order.customerName || order.customerEmail}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      ${order.totalAmount?.toFixed(2) || "N/A"}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === "pending" ? "bg-yellow-100 text-yellow-600" :
                      order.status === "processing" ? "bg-blue-100 text-blue-600" :
                      order.status === "shipped" ? "bg-purple-100 text-purple-600" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
                {order.trackingNumber && (
                  <div className="text-xs text-gray-500 mb-2">
                    Tracking: {order.trackingNumber}
                  </div>
                )}
                <div className="text-xs text-gray-400">
                  {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderCustomersTab() {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b">
            <h3 className="text-sm font-medium text-gray-600">
              Customer Order History ({allCustomerOrders.length} customers)
            </h3>
          </div>
          <div className="divide-y">
            {allCustomerOrders.map((customer, index) => (
              <div key={customer.email} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {customer.name || customer.email}
                    </div>
                    <div className="text-xs text-gray-500">{customer.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      ${customer.totalValue.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {customer.orders.length} orders
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Latest: {new Date(Math.max(...customer.orders.map(o => new Date(o.createdAt).getTime()))).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 pb-20">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3">
                 <div className="flex items-center justify-between">
                   <h1 className="text-lg font-semibold text-gray-900">Sales Dashboard</h1>
                   <div className="flex items-center gap-2">
                     <span className="text-sm text-gray-600">
                       {user?.firstName} {user?.lastName}
                     </span>
                     <button
                       onClick={signOut}
                       className="px-3 py-1 bg-gray-600 text-white rounded text-sm"
                     >
                       Sign Out
                     </button>
                   </div>
                 </div>
        </div>
      </div>

      {/* PWA Installer */}
      <div className="px-4 py-2">
        <PWAInstaller />
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === "home" && renderHomeTab()}
        {activeTab === "actions" && renderActionsTab()}
        {activeTab === "orders" && renderOrdersTab()}
        {activeTab === "customers" && renderCustomersTab()}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
        <div className="flex">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex-1 flex flex-col items-center py-2 px-1 ${
              activeTab === "home" ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Home</span>
          </button>
          
          <button
            onClick={() => setActiveTab("actions")}
            className={`flex-1 flex flex-col items-center py-2 px-1 ${
              activeTab === "actions" ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Actions</span>
          </button>
          
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex-1 flex flex-col items-center py-2 px-1 ${
              activeTab === "orders" ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span className="text-xs">Orders</span>
          </button>
          
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex-1 flex flex-col items-center py-2 px-1 ${
              activeTab === "customers" ? "text-blue-600" : "text-gray-500"
            }`}
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <span className="text-xs">Customers</span>
          </button>
        </div>
      </div>

             {/* Floating Add Button */}
             <button
               onClick={() => setShowAddModal(true)}
               className="fixed bottom-20 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-blue-700"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
               </svg>
             </button>

      {/* Add Inquiry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Add New Inquiry</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <form onSubmit={createInquiry} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={category === "all" ? "questions" : category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="bulk">Bulk Purchase</option>
                  <option value="issues">Product Issues</option>
                  <option value="questions">Questions</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="Enter subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email</label>
                <input
                  type="email"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                >
                  Add Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </div>
    </ProtectedRoute>
  );
}
