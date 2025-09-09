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
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Customer management state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSourceFilter, setCustomerSourceFilter] = useState('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState('');
  const [customerAssignedFilter, setCustomerAssignedFilter] = useState('');
  const [customerCurrentPage, setCustomerCurrentPage] = useState(0);
  const [customerTotalPages, setCustomerTotalPages] = useState(0);
  const [customerTotalCustomers, setCustomerTotalCustomers] = useState(0);
  const [customerFilterCounts, setCustomerFilterCounts] = useState({ my_customers: 0, my_contacts: 0, all: 0 });
  const customerLimit = 20;
  
  // Customer detail modal state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerNotes, setCustomerNotes] = useState<any[]>([]);
  const [customerTimeline, setCustomerTimeline] = useState<any[]>([]);
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

  const loadCustomerFilterCounts = async () => {
    try {
      const response = await fetch(`/api/customers/counts?assignedTo=${user?.email}&_t=${Date.now()}`);
      const data = await response.json();
      
      if (response.ok && data.counts) {
        setCustomerFilterCounts(data.counts);
      }
    } catch (error) {
      console.error('Error loading customer filter counts:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      setCustomerLoading(true);
      
      // Convert old filter logic to new filter system
      let filter = 'all';
      if (customerAssignedFilter === user?.email && customerStatusFilter === 'customer') {
        filter = 'my_customers';
      } else if (customerAssignedFilter === user?.email && customerStatusFilter === 'contact') {
        filter = 'my_contacts';
      }
      

      const params = new URLSearchParams({
        filter: filter,
        limit: customerLimit.toString(),
        offset: (customerCurrentPage * customerLimit).toString()
      });

      if (customerSearch) params.append('search', customerSearch);
      if (user?.email) params.append('assignedTo', user.email);

      const response = await fetch(`/api/customers/simple?${params}`);
      const data = await response.json();
      
      if (response.ok && data.customers) {
        setCustomers(data.customers);
        setCustomerTotalCustomers(data.pagination?.total || 0);
        setCustomerTotalPages(Math.ceil((data.pagination?.total || 0) / customerLimit));
      } else {
        console.error('API Error:', data);
        setCustomers([]);
        setCustomerTotalCustomers(0);
        setCustomerTotalPages(0);
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      setCustomers([]);
      setCustomerTotalCustomers(0);
      setCustomerTotalPages(0);
    } finally {
      setCustomerLoading(false);
    }
  };

  const showAllCustomers = () => {
    setCustomerStatusFilter('');
    setCustomerSearch('');
    setCustomerSourceFilter('');
    setCustomerAssignedFilter('');
    setCustomerCurrentPage(0);
    setActiveTab('customers');
    loadCustomers();
  };

  const showProspects = () => {
    setCustomerStatusFilter('prospect');
    setCustomerSearch('');
    setCustomerSourceFilter('');
    setCustomerAssignedFilter('');
    setCustomerCurrentPage(0);
    setActiveTab('customers');
    loadCustomers();
  };

  const loadCustomerDetails = async (customerId: string) => {
    try {
      setLoadingCustomer(true);
      
      // Load customer data
      const customerResponse = await fetch(`/api/customers/enhanced?search=${customerId}&limit=1`);
      const customerData = await customerResponse.json();
      
      if (customerData.customers && customerData.customers.length > 0) {
        const customer = customerData.customers[0];
        setSelectedCustomer(customer);
        
        // Load notes
        const notesResponse = await fetch(`/api/customers/notes?customerId=${customerId}`);
        const notesData = await notesResponse.json();
        setCustomerNotes(notesData.notes || []);
        
        // Load timeline
        const timelineResponse = await fetch(`/api/customers/${customerId}/timeline`);
        const timelineData = await timelineResponse.json();
        setCustomerTimeline(timelineData.interactions || []);
        
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

  const closeNoteModal = () => {
    setShowNoteModal(false);
    setNoteInquiryId(null);
    setNoteText('');
    setNoteType('note');
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || !noteInquiryId) return;

    try {
      // Determine if this is a customer note or inquiry note
      const isCustomerNote = selectedCustomer && !selectedInquiry;
      const customerId = noteInquiryId; // noteInquiryId contains either customer ID or inquiry ID
      const inquiryEmail = isCustomerNote ? selectedCustomer?.email : selectedInquiry?.customerEmail;

      console.log('Adding note with data:', {
        customerId,
        inquiryEmail,
        note: noteText,
        type: noteType === 'note' ? 'general' : 'general',
        authorEmail: user?.email || 'system',
        isCustomerNote,
        noteInquiryId,
        selectedCustomer: selectedCustomer?.id,
        selectedInquiry: selectedInquiry?.id
      });

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
      const customerResponse = await fetch(`/api/customers/enhanced?search=${inquiry.customerEmail}&limit=1`);
      const customerData = await customerResponse.json();
      
      if (customerData.customers && customerData.customers.length > 0) {
        setInquiryCustomer(customerData.customers[0]);
        setInquiryCustomerId(customerData.customers[0].id);
      } else {
        setInquiryCustomer(null);
        setInquiryCustomerId(null);
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
  };

  async function refresh() {
    const params = category === "all" ? `?_t=${Date.now()}&_r=${Math.random()}` : `?category=${category}&_t=${Date.now()}&_r=${Math.random()}`;
    const [inquiriesRes, allInquiriesRes, ordersRes] = await Promise.all([
      fetch(`/api/inquiries${params}`, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }),
      fetch(`/api/inquiries?_t=${Date.now()}&_r=${Math.random()}`, { 
        cache: "no-store",
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }),
      fetch("/api/orders", { cache: "no-store" })
    ]);
    const inquiriesData = await inquiriesRes.json();
    const allInquiriesData = await allInquiriesRes.json();
    const ordersData = await ordersRes.json();
    setInquiries(inquiriesData);
    setAllInquiries(allInquiriesData);
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
      // Load filter counts first
      loadCustomerFilterCounts();
      // Default to "My Customers" (people who purchased and are assigned to me)
      setCustomerAssignedFilter(user?.email || '');
      setCustomerStatusFilter('customer');
      setCustomerSourceFilter('');
      setCustomerSearch('');
      setCustomerCurrentPage(0);
      loadCustomers();
    }
  }, [activeTab, user?.email]);

  // Reload customers when filter states change
  useEffect(() => {
    if (activeTab === 'customers') {
      loadCustomers();
    }
  }, [customerAssignedFilter, customerStatusFilter, customerSourceFilter, customerSearch, customerCurrentPage]);

  async function createInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!customerEmail.trim()) return;
    await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerEmail, category: category === "all" ? "questions" : category }),
    });
    setCustomerEmail("");
    setShowAddModal(false);
    refresh();
  }

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
        body: JSON.stringify({ id, assignedOwner: user.email }),
      });

      // Find the inquiry to get customer email
      const inquiryResponse = await fetch("/api/inquiries", { cache: "no-store" });
      const inquiries = await inquiryResponse.json();
      const inquiry = inquiries.find((i: any) => i.id === id);
      
      if (inquiry) {
        // Find the customer record for this inquiry
        const customerResponse = await fetch(`/api/customers/enhanced?search=${encodeURIComponent(inquiry.customerEmail)}&limit=1`);
        const customerData = await customerResponse.json();
        const customer = customerData.customers?.[0];
        
        if (customer) {
          // Update the customer's assignedOwner to the current user
          await fetch("/api/customers/enhanced", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: customer.id,
              assignedOwner: user?.email
            })
          });
          
          // Add a note to the customer timeline using the customer ID
          await fetch("/api/customers/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerId: customer.id,
              note: `Inquiry taken by ${user?.email}`,
              type: "general",
              authorEmail: user?.email
            })
          });
        } else {
          // Fallback to using inquiry email if customer not found
          await fetch("/api/customers/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              inquiryEmail: inquiry.customerEmail,
              note: `Inquiry taken by ${user.email}`,
              type: "general",
              authorEmail: user.email
            })
          });
        }
      }
      
      refresh();
    } catch (error) {
      console.error("Error taking ownership:", error);
    refresh();
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

      // Refresh data
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

      // Refresh data
      refresh();
    } catch (error) {
      console.error("Error marking inquiry as not relevant:", error);
    }
  }

  async function closeInquiry(id: string) {
    try {
      await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "closed" }),
      });
      refresh();
    } catch (error) {
      console.error("Error closing inquiry:", error);
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
        const customerResponse = await fetch(`/api/customers/enhanced?search=${encodeURIComponent(inquiry.customerEmail)}&limit=1`);
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
          // For now, just log that we couldn't find a customer
          console.log(`Customer not found for email: ${inquiry.customerEmail}`);
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

  // New inquiry counts (unassigned, just came in)
  const newInquiriesByCategory = useMemo(() => {
    const newInquiries = allInquiries.filter(q => q.status === "new");
    return {
      bulk: newInquiries.filter(q => q.category === "bulk").length,
      issues: newInquiries.filter(q => q.category === "issues").length,
      questions: newInquiries.filter(q => q.category === "questions").length,
      total: newInquiries.length
    };
  }, [allInquiries]);

  // Active inquiry counts by category (assigned and being worked on)
  const activeInquiriesByCategory = useMemo(() => {
    const activeInquiries = allInquiries.filter(q => q.status === "active" && q.assignedOwner === user?.email);
    return {
      bulk: activeInquiries.filter(q => q.category === "bulk").length,
      issues: activeInquiries.filter(q => q.category === "issues").length,
      questions: activeInquiries.filter(q => q.category === "questions").length,
      total: activeInquiries.length
    };
  }, [allInquiries, user]);

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
          {(["all", "bulk", "issues", "questions"] as const).map((c) => {
            // "New" tab shows new inquiries, other tabs show active inquiries
            const count = c === "all" ? newInquiriesByCategory.total : activeInquiriesByCategory[c as keyof typeof activeInquiriesByCategory];
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
                  {c === "all" ? "New" : c === "issues" ? "Issue" : c === "questions" ? "Question" : c.charAt(0).toUpperCase() + c.slice(1)}
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
                New Inquiries ({newInquiriesByCategory.total})
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
                {category === "issues" ? "Issue" : category === "questions" ? "Question" : category.charAt(0).toUpperCase() + category.slice(1)} Inquiries ({activeInquiriesByCategory[category as keyof typeof activeInquiriesByCategory]}) - My Assigned ({assignedInquiries.filter(q => q.category === category).length})
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
        {/* Simple Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left side - Total count and search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="text-2xl font-bold text-blue-600">
                {customerTotalCustomers} Customers
              </div>
              <div className="flex-1 max-w-md flex gap-2">
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
                  placeholder="Search customers..."
                  className="flex-1 p-3 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
            
            {/* Right side - Filter buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCustomerAssignedFilter(user?.email || '');
                  setCustomerStatusFilter('customer');
                  setCustomerSourceFilter('');
                  setCustomerSearch('');
                  setCustomerCurrentPage(0);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium ${
                  customerAssignedFilter === user?.email && customerStatusFilter === 'customer' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                My Customers ({customerFilterCounts.my_customers})
              </button>
              <button
                onClick={() => {
                  setCustomerAssignedFilter(user?.email || '');
                  setCustomerStatusFilter('contact');
                  setCustomerSourceFilter('');
                  setCustomerSearch('');
                  setCustomerCurrentPage(0);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium ${
                  customerAssignedFilter === user?.email && customerStatusFilter === 'contact' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                My Contacts ({customerFilterCounts.my_contacts})
              </button>
              <button
                onClick={() => {
                  setCustomerAssignedFilter('');
                  setCustomerStatusFilter('');
                  setCustomerSourceFilter('');
                  setCustomerSearch('');
                  setCustomerCurrentPage(0);
                }}
                className={`px-4 py-3 rounded-md text-sm font-medium ${
                  customerAssignedFilter === '' && customerStatusFilter === '' && customerSourceFilter === '' && customerSearch === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Customers ({customerFilterCounts.all})
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
                  {newInquiriesByCategory.total > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full h-2 w-2"></span>
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

        {/* Customer Detail Modal */}
        {showCustomerModal && selectedCustomer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedCustomer.firstName} {selectedCustomer.lastName}
                </h2>
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
                    {/* Customer Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                        <div className="space-y-2">
                          <div><span className="font-medium">Email:</span> {selectedCustomer.email}</div>
                          {selectedCustomer.phone && (
                            <div><span className="font-medium">Phone:</span> {selectedCustomer.phone}</div>
                          )}
                          {selectedCustomer.companyName && (
                            <div><span className="font-medium">Company:</span> {selectedCustomer.companyName}</div>
                          )}
                          {selectedCustomer.customerType && (
                            <div><span className="font-medium">Type:</span> {selectedCustomer.customerType}</div>
                          )}
                          {selectedCustomer.numberOfDogs && (
                            <div><span className="font-medium">Number of Dogs:</span> {selectedCustomer.numberOfDogs}</div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Assigned Owner:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">{selectedCustomer.assignedOwner || 'Unassigned'}</span>
                              <button
                                onClick={() => {
                                  const newOwner = prompt('Enter new owner email (or leave blank to unassign):', selectedCustomer.assignedOwner || '');
                                  if (newOwner !== null) {
                                    reassignCustomer(selectedCustomer.id, newOwner);
                                  }
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Change
                              </button>
                            </div>
                          </div>
                          {selectedCustomer.reason && (
                            <div><span className="font-medium">Inquiry Reason:</span> {selectedCustomer.reason}</div>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
                        <div className="space-y-2">
                          <div><span className="font-medium">Status:</span> 
                            <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              selectedCustomer.status === 'customer' ? 'bg-green-100 text-green-800' :
                              selectedCustomer.status === 'prospect' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedCustomer.status}
                            </span>
                          </div>
                          <div><span className="font-medium">Source:</span> 
                            <span className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              selectedCustomer.source === 'shopify' ? 'bg-green-100 text-green-800' :
                              selectedCustomer.source === 'quickbooks' ? 'bg-blue-100 text-blue-800' :
                              selectedCustomer.source === 'website' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {selectedCustomer.source}
                            </span>
                          </div>
                          <div><span className="font-medium">Total Orders:</span> {selectedCustomer.totalOrders}</div>
                          <div><span className="font-medium">Total Spent:</span> ${selectedCustomer.totalSpent.toFixed(2)}</div>
                          <div><span className="font-medium">Last Contact:</span> {new Date(selectedCustomer.lastContactDate).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Timeline</h3>
                      <div className="space-y-4">
                        {[...customerTimeline, ...customerNotes.map(note => ({
                          id: `note-${note.id}`,
                          type: 'note',
                          subject: 'Note',
                          content: note.note,
                          createdAt: note.createdAt,
                          authorEmail: note.authorEmail,
                          authorName: note.authorName
                        }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item, index) => (
                          <div key={item.id || index} className="border-l-4 border-blue-200 pl-4">
              <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-900">{item.subject}</h4>
                              <span className="text-sm text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-600 mt-1">{item.content}</p>
                            {item.authorEmail && (
                              <p className="text-sm text-gray-500 mt-1">by {item.authorEmail}</p>
                            )}
                            {item.authorName && !item.authorEmail && (
                              <p className="text-sm text-gray-500 mt-1">by {item.authorName}</p>
                            )}
                            {item.metadata && (
                              <div className="mt-2 text-xs text-gray-500">
                                {item.type === 'order' && item.metadata.totalAmount && (
                                  <span>Amount: ${item.metadata.totalAmount.toFixed(2)} | Status: {item.metadata.status}</span>
                                )}
                                {item.type === 'customer_inquiry' && item.metadata.reason && (
                                  <span>Reason: {item.metadata.reason} | Type: {item.metadata.customerType}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Add Note Button */}
                    <div className="pt-4 border-t border-gray-200">
                <button
                        onClick={() => {
                          closeCustomerModal();
                          openNoteModal(selectedCustomer.id, 'note');
                        }}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                      >
                        Add Note to Customer
                </button>
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
                  {inquiryCustomer?.firstName} {inquiryCustomer?.lastName}
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
                        onClick={() => addNote(selectedInquiry.id)}
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
                        <div className="text-gray-500 text-sm">
                          Customer information not found. This may be a new inquiry.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Original Message */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Original Message</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {selectedInquiry?.originalMessage || 'No message available'}
                      </p>
                    </div>
                  </div>

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

