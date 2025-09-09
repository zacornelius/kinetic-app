"use client";

import { useEffect, useMemo, useState } from "react";
import PWAInstaller from "@/components/PWAInstaller";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import ProfileDropdown from "@/components/ProfileDropdown";

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

type TabType = "home" | "queue" | "actions" | "orders" | "customers";

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
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Team Kinetic</h2>
          <p className="text-gray-600 mb-6">Your business management dashboard</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{unassignedInquiries.length}</div>
              <div className="text-sm text-blue-800">New Inquiries</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{assignedInquiries.length}</div>
              <div className="text-sm text-green-800">My Inquiries</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderQueueTab() {
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
                  ? "bg-[#3B83BE] text-white" 
                  : "bg-white text-gray-600 border"
              }`}
            >
              {c === "all" ? "New" : c === "issues" ? "Issue" : c === "questions" ? "Question" : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>



        {/* Inquiries based on category */}
        <div className="space-y-3">
          {category === "all" ? (
            <>
              <h3 className="text-sm font-medium text-red-600">
                New Inquiries ({unassignedInquiries.length})
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
                  {q.category === "issues" ? "Issue" : q.category === "questions" ? "Question" : q.category.charAt(0).toUpperCase() + q.category.slice(1)}
                </span>
              </div>
              <div className="flex gap-2">
                {user && (
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
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-blue-600">
                My {category === "issues" ? "Issue" : category === "questions" ? "Question" : category.charAt(0).toUpperCase() + category.slice(1)} Inquiries ({assignedInquiries.filter(q => q.category === category).length})
              </h3>
              {assignedInquiries.filter(q => q.category === category).map((q) => (
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
                      {q.category === "issues" ? "Issue" : q.category === "questions" ? "Question" : q.category.charAt(0).toUpperCase() + q.category.slice(1)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => markComplete(q.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => markNotRelevant(q.id)}
                      className="px-3 py-1 bg-gray-500 text-white rounded text-xs font-medium"
                    >
                      Not Relevant
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
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
                    {q.category === "issues" ? "Issue" : q.category === "questions" ? "Question" : q.category.charAt(0).toUpperCase() + q.category.slice(1)}
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
                      order.status === "processing" ? "bg-[#3B83BE]/10 text-[#3B83BE]" :
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
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Customer Management</h3>
          <p className="text-sm text-gray-600 mb-4">
            Access comprehensive customer profiles, notes, and interaction history.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="/customers"
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-8 h-8 text-[#3B83BE] mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">All Customers</h4>
                  <p className="text-xs text-gray-500">View and manage all customer profiles</p>
                </div>
              </div>
            </a>
            <a
              href="/customers?search=&status=prospect"
              className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-8 h-8 text-[#D7923E] mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Prospects</h4>
                  <p className="text-xs text-gray-500">View potential customers</p>
                </div>
              </div>
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 text-[#C43C37] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Add New Inquiry</h4>
                  <p className="text-xs text-gray-500">Create a new customer inquiry</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black">
        {/* Fixed Team Kinetic Header */}
        <div className="fixed top-0 left-0 right-0 bg-black z-[9999] border-b border-gray-800">
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <h1 className="text-xl kinetic-title text-white">Team Kinetic</h1>
              <ProfileDropdown />
            </div>
          </div>
        </div>

        {/* Fixed Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-[9997] bottom-nav">
          <div className="flex">
            <button
              onClick={() => setActiveTab("home")}
              className={`flex-1 py-3 px-2 text-center ${
                activeTab === "home"
                  ? "text-white"
                  : "text-gray-400"
              }`}
            >
              <div className="flex flex-col items-center">
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span className="text-xs">Home</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`flex-1 py-3 px-2 text-center relative ${
                activeTab === "queue"
                  ? "text-white"
                  : "text-gray-400"
              }`}
            >
              <div className="flex flex-col items-center">
                <div className="relative">
                  <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                  {unassignedInquiries.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white rounded-full h-3 w-3 flex items-center justify-center font-bold text-[8px]">
                      {unassignedInquiries.length}
                    </span>
                  )}
                </div>
                <span className="text-xs">Queue</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("actions")}
              className={`flex-1 py-3 px-2 text-center ${
                activeTab === "actions"
                  ? "text-white"
                  : "text-gray-400"
              }`}
            >
              <div className="flex flex-col items-center">
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">Actions</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`flex-1 py-3 px-2 text-center ${
                activeTab === "orders"
                  ? "text-white"
                  : "text-gray-400"
              }`}
            >
              <div className="flex flex-col items-center">
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xs">Orders</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab("customers")}
              className={`flex-1 py-3 px-2 text-center ${
                activeTab === "customers"
                  ? "text-white"
                  : "text-gray-400"
              }`}
            >
              <div className="flex flex-col items-center">
                <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                <span className="text-xs">Customers</span>
              </div>
            </button>
          </div>
        </div>

        {/* Scrollable White Content Area */}
        <div 
          className="fixed left-0 right-0 bg-white z-10 overflow-y-auto"
          style={{
            top: '3rem', // Below header
            bottom: '5rem', // Above bottom nav
            height: 'calc(100vh - 3rem - 5rem)' // Full height minus header and nav
          }}
        >
          {/* PWA Installer */}
          <div className="px-4 py-2">
            <PWAInstaller />
          </div>

          {/* Content */}
          <div className="px-4 py-4">
            {activeTab === "home" && renderHomeTab()}
            {activeTab === "queue" && renderQueueTab()}
            {activeTab === "actions" && renderActionsTab()}
            {activeTab === "orders" && renderOrdersTab()}
            {activeTab === "customers" && renderCustomersTab()}
          </div>
        </div>

             {/* Floating Add Button */}
             <button
               onClick={() => setShowAddModal(true)}
               className="fixed bottom-20 right-4 w-14 h-14 bg-[#C43C37] text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-[#B03530]"
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
                  className="flex-1 px-4 py-2 bg-[#3B83BE] text-white rounded-lg text-sm font-medium"
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
