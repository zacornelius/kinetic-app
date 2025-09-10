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
  originalMessage?: string;
  customerEmail: string;
  customerName?: string;
  assignedOwner?: string; // Derived from customer record
  status: "new" | "active" | "assigned" | "closed" | "not_relevant";
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
  assignedOwner?: string; // Derived from customer record
};

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

type TabType = "home" | "queue" | "actions" | "orders" | "customers";

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  source: string;
  status: string;
  totalInquiries: number;
  totalOrders: number;
  totalSpent: number;
  lastContactDate: string;
  assignedTo: string;
  priority: string;
  // Rich CSV data
  reason?: string;
  customerType?: string;
  numberOfDogs?: number;
  originalMessage?: string;
  assignedOwner?: string;
  inquiryStatus?: string;
  inquiryDate?: string;
  inquiryNotes?: string;
  countryCode?: string;
  firstInteractionDate?: string;
  lastInteractionDate?: string;
  interactionCount?: number;
  isActiveInquiry?: boolean;
  inquiryPriority?: string;
  followUpDate?: string;
  leadSource?: string;
  customFields?: any;
};

export default function Home() {
  const { user, logout } = useAuth();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [allInquiries, setAllInquiries] = useState<Inquiry[]>([]); // For counting purposes
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [category, setCategory] = useState<"all" | Category>("all");

  const [customerEmail, setCustomerEmail] = useState("");

  // Helper function to get first 3 lines of message
  const getFirstThreeLines = (message: string | undefined | null) => {
    if (!message || message.trim() === '') return 'Click to view inquiry details';
    
    const text = message.trim();
    const lines = text.split('\n');
    
    // If 3 or fewer lines, show all
    if (lines.length <= 3) {
      return text;
    }
    
    // If more than 3 lines, take first 3 and add ellipsis
    return lines.slice(0, 3).join('\n') + '...';
  };
  
  // Customer management state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('');
  const [customerAssignedFilter, setCustomerAssignedFilter] = useState('');
  const [customerCurrentPage, setCustomerCurrentPage] = useState(0);
  const [customerTotalCustomers, setCustomerTotalCustomers] = useState(0);
  const customerLimit = 20;
  
  // Customer detail modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerNotes, setCustomerNotes] = useState<any[]>([]);
  const [customerTimeline, setCustomerTimeline] = useState<any[]>([]);
  
  // Top Customers pagination and modal
  const [topCustomersPage, setTopCustomersPage] = useState(0);
  const [topCustomersModal, setTopCustomersModal] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);
  
  // Note modal state
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteInquiryId, setNoteInquiryId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState<'note' | 'close'>('note');
  
  // Inquiry detail modal state
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryCustomer, setInquiryCustomer] = useState<any>(null);
  const [inquiryCustomerId, setInquiryCustomerId] = useState<string | null>(null);
  const [inquiryCustomerTimeline, setInquiryCustomerTimeline] = useState<any[]>([]);

  // Sales dashboard state
  const [salesData, setSalesData] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [monthlyPalletsData, setMonthlyPalletsData] = useState<any[]>([]);
  const [bulkInquiriesData, setBulkInquiriesData] = useState<any>(null);
  const [dashboardView, setDashboardView] = useState<'personal' | 'leaderboard'>('personal');
  const [salesLoading, setSalesLoading] = useState(false);


  // Load sales dashboard data
  const loadSalesData = async () => {
    if (!user?.email) return;
    
    try {
      setSalesLoading(true);
      
      // Load sales data
      const salesResponse = await fetch(`/api/sales/dashboard?userEmail=${user.email}&view=${dashboardView}&_t=${Date.now()}`);
      if (salesResponse.ok) {
        const salesResult = await salesResponse.json();
        if (dashboardView === 'personal') {
          setSalesData(salesResult.personal);
          setMonthlyPalletsData(salesResult.monthlyPallets || []);
          setBulkInquiriesData(typeof salesResult.bulkInquiries === 'number' ? salesResult.bulkInquiries : 0);
        } else {
          setLeaderboardData(salesResult.leaderboard);
          setMonthlyPalletsData(salesResult.monthlyPallets || []);
          setBulkInquiriesData(Array.isArray(salesResult.bulkInquiries) ? salesResult.bulkInquiries : []);
        }
      }
      
      // Load top customers
      const customersResponse = await fetch(`/api/sales/top-customers?userEmail=${user.email}&view=${dashboardView}&limit=50&_t=${Date.now()}`);
      if (customersResponse.ok) {
        const customersResult = await customersResponse.json();
        setTopCustomers(customersResult.topCustomers || []);
      }
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      setCustomerLoading(true);
      
      // Use enhanced customer API with better search functionality
      const params = new URLSearchParams();
      params.append('limit', customerLimit.toString());
      params.append('offset', (customerCurrentPage * customerLimit).toString());
      
      if (customerSearch) {
        params.append('search', customerSearch);
      }
      
      if (customerStatusFilter) {
        params.append('status', customerStatusFilter);
      }
      
      if (customerAssignedFilter) {
        params.append('assignedTo', customerAssignedFilter);
      }
      
      // Add cache busting
      params.append('_t', Date.now().toString());
      const response = await fetch(`/api/customers/enhanced?${params}`);
      const data = await response.json();
      
      if (response.ok && data.customers) {
        setCustomers(data.customers);
        setCustomerTotalCustomers(data.pagination?.total || 0);
      } else {
        console.error('API Error:', data);
        setCustomers([]);
        setCustomerTotalCustomers(0);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
      setCustomerTotalCustomers(0);
    } finally {
      setCustomerLoading(false);
    }
  };



  const loadCustomerDetails = async (customerId: string) => {
    try {
      setLoadingCustomer(true);
      
      // Load customer data
      const customerResponse = await fetch(`/api/customers/enhanced?search=${customerId}&limit=1&_t=${Date.now()}`);
      if (!customerResponse.ok) {
        throw new Error(`Failed to fetch customer: ${customerResponse.status}`);
      }
      const customerData = await customerResponse.json();
      
      if (customerData.customers && customerData.customers.length > 0) {
        const customer = customerData.customers[0];
        setSelectedCustomer(customer);
        
        // Load notes
        const notesResponse = await fetch(`/api/customers/notes?customerId=${customerId}`);
        if (notesResponse.ok) {
          const notesData = await notesResponse.json();
          setCustomerNotes(notesData.notes || []);
        } else {
          setCustomerNotes([]);
        }
        
        // Load timeline
        const timelineResponse = await fetch(`/api/customers/${customerId}/timeline`);
        if (timelineResponse.ok) {
          const timelineData = await timelineResponse.json();
          setCustomerTimeline(timelineData.interactions || []);
        } else {
          setCustomerTimeline([]);
        }
        
        setShowCustomerModal(true);
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
    } finally {
      setLoadingCustomer(false);
    }
  };

  const closeCustomerModal = () => {
    setShowCustomerModal(false);
    setSelectedCustomer(null);
    setCustomerNotes([]);
    setCustomerTimeline([]);
  };

  const openNoteModal = (inquiryId: string, type: 'note' | 'close' = 'note') => {
    setNoteInquiryId(inquiryId);
    setNoteType(type);
    setNoteText('');
    setShowNoteModal(true);
  };

  const loadTopCustomerDetails = async (customer: any) => {
    setTopCustomersModal(customer);
    setLoadingCustomer(true);
    
    // Reset timeline and notes
    setCustomerTimeline([]);
    setCustomerNotes([]);
    
    try {
      // Load customer timeline and notes - use email as fallback if no ID
      const customerId = customer.id || customer.email;
      const timelineResponse = await fetch(`/api/customers/${customerId}/timeline?_t=${Date.now()}`);
      const notesResponse = await fetch(`/api/customers/notes?customerId=${customerId}&_t=${Date.now()}`);
      
      if (timelineResponse.ok) {
        const timelineData = await timelineResponse.json();
        setCustomerTimeline(Array.isArray(timelineData.interactions) ? timelineData.interactions : []);
      }
      
      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        setCustomerNotes(Array.isArray(notesData.notes) ? notesData.notes : []);
      }
    } catch (error) {
      console.error('Error loading customer details:', error);
      // Set empty arrays on error
      setCustomerTimeline([]);
      setCustomerNotes([]);
    } finally {
      setLoadingCustomer(false);
    }
  };

  const closeNoteModal = () => {
    setShowNoteModal(false);
    setNoteInquiryId(null);
    setNoteText('');
    setNoteType('note');
  };

  const addNote = async (e: React.FormEvent | string) => {
    // Handle both form submission and button click
    if (typeof e === 'string') {
      // Called from button click with inquiry ID
      if (!noteText.trim() || !e) return;
      setNoteInquiryId(e);
    } else {
      // Called from form submission
      e.preventDefault();
      if (!noteText.trim() || !noteInquiryId) return;
    }

    try {
      // Determine if this is a customer note or inquiry note
      const isCustomerNote = selectedCustomer && !selectedInquiry;
      const customerId = noteInquiryId; // noteInquiryId contains either customer ID or inquiry ID
      const inquiryEmail = isCustomerNote ? selectedCustomer?.email : selectedInquiry?.customerEmail;


      const response = await fetch('/api/customers/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId, // Use customer ID if available
          inquiryEmail: inquiryEmail, // Fallback to email
          note: noteText,
          type: noteType === 'note' ? 'general' : 'general',
          authorEmail: user?.email || 'system'
        })
      });

      if (response.ok) {
        
        // If closing, also update inquiry status (only for inquiry notes)
        if (noteType === 'close' && !isCustomerNote) {
          await fetch('/api/inquiries', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: noteInquiryId,
              status: 'closed'
            })
          });
        }
        
        closeNoteModal();
        refresh(); // Refresh the inquiry list
        
        // Refresh timeline if we're in inquiry modal
        if (inquiryCustomerId) {
          try {
            const timelineResponse = await fetch(`/api/customers/${inquiryCustomerId}/timeline?_t=${Date.now()}`);
            if (timelineResponse.ok) {
              const timelineData = await timelineResponse.json();
              setInquiryCustomerTimeline(timelineData.interactions || []);
            }
          } catch (error) {
            console.error('Error refreshing timeline:', error);
          }
        }
      } else {
        console.error('Response not ok:', response.status, response.statusText);
        try {
          const errorData = await response.json();
          console.error('Error adding note:', errorData);
        } catch (jsonError) {
          console.error('Failed to parse error response as JSON:', jsonError);
          const textResponse = await response.text();
          console.error('Raw response:', textResponse);
        }
      }
    } catch (error) {
      console.error('Error adding note:', error);
    }
  };

  const loadInquiryDetails = async (inquiry: any) => {
    try {
      setSelectedInquiry(inquiry);
      
      // Load customer details for this inquiry
      const customerResponse = await fetch(`/api/customers/enhanced?search=${inquiry.customerEmail}&limit=1&_t=${Date.now()}`);
      const customerData = await customerResponse.json();
      
      if (customerData.customers && customerData.customers.length > 0) {
        const customer = customerData.customers[0];
        setInquiryCustomer(customer);
        setInquiryCustomerId(customer.id);
        
        // Load customer timeline (includes notes)
        try {
          const timelineResponse = await fetch(`/api/customers/${customer.id}/timeline?_t=${Date.now()}`);
          if (timelineResponse.ok) {
            const timelineData = await timelineResponse.json();
            setInquiryCustomerTimeline(timelineData.interactions || []);
          } else {
            setInquiryCustomerTimeline([]);
          }
        } catch (error) {
          console.error('Error loading customer timeline:', error);
          setInquiryCustomerTimeline([]);
        }
      } else {
        setInquiryCustomer(null);
        setInquiryCustomerId(null);
        setInquiryCustomerTimeline([]);
      }
      
      setShowInquiryModal(true);
    } catch (error) {
      console.error('Error loading inquiry details:', error);
    }
  };

  const closeInquiryModal = () => {
    setShowInquiryModal(false);
    setSelectedInquiry(null);
    setInquiryCustomer(null);
    setInquiryCustomerId(null);
    setInquiryCustomerTimeline([]);
  };

  const closeAllModals = () => {
    setShowInquiryModal(false);
    setShowCustomerModal(false);
    setShowNoteModal(false);
    setSelectedInquiry(null);
    setSelectedCustomer(null);
    setInquiryCustomer(null);
    setInquiryCustomerId(null);
    setInquiryCustomerTimeline([]);
    setCustomerNotes([]);
    setCustomerTimeline([]);
  };

  const handleTabChange = (tab: TabType) => {
    closeAllModals();
    setActiveTab(tab);
  };

  async function refresh() {
    const params = category === "all" ? `?_t=${Date.now()}` : `?category=${category}&_t=${Date.now()}`;
    const [inquiriesRes, ordersRes] = await Promise.all([
      fetch(`/api/inquiries${params}`, { 
        cache: "no-store"
      }),
      fetch("/api/orders", { cache: "no-store" })
    ]);
    const inquiriesData = await inquiriesRes.json();
    const ordersData = await ordersRes.json();
    setInquiries(inquiriesData);
    setOrders(ordersData);
    
    // Only load all inquiries if we don't have them yet or if category is "all"
    if (category === "all" || allInquiries.length === 0) {
      const allInquiriesRes = await fetch(`/api/inquiries?_t=${Date.now()}`);
      const allInquiriesData = await allInquiriesRes.json();
      setAllInquiries(allInquiriesData);
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => {
    loadUsers();
  }, []);

  // Load all inquiries for counting on initial load
  useEffect(() => {
    const loadAllInquiries = async () => {
      const res = await fetch('/api/inquiries', { cache: "no-store" });
      const data = await res.json();
      setAllInquiries(data);
    };
    loadAllInquiries();
  }, []);

  // Load customers when customer tab is active
  useEffect(() => {
    if (activeTab === 'customers') {
      // Load all customers by default (no automatic filtering)
      setCustomerCurrentPage(0);
      loadCustomers();
    }
  }, [activeTab, user?.email]);

  // Reload customers when filter states change
  useEffect(() => {
    if (activeTab === 'customers') {
      loadCustomers();
    }
  }, [customerAssignedFilter, customerStatusFilter, customerSearch, customerCurrentPage]);

  useEffect(() => {
    if (activeTab === "home") {
      loadSalesData();
    }
  }, [activeTab, dashboardView, user?.email]);


  async function takeOwnership(id: string) {
    if (!user) {
      alert("Please sign in first");
      return;
    }
    
    try {
      // Update inquiry ownership
      await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id, 
          action: "take", 
          salesPersonEmail: user.email 
        }),
      });

      // Refresh data
      refresh();
    } catch (error) {
      console.error("Error taking ownership:", error);
    }
  }


  async function takeInquiry(id: string) {
    try {
      await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id, 
          action: "take", 
          salesPersonEmail: user?.email 
        }),
      });

      // Close modal and refresh data
      closeInquiryModal();
      refresh();
    } catch (error) {
      console.error("Error taking inquiry:", error);
    }
  }

  async function markNotRelevant(id: string) {
    try {
    await fetch("/api/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id, 
          action: "not_relevant" 
        }),
    });

      // Close modal and refresh data
      closeInquiryModal();
      refresh();
    } catch (error) {
      console.error("Error marking inquiry as not relevant:", error);
    }
  }

  async function closeInquiry(id: string) {
    try {
      console.log("Closing inquiry:", id);
      console.log("Current modal state:", showInquiryModal);
      
      // Close the inquiry
      const response = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "closed" }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to close inquiry: ${response.status}`);
      }
      
      console.log("Inquiry closed successfully");
      console.log("About to close modal...");
      
      // Close the modal
      closeInquiryModal();
      console.log("Modal close function called");
      
      // Refresh data
      refresh();
      console.log("Refresh function called");
      
    } catch (error) {
      console.error("Error closing inquiry:", error);
      // Still close modal and refresh even if API fails
      console.log("Error occurred, still closing modal...");
      closeInquiryModal();
      refresh();
    }
  }

  async function reassignInquiry(id: string, newOwnerEmail: string) {
    try {
      // Update the inquiry
      await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, assignedOwner: newOwnerEmail || null }),
      });

      // Find the inquiry to get customer email
      const inquiry = inquiries.find((i: any) => i.id === id);
      if (inquiry) {
        // Check if customer exists and update their assignedOwner
        const customerResponse = await fetch(`/api/customers/enhanced?search=${encodeURIComponent(inquiry.customerEmail)}&limit=1&_t=${Date.now()}`);
        const customerData = await customerResponse.json();
        const customer = customerData.customers?.[0];
        
        if (customer) {
          // Update the customer's assignedOwner
          await fetch("/api/customers/enhanced", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: customer.id,
              assignedOwner: newOwnerEmail || null
            })
          });
    } else {
          // If customer doesn't exist, we'll let the system create one when needed
          // Customer not found for this inquiry
        }
      }

      refresh();
    } catch (error) {
      console.error("Error reassigning inquiry:", error);
      refresh();
    }
  }

  async function reassignCustomer(customerId: string, newOwnerEmail: string) {
    try {
      // Update the customer's assignedOwner
      await fetch("/api/customers/enhanced", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customerId,
          assignedOwner: newOwnerEmail || null
        })
      });

      // Also update all inquiries for this customer
      const customer = customers.find((c: any) => c.id === customerId);
      if (customer) {
        // Get all inquiries for this customer
        const inquiryResponse = await fetch(`/api/inquiries?customerEmail=${encodeURIComponent(customer.email)}`);
        const customerInquiries = await inquiryResponse.json();
        
        // Update each inquiry
        for (const inquiry of customerInquiries) {
          await fetch("/api/inquiries", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              id: inquiry.id, 
              assignedOwner: newOwnerEmail || null 
            }),
          });
        }
      }

      refresh();
    } catch (error) {
      console.error("Error reassigning customer:", error);
      refresh();
    }
  }

  function signOut() {
    logout();
  }

  // Data filtering
  const unassignedInquiries = useMemo(() => 
    inquiries.filter(q => q.status === "new" || (q.status === "active" && !q.assignedOwner)), [inquiries]);
  
  const assignedInquiries = useMemo(() => 
    inquiries.filter(q => q.assignedOwner === user?.email && q.status === "active"), [inquiries, user]);

  // Simplified inquiry filtering - use allInquiries for consistent counts
  const newInquiries = useMemo(() => 
    allInquiries.filter(q => q.status === "new"), [allInquiries]);

  const activeInquiries = useMemo(() => 
    allInquiries.filter(q => q.status === "active" && q.assignedOwner === user?.email), [allInquiries, user]);

  const currentOrders = useMemo(() => 
    orders.filter(o => o.assignedOwner === user?.email && o.status !== "delivered" && o.status !== "cancelled"), [orders, user]);

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
      <div className="space-y-6">
        {/* Header with Leaderboard Toggle */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Sales Dashboard</h2>
          <button
            onClick={() => setDashboardView(dashboardView === 'personal' ? 'leaderboard' : 'personal')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {dashboardView === 'personal' ? 'Leaderboard' : 'My Sales'}
          </button>
        </div>

        {salesLoading ? (
          <div className="text-center py-8">
            <div className="text-white">Loading sales data...</div>
          </div>
        ) : (
          <>
            {/* Sales This Month - Top Priority */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">
                  {dashboardView === 'personal' ? 'My Sales This Month' : 'Team Sales This Month'}
                </h3>
              </div>
              {dashboardView === 'personal' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">${(salesData?.this_month_sales || 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-600">Revenue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{salesData?.this_month_orders || 0}</div>
                    <div className="text-xs text-gray-600">Orders</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{typeof bulkInquiriesData === 'number' ? bulkInquiriesData : 0}</div>
                    <div className="text-xs text-gray-600">Bulk Inquiries</div>
                    <div className="text-[10px] text-gray-500">Last 60 days</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboardData.map((member, index) => {
                    const memberBulkInquiries = bulkInquiriesData?.find((b: any) => b.owner === member.owner)?.bulk_inquiries_count || 0;
                    return (
                      <div key={member.owner} className="flex items-center justify-between bg-blue-500 bg-opacity-30 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-bold">#{index + 1}</div>
                          <div>
                            <div className="font-semibold">
                              {member.owner === 'iand@kineticdogfood.com' ? 'Ian' : 
                               member.owner === 'ericb@kineticdogfood.com' ? 'Eric' : 
                               member.owner === 'Dave@kineticdogfood.com' ? 'Dave' : member.owner}
                            </div>
                            <div className="text-sm opacity-90">{member.this_month_orders} orders</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold">${member.this_month_sales.toLocaleString()}</div>
                          <div className="text-xs opacity-75">{memberBulkInquiries} bulk inquiries</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 12-Month Pallets Sold Trend */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">
                  {dashboardView === 'personal' ? 'My Sales Trend' : 'Team Sales Trend'}
                </h3>
              </div>
              
              {monthlyPalletsData.length > 0 ? (
                <div className="space-y-4">
                  {/* Chart */}
                  <div className="relative">
                    <div className="h-40 flex items-end justify-between gap-1 px-2">
                      {monthlyPalletsData.map((month, index) => {
                        const maxPallets = Math.max(...monthlyPalletsData.map(m => parseInt(m.pallets_sold)));
                        const height = maxPallets > 0 ? (parseInt(month.pallets_sold) / maxPallets) * 150 : 2;
                        // Parse the month string directly to avoid timezone issues
                        const monthStr = month.month; // e.g., "2024-10-01T00:00:00.000Z"
                        const year = parseInt(monthStr.substring(0, 4));
                        const monthNum = parseInt(monthStr.substring(5, 7)) - 1; // Convert to 0-based
                        
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthName = monthNames[monthNum];
                        
                        // Debug logging
                        console.log(`Month data: ${month.month}, Year: ${year}, Month num: ${monthNum}, Month name: ${monthName}`);
                        
                        // Check if this is current month (September 2025)
                        const isCurrentMonth = monthNum === 8 && year === 2025; // September 2025
                        
                        return (
                          <div key={index} className="flex flex-col items-center flex-1 min-w-0">
                            <div
                              className={`w-full rounded-t transition-all duration-300 ${
                                isCurrentMonth
                                  ? 'bg-gradient-to-t from-[#C43C37] to-[#E53E3E]'
                                  : 'bg-gradient-to-t from-gray-400 to-gray-300'
                              }`}
                              style={{ height: `${height}px` }}
                              title={`${monthName}: ${parseInt(month.pallets_sold)} pallets`}
                            />
                            <div className="text-xs text-gray-600 mt-2 text-center">
                              {monthName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {parseInt(month.pallets_sold)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Scale */}
                    <div className="absolute left-0 top-0 h-40 flex flex-col justify-between text-xs text-gray-400 -ml-8">
                      <span>{Math.max(...monthlyPalletsData.map(m => parseInt(m.pallets_sold)))}</span>
                      <span>{Math.round(Math.max(...monthlyPalletsData.map(m => parseInt(m.pallets_sold))) / 2)}</span>
                      <span>0</span>
                    </div>
                  </div>
                  
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {monthlyPalletsData.reduce((sum, month) => sum + parseInt(month.pallets_sold), 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round(monthlyPalletsData.reduce((sum, month) => sum + parseInt(month.pallets_sold), 0) / monthlyPalletsData.length)}
                      </div>
                      <div className="text-sm text-gray-600">Avg</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {Math.max(...monthlyPalletsData.map(m => parseInt(m.pallets_sold)))}
                      </div>
                      <div className="text-sm text-gray-600">Best</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-sm">No sales data available</div>
                </div>
              )}
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-green-600 rounded-full"></div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {dashboardView === 'personal' ? 'My Top Customers' : 'Top Customers'}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTopCustomersPage(Math.max(0, topCustomersPage - 1))}
                    disabled={topCustomersPage === 0}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-600 px-2">
                    {topCustomersPage * 5 + 1}-{Math.min((topCustomersPage + 1) * 5, topCustomers.length)} of {topCustomers.length}
                  </span>
                  <button
                    onClick={() => setTopCustomersPage(topCustomersPage + 1)}
                    disabled={(topCustomersPage + 1) * 5 >= topCustomers.length}
                    className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {topCustomers.slice(topCustomersPage * 5, (topCustomersPage + 1) * 5).map((customer, index) => (
                  <div 
                    key={customer.email} 
                    onClick={() => loadTopCustomerDetails(customer)}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-lg font-bold text-blue-600">#{topCustomersPage * 5 + index + 1}</div>
                      <div>
                        <div className="font-semibold text-gray-900">
                          {customer.firstname} {customer.lastname}
                        </div>
                        <div className="text-sm text-gray-600">{customer.email}</div>
                        {dashboardView === 'leaderboard' && (
                          <div className="text-xs text-gray-500">
                            Owner: {customer.owner === 'iand@kineticdogfood.com' ? 'Ian' : 
                                   customer.owner === 'ericb@kineticdogfood.com' ? 'Eric' : 
                                   customer.owner === 'Dave@kineticdogfood.com' ? 'Dave' : customer.owner}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">${customer.total_spent.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">{customer.order_count} orders</div>
                    </div>
                  </div>
                ))}
                {topCustomers.length === 0 && (
                  <div className="text-center py-4 text-gray-500">No customer data available</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderQueueTab() {
    return (
      <div className="space-y-4">
        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(["all", "bulk", "issues", "questions"] as const).map((c) => {
            // "New" tab shows new inquiries, other tabs show active inquiries
            const count = c === "all" ? newInquiries.length : activeInquiries.filter(q => q.category === c).length;
            return (
            <button
              key={c}
              onClick={() => setCategory(c as any)}
                className={`px-3 py-1 rounded-full text-sm whitespace-nowrap relative ${
                category === c 
                    ? "bg-[#3B83BE] text-white" 
                  : "bg-white text-gray-600 border"
              }`}
            >
                <div className="flex items-center gap-1">
                  {c === "all" ? "New" : c === "bulk" ? "Bulk" : c === "issues" ? "Issue" : "Question"}
                  {count > 0 && (
                    <span className="bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center font-bold text-[10px]">
                      {count}
                    </span>
                  )}
                </div>
            </button>
            );
          })}
        </div>



        {/* Inquiries based on category */}
        <div className="space-y-4">
          {category === "all" ? (
            <>
          <h3 className="text-sm font-medium text-red-600">
                New Inquiries
          </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inquiries.filter(q => q.status === "new" || (q.status === "active" && !q.assignedOwner)).map((q) => (
            <div 
              key={`unassigned-${q.id}`} 
              onClick={() => loadInquiryDetails(q)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">{q.customerName || q.customerEmail}</h3>
                  <div className="text-sm text-gray-600 mb-2 overflow-hidden" style={{height: '4.5rem', lineHeight: '1.5rem'}}>
                    <div style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                      {getFirstThreeLines(q.originalMessage)}
                  </div>
                </div>
                  <p className="text-xs text-gray-400">
                    {new Date(q.createdAt).toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ml-2 ${
                  q.category === "issues" ? "bg-red-100 text-red-800" :
                  q.category === "questions" ? "bg-blue-100 text-blue-800" :
                  "bg-green-100 text-green-800"
                }`}>
                  {q.category === "issues" ? "Issue" : q.category === "questions" ? "Question" : q.category.charAt(0).toUpperCase() + q.category.slice(1)}
                </span>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex gap-2 justify-start">
                  {user && (
                  <button
                      onClick={(e) => {
                        e.stopPropagation();
                        takeOwnership(q.id);
                      }}
                      className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                  >
                    Take
                  </button>
                )}
                <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markNotRelevant(q.id);
                    }}
                    className="px-2 py-1 bg-gray-500 text-white rounded text-xs font-medium hover:bg-gray-600"
                >
                  Not Relevant
                </button>
                </div>
              </div>
            </div>
          ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-medium text-blue-600">
                {category === "bulk" ? "My Bulk Prospects" : category === "issues" ? "My Issues" : "My Questions"}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignedInquiries.filter(q => q.category === category).map((q) => (
                <div 
                  key={`assigned-${category}-${q.id}`} 
                  onClick={() => loadInquiryDetails(q)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">{q.customerName || q.customerEmail}</h3>
                      <div className="text-sm text-gray-600 mb-2 overflow-hidden" style={{height: '4.5rem', lineHeight: '1.5rem'}}>
                    <div style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                      {getFirstThreeLines(q.originalMessage)}
                    </div>
                  </div>
                      <p className="text-xs text-gray-400">
                        {new Date(q.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ml-2 ${
                      q.category === "issues" ? "bg-red-100 text-red-800" :
                      q.category === "questions" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {q.category === "issues" ? "Issue" : q.category === "questions" ? "Question" : q.category.charAt(0).toUpperCase() + q.category.slice(1)}
                    </span>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-500 text-center">Click to view details and manage</p>
                  </div>
                </div>
              ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderActionsTab() {
    return (
      <div className="space-y-4">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-green-600">
            My Assigned Inquiries ({assignedInquiries.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assignedInquiries.map((q) => (
                <div 
                  key={`my-inquiries-${q.id}`} 
                  onClick={() => loadInquiryDetails(q)}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">{q.customerName || q.customerEmail}</h3>
                      <div className="text-sm text-gray-600 mb-2 overflow-hidden" style={{height: '4.5rem', lineHeight: '1.5rem'}}>
                    <div style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                      {getFirstThreeLines(q.originalMessage)}
                  </div>
                  </div>
                      <p className="text-xs text-gray-400">
                        {new Date(q.createdAt).toLocaleString()}
                      </p>
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
              
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">Click to view details</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">{q.assignedOwner || 'Unassigned'}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newOwner = prompt('Enter new owner email (or leave blank to unassign):', q.assignedOwner || '');
                        if (newOwner !== null) {
                          reassignInquiry(q.id, newOwner);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Change
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          </div>
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
        {/* Master Customer Lookup */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left side - Enhanced search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 max-w-lg flex gap-2">
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerCurrentPage(0);
                    // Debounce the search
                    clearTimeout((window as any).searchTimeout);
                    (window as any).searchTimeout = setTimeout(() => {
                      loadCustomers();
                    }, 300);
                  }}
                  placeholder="Search by name, email, company, phone..."
                  className="flex-1 p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={() => {
                    setCustomerSearch('');
                    setCustomerAssignedFilter('');
                    setCustomerStatusFilter('');
                    setCustomerCurrentPage(0);
                    loadCustomers();
                  }}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
                >
                  Clear
                </button>
              </div>
            </div>
            
            {/* Right side - Quick filters */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCustomerStatusFilter('customer');
                  setCustomerAssignedFilter('');
                  setCustomerSearch('');
                  setCustomerCurrentPage(0);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium ${
                  customerStatusFilter === 'customer' && !customerAssignedFilter ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Customers Only
              </button>
              <button
                onClick={() => {
                  setCustomerStatusFilter('contact');
                  setCustomerAssignedFilter('');
                  setCustomerSearch('');
                  setCustomerCurrentPage(0);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium ${
                  customerStatusFilter === 'contact' && !customerAssignedFilter ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Contacts Only
              </button>
              <button
                onClick={() => {
                  setCustomerAssignedFilter('');
                  setCustomerStatusFilter('');
                  setCustomerSearch('');
                  setCustomerCurrentPage(0);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium ${
                  customerAssignedFilter === '' && customerStatusFilter === '' && customerSearch === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Customers
              </button>
            </div>
          </div>
        </div>

        {/* Customer Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customerLoading ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            customers.map((customer) => (
              <div 
                key={customer.id} 
                onClick={() => loadCustomerDetails(customer.id)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 cursor-pointer transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {customer.firstName} {customer.lastName}
            </h3>
                    <p className="text-sm text-gray-500 truncate">{customer.email}</p>
                    {customer.companyName && (
                      <p className="text-xs text-gray-400 truncate">{customer.companyName}</p>
                    )}
          </div>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    customer.status === 'customer' ? 'bg-green-100 text-green-800' :
                    customer.status === 'prospect' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {customer.status}
                  </span>
                    </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Orders:</span>
                    <span className="font-medium">{customer.totalOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Revenue:</span>
                    <span className="font-medium">${customer.totalSpent.toFixed(2)}</span>
                    </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Assigned:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-medium truncate text-xs">{customer.assignedTo || customer.assignedOwner || 'Unassigned'}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Show a simple prompt for now, could be enhanced with a modal later
                          const newOwner = prompt('Enter new owner email (or leave blank to unassign):', customer.assignedTo || customer.assignedOwner || '');
                          if (newOwner !== null) {
                            reassignCustomer(customer.id, newOwner);
                          }
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Source:</span>
                    <span className="font-medium capitalize">{customer.source}</span>
                </div>
                </div>
                
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 text-center">Click to view details</p>
              </div>
          </div>
            ))
          )}
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
            onClick={() => handleTabChange("home")}
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
              onClick={() => handleTabChange("queue")}
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
                  {newInquiries.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full h-2 w-2"></span>
                  )}
                </div>
                <span className="text-xs">Queue</span>
              </div>
            </button>
          <button
            onClick={() => handleTabChange("actions")}
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
            onClick={() => handleTabChange("orders")}
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
            onClick={() => handleTabChange("customers")}
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

        {/* Customer Detail Modal */}
        {showCustomerModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </h2>
                  <p className="text-sm text-gray-600">{selectedCustomer.email}</p>
                </div>
                <button
                  onClick={closeCustomerModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {loadingCustomer ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Customer Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">${selectedCustomer.totalSpent?.toFixed(2) || '0'}</div>
                        <div className="text-sm text-gray-600">Total Spent</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{selectedCustomer.totalOrders || 0}</div>
                        <div className="text-sm text-gray-600">Total Orders</div>
                      </div>
                    </div>

                    {/* Customer Details */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Customer Information</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium">{selectedCustomer.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium">{selectedCustomer.phone || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Company:</span>
                          <span className="font-medium">{selectedCustomer.companyName || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Type:</span>
                          <span className="font-medium">{selectedCustomer.customerType || 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Number of Dogs:</span>
                          <span className="font-medium">{selectedCustomer.numberOfDogs || 'Not specified'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedCustomer.status === 'customer' ? 'bg-green-100 text-green-800' :
                            selectedCustomer.status === 'prospect' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedCustomer.status || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Source:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            selectedCustomer.source === 'shopify' ? 'bg-green-100 text-green-800' :
                            selectedCustomer.source === 'quickbooks' ? 'bg-blue-100 text-blue-800' :
                            selectedCustomer.source === 'website' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedCustomer.source || 'Unknown'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Assigned To:</span>
                          <span className="font-medium">{selectedCustomer.assignedOwner || selectedCustomer.assignedTo || 'Unassigned'}</span>
                        </div>
                        {selectedCustomer.reason && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Inquiry Reason:</span>
                            <span className="font-medium">{selectedCustomer.reason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
                      <div className="space-y-3">
                        {[...(customerTimeline || []), ...(customerNotes || []).map(note => ({
                          id: `note-${note.id}`,
                          type: 'note',
                          subject: 'Note',
                          content: note.note,
                          createdAt: note.createdAt,
                          authorEmail: note.authorEmail,
                          authorName: note.authorName
                        }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item, index) => (
                          <div key={item.id || index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{item.subject}</div>
                              <div className="text-xs text-gray-600 mt-1">{item.content}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(item.createdAt).toLocaleString()}
                                {item.authorEmail && ` • by ${item.authorEmail}`}
                                {item.authorName && !item.authorEmail && ` • by ${item.authorName}`}
                              </div>
                              {item.metadata && (
                                <div className="mt-1 text-xs text-gray-500">
                                  {item.type === 'order' && item.metadata.totalAmount && (
                                    <span>Amount: ${item.metadata.totalAmount.toFixed(2)} | Status: {item.metadata.status}</span>
                                  )}
                                  {item.type === 'customer_inquiry' && item.metadata.reason && (
                                    <span>Reason: {item.metadata.reason} | Type: {item.metadata.customerType}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {(customerTimeline || []).length === 0 && (customerNotes || []).length === 0 && (
                          <div className="text-center py-4 text-gray-500">
                            <div className="text-3xl mb-2">📝</div>
                            <div className="text-sm">No activity recorded yet</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={closeCustomerModal}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    closeCustomerModal();
                    openNoteModal(selectedCustomer.id, 'note');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Customers Modal */}
        {topCustomersModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              {/* Modal Header with Buttons */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {topCustomersModal.firstname} {topCustomersModal.lastname}
                    </h2>
                    <p className="text-sm text-gray-600">{topCustomersModal.email}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setTopCustomersModal(null);
                        openNoteModal(topCustomersModal.id, 'note');
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                    >
                      Add Note
                    </button>
                    <button
                      onClick={() => setTopCustomersModal(null)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {loadingCustomer ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Customer Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">${topCustomersModal.total_spent?.toLocaleString() || '0'}</div>
                        <div className="text-sm text-gray-600">Lifetime Value</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{topCustomersModal.order_count || 0}</div>
                        <div className="text-sm text-gray-600">Purchase History</div>
                      </div>
                    </div>

                    {/* Customer Details */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Customer Information</h3>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Email:</span>
                          <span className="font-medium">{topCustomersModal.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Phone:</span>
                          <span className="font-medium">{topCustomersModal.phone || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Company:</span>
                          <span className="font-medium">{topCustomersModal.company || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Status:</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            topCustomersModal.status === 'active' ? 'bg-green-100 text-green-800' :
                            topCustomersModal.status === 'inactive' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {topCustomersModal.status || 'Unknown'}
                          </span>
                        </div>
                        {dashboardView === 'leaderboard' && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Owner:</span>
                            <span className="font-medium">
                              {topCustomersModal.owner === 'iand@kineticdogfood.com' ? 'Ian' : 
                               topCustomersModal.owner === 'ericb@kineticdogfood.com' ? 'Eric' : 
                               topCustomersModal.owner === 'Dave@kineticdogfood.com' ? 'Dave' : topCustomersModal.owner}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    {topCustomersModal.address && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-900">Address</h3>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-700">{topCustomersModal.address}</p>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {topCustomersModal.notes && (
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm text-gray-700">{topCustomersModal.notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
                      <div className="space-y-3">
                        {[...(customerTimeline || []), ...(customerNotes || []).map(note => ({
                          id: `note-${note.id}`,
                          type: 'note',
                          subject: 'Note',
                          content: note.note,
                          createdAt: note.createdAt,
                          authorEmail: note.authorEmail,
                          authorName: note.authorName
                        }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item, index) => (
                          <div key={item.id || index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900">{item.subject}</div>
                              <div className="text-xs text-gray-600 mt-1">{item.content}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {new Date(item.createdAt).toLocaleString()}
                                {item.authorEmail && ` • by ${item.authorEmail}`}
                                {item.authorName && !item.authorEmail && ` • by ${item.authorName}`}
                              </div>
                              {item.metadata && (
                                <div className="mt-1 text-xs text-gray-500">
                                  {item.type === 'order' && item.metadata.totalAmount && (
                                    <span>Amount: ${item.metadata.totalAmount.toFixed(2)} | Status: {item.metadata.status}</span>
                                  )}
                                  {item.type === 'customer_inquiry' && item.metadata.reason && (
                                    <span>Reason: {item.metadata.reason} | Type: {item.metadata.customerType}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {(customerTimeline || []).length === 0 && (customerNotes || []).length === 0 && (
                          <div className="text-center py-4 text-gray-500">
                            <div className="text-3xl mb-2">📝</div>
                            <div className="text-sm">No activity recorded yet</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Inquiry Detail Modal */}
        {showInquiryModal && selectedInquiry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {inquiryCustomer?.firstName && inquiryCustomer?.lastName 
                    ? `${inquiryCustomer.firstName} ${inquiryCustomer.lastName}`
                    : selectedInquiry?.customerName || selectedInquiry?.customerEmail}
                </h2>
                <div className="flex items-center gap-2">
                  {/* Action Buttons */}
                  {(selectedInquiry.status === "new" || (selectedInquiry.status === "active" && !selectedInquiry.assignedOwner)) ? (
                    // New inquiry or unassigned active inquiry - show Take and Not Relevant
                    <>
                      <button
                        onClick={() => takeInquiry(selectedInquiry.id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Take Inquiry
                      </button>
                      <button
                        onClick={() => markNotRelevant(selectedInquiry.id)}
                        className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                      >
                        Not Relevant
                      </button>
                    </>
                  ) : selectedInquiry.status === "active" ? (
                    // Active inquiry - show Add Note, Close
                    <>
                      <button
                        onClick={() => {
                          setNoteInquiryId(inquiryCustomerId);
                          setNoteType('note');
                          setShowNoteModal(true);
                        }}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        Add Note
                      </button>
                      <button
                        onClick={() => closeInquiry(selectedInquiry.id)}
                        className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                      >
                        Close
                      </button>
                    </>
                  ) : null}
                  <button
                    onClick={closeInquiryModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl ml-2"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {/* Inquiry Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Inquiry Details</h3>
                      <div className="space-y-2">
                        <div><span className="font-medium">Category:</span> 
                          <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            selectedInquiry.category === "issues" ? "bg-red-100 text-red-800" :
                            selectedInquiry.category === "questions" ? "bg-blue-100 text-blue-800" :
                            "bg-green-100 text-green-800"
                          }`}>
                            {selectedInquiry.category === "issues" ? "Issue" : selectedInquiry.category === "questions" ? "Question" : selectedInquiry.category.charAt(0).toUpperCase() + selectedInquiry.category.slice(1)}
                          </span>
                        </div>
                        <div><span className="font-medium">Status:</span> 
                          <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            selectedInquiry.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                          }`}>
                            {selectedInquiry.status}
                          </span>
                        </div>
                        <div><span className="font-medium">Created:</span> {new Date(selectedInquiry.createdAt).toLocaleString()}</div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Assigned To:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">{selectedInquiry.assignedOwner || 'Unassigned'}</span>
                            <button
                              onClick={() => {
                                const newOwner = prompt('Enter new owner email (or leave blank to unassign):', selectedInquiry.assignedOwner || '');
                                if (newOwner !== null) {
                                  reassignInquiry(selectedInquiry.id, newOwner);
                                }
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h3>
                      {inquiryCustomer ? (
                        <div className="space-y-2">
                          <div><span className="font-medium">Name:</span> {inquiryCustomer.firstName} {inquiryCustomer.lastName}</div>
                          <div><span className="font-medium">Email:</span> {inquiryCustomer.email}</div>
                          {inquiryCustomer.phone && (
                            <div><span className="font-medium">Phone:</span> {inquiryCustomer.phone}</div>
                          )}
                          {inquiryCustomer.companyName && (
                            <div><span className="font-medium">Company:</span> {inquiryCustomer.companyName}</div>
                          )}
                          {inquiryCustomer.customerType && (
                            <div><span className="font-medium">Type:</span> {inquiryCustomer.customerType}</div>
                          )}
                          {inquiryCustomer.numberOfDogs && (
                            <div><span className="font-medium">Number of Dogs:</span> {inquiryCustomer.numberOfDogs}</div>
                          )}
                          <div><span className="font-medium">Status:</span> 
                            <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              inquiryCustomer.status === 'customer' ? 'bg-green-100 text-green-800' :
                              inquiryCustomer.status === 'contact' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {inquiryCustomer.status}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div><span className="font-medium">Name:</span> {selectedInquiry?.customerName || 'Not provided'}</div>
                          <div><span className="font-medium">Email:</span> {selectedInquiry?.customerEmail}</div>
                          <div className="text-gray-500 text-sm mt-2">
                            This is a new inquiry. Customer name will be captured from the contact form when the inquiry is submitted.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Customer Timeline or Inquiry Message */}
                  {inquiryCustomer ? (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Timeline</h3>
                      <div className="space-y-4">
                        {inquiryCustomerTimeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item, index) => {
                          const isCurrentInquiry = item.id === selectedInquiry?.id;
                          return (
                            <div key={item.id || index} className={`border-l-4 pl-4 ${isCurrentInquiry ? 'border-blue-500 bg-blue-50' : 'border-blue-200'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-gray-900">{item.subject || item.type}</h4>
                                  {isCurrentInquiry && (
                                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      Current Inquiry
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-gray-600 mt-1">{item.content || item.description || item.note || 'No description available'}</p>
                              {item.authorEmail && (
                                <p className="text-sm text-gray-500 mt-1">by {item.authorEmail}</p>
                              )}
                              {item.authorName && !item.authorEmail && (
                                <p className="text-sm text-gray-500 mt-1">by {item.authorName}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Inquiry Message</h3>
                      <div className="bg-gray-50 rounded-lg p-4 border">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">
                          {selectedInquiry?.originalMessage || selectedInquiry?.message || 'No message available'}
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </div>
        )}

        {/* Note Modal */}
        {showNoteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  {noteType === 'close' ? 'Close Inquiry' : 'Add Note'}
                </h3>
              </div>
              <form onSubmit={addNote} className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {noteType === 'close' ? 'Closing Note (Required)' : 'Note'}
                  </label>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder={noteType === 'close' ? 'Please provide a reason for closing this inquiry...' : 'Add your note here...'}
                    className="w-full p-3 border border-gray-300 rounded-md text-sm h-24 resize-none"
                  required
                />
              </div>
                <div className="flex gap-3 justify-end">
                <button
                  type="button"
                    onClick={closeNoteModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button 
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                    {noteType === 'close' ? 'Close Inquiry' : 'Add Note'}
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

