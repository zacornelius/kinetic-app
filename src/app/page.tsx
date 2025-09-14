"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
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

type Quote = {
  id: string;
  quoteId: string;
  shopifyDraftOrderId: string;
  customerId: string;
  customerEmail: string;
  invoiceEmail?: string;
  poNumber?: string;
  status: "quoted" | "pending" | "processing";
  totalAmount: string | number; // Can be string from database or number from API
  palletItems: Array<[string, number]>;
  customMessage?: string;
  createdAt: string;
  updatedAt: string;
  customerFirstName: string;
  customerLastName: string;
  customerPhone?: string;
  customerCompany?: string;
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
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [category, setCategory] = useState<"all" | Category>("all");

  const [customerEmail, setCustomerEmail] = useState("");

  // Cache for API responses
  const [apiCache, setApiCache] = useState<Map<string, { data: any; timestamp: number }>>(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for better performance

  const getCachedData = useCallback((key: string) => {
    const cached = apiCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }, [apiCache]);

  const setCachedData = useCallback((key: string, data: any) => {
    setApiCache(prev => new Map(prev).set(key, { data, timestamp: Date.now() }));
  }, []);

  // Cache invalidation function
  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      setApiCache(prev => {
        const newCache = new Map();
        for (const [key, value] of prev) {
          if (!key.includes(pattern)) {
            newCache.set(key, value);
          }
        }
        return newCache;
      });
    } else {
      setApiCache(new Map());
    }
  }, []);



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
  
  // Quote detail modal state
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [poNumber, setPONumber] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  
  // Order detail modal state
  const [selectedPendingOrder, setSelectedPendingOrder] = useState<any>(null);
  const [showPendingOrderModal, setShowPendingOrderModal] = useState(false);
  const [selectedProcessingOrder, setSelectedProcessingOrder] = useState<any>(null);
  const [showProcessingOrderModal, setShowProcessingOrderModal] = useState(false);
  const [ordersTab, setOrdersTab] = useState<'quotes' | 'pending' | 'processing'>('quotes');
  const [inquiryCustomer, setInquiryCustomer] = useState<any>(null);
  const [inquiryCustomerId, setInquiryCustomerId] = useState<string | null>(null);
  const [inquiryCustomerTimeline, setInquiryCustomerTimeline] = useState<any[]>([]);

  // Sales dashboard state
  const [salesData, setSalesData] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardBagsData, setLeaderboardBagsData] = useState<any[]>([]);
  const [monthlyPalletsData, setMonthlyPalletsData] = useState<any[]>([]);
  const [bagsSoldData, setBagsSoldData] = useState<any>(null);
  const [yearlyBreakdownData, setYearlyBreakdownData] = useState<any[]>([]);
  const [dashboardView, setDashboardView] = useState<'personal' | 'leaderboard'>('personal');
  const [salesLoading, setSalesLoading] = useState(false);

  // Invoice creation state
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    customerEmail: '',
    shippingAddress: {
      firstName: '',
      lastName: '',
      address1: '',
      city: '',
      province: '',
      country: 'United States',
      zip: '',
      phone: ''
    },
    palletItems: {
      'Vital-24K': 0,
      'Active-26K': 0,
      'Puppy-28K': 0,
      'Power-30K': 0,
      'Ultra-32K': 0
    },
    customMessage: '',
    existingCustomerId: '',
    assignedTo: user?.email || ''
  });
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Quote creation functions
  const handleCreateQuote = async () => {
    try {
      setQuoteLoading(true);
      setQuoteMessage('');

      // Validate form
      if (!quoteForm.customerEmail || !quoteForm.shippingAddress.firstName || !quoteForm.shippingAddress.lastName) {
        setQuoteMessage('Please fill in customer email and shipping name');
        return;
      }

      const hasPalletItems = Object.values(quoteForm.palletItems).some(qty => qty > 0);
      if (!hasPalletItems) {
        setQuoteMessage('Please add at least one pallet item with quantity greater than 0');
        return;
      }

      const response = await fetch('/api/shopify/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quoteForm)
      });

      const result = await response.json();

      if (response.ok) {
        setQuoteMessage(`✅ Quote sent successfully to ${result.customerEmail}! Quote ID: ${result.quoteId}`);
        
        // Show success message briefly, then close form
        setTimeout(() => {
          // Reset form
          setQuoteForm({
            customerEmail: '',
            shippingAddress: {
              firstName: '',
              lastName: '',
              address1: '',
              city: '',
              province: '',
              country: 'United States',
              zip: '',
              phone: ''
            },
            palletItems: {
              'Vital-24K': 0,
              'Active-26K': 0,
              'Puppy-28K': 0,
              'Power-30K': 0,
              'Ultra-32K': 0
            },
            customMessage: '',
            existingCustomerId: '',
            assignedTo: user?.email || ''
          });
          setCustomerSearchQuery('');
          setShowCustomerSearch(false);
          setCustomerSearchResults([]);
          setQuoteMessage('');
          setShowQuoteForm(false);
        }, 2000);
      } else {
        setQuoteMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setQuoteMessage(`❌ Error: ${error instanceof Error ? error.message : 'Failed to create quote'}`);
    } finally {
      setQuoteLoading(false);
    }
  };

  // Customer search functions
  const searchCustomers = async (query: string) => {
    if (!query || query.length < 2) {
      setCustomerSearchResults([]);
      setShowCustomerSearch(false);
      return;
    }

    try {
      setCustomerSearchLoading(true);
      const response = await fetch(`/api/customers/consolidated?action=search&search=${encodeURIComponent(query)}&include=basic&limit=10`);
      if (response.ok) {
        const data = await response.json();
        setCustomerSearchResults(data.customers || []);
        setShowCustomerSearch(true);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  const selectCustomer = (customer: any) => {
    // Parse shipping address if available
    let parsedAddress = {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      phone: customer.phone || '',
      address1: '',
      city: '',
      province: '',
      country: 'United States',
      zip: ''
    };

    if (customer.shippingAddress) {
      // Parse the shipping address format: "Street, City, State, Country, Zip"
      const addressParts = customer.shippingAddress.split(',').map((part: string) => part.trim());
      if (addressParts.length >= 5) {
        parsedAddress = {
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          phone: customer.phone || '',
          address1: addressParts[0] || '',
          city: addressParts[1] || '',
          province: addressParts[2] || '',
          country: addressParts[3] || 'United States',
          zip: addressParts[4] || ''
        };
      }
    }

    setQuoteForm(prev => ({
      ...prev,
      customerEmail: customer.email,
      shippingAddress: parsedAddress,
      existingCustomerId: customer.id
    }));
    // Immediately hide dropdown and clear search
    setShowCustomerSearch(false);
    setCustomerSearchResults([]);
    setCustomerSearchQuery('');
  };

  const updatePalletItem = (sku: string, quantity: number) => {
    setQuoteForm(prev => ({
      ...prev,
      palletItems: { ...prev.palletItems, [sku]: Math.max(0, quantity) }
    }));
  };

  const updateShippingAddress = (field: string, value: string) => {
    setQuoteForm(prev => ({
      ...prev,
      shippingAddress: { ...prev.shippingAddress, [field]: value }
    }));
  };

  // Load sales dashboard data with caching
  const loadSalesData = async () => {
    if (!user?.email) return;
    
    const cacheKey = `sales-${user.email}`;
    const cachedSalesData = getCachedData(cacheKey);
    
    // Always load line items and customers for monthly calculations
    const lineItemsCacheKey = 'line-items';
    const customersCacheKey = 'customers';
    
    const cachedLineItems = getCachedData(lineItemsCacheKey);
    const cachedCustomers = getCachedData(customersCacheKey);
    
    let lineItems, customers;
    
    if (cachedLineItems && cachedCustomers) {
      lineItems = cachedLineItems;
      customers = cachedCustomers;
    } else {
      const [lineItemsResponse, customersResponse] = await Promise.all([
        fetch(`/api/line-items?_t=${Date.now()}`),
        fetch(`/api/customers?_t=${Date.now()}`)
      ]);
      
      if (lineItemsResponse.ok && customersResponse.ok) {
        lineItems = await lineItemsResponse.json();
        customers = await customersResponse.json();
        
        // Cache the data
        setCachedData(lineItemsCacheKey, lineItems);
        setCachedData(customersCacheKey, customers);
      } else {
        return; // Exit if API calls failed
      }
    }
    
    // If we have cached sales data, use it but still calculate monthly values
    if (cachedSalesData) {
      setSalesData(cachedSalesData.personal);
      setMonthlyPalletsData(cachedSalesData.monthlyPallets || []);
      setLeaderboardData(cachedSalesData.leaderboard || []);
      setYearlyBreakdownData(cachedSalesData.yearlyBreakdown || []);
      
      // Still calculate monthly values even with cached data
      if (dashboardView === 'personal') {
        // Get Ian's customer emails
        const ianCustomers = customers.filter((c: any) => c.assignedto === user.email);
        const customerEmailSet = new Set(ianCustomers.map((c: any) => c.email));
        
        // Filter line items for Ian's customers
        const ianLineItems = lineItems.filter((item: any) => customerEmailSet.has(item.customerEmail));
        
        // Calculate bags sold this month
        const thisMonth = new Date();
        const thisMonthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
        const thisMonthEnd = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0);
        
        let bagsSoldThisMonth = 0;
        let revenueThisMonth = 0;
        let ordersThisMonth = new Set();
        
        ianLineItems.forEach((item: any) => {
          const orderDate = new Date(item.createdAt);
          if (orderDate >= thisMonthStart && orderDate <= thisMonthEnd) {
            // Apply same logic as admin data explorer
            let effectiveQuantity = 0;
            if (item.title === 'Build a Pallet') {
              effectiveQuantity = item.quantity || 0;
            } else if (item.title?.includes('Pallet')) {
              effectiveQuantity = (item.quantity || 0) * 50;
            } else {
              effectiveQuantity = item.quantity || 0;
            }
            bagsSoldThisMonth += effectiveQuantity;
            revenueThisMonth += item.totalPrice || 0;
            ordersThisMonth.add(item.orderNumber);
          }
        });
        
        // Update sales data with calculated values
        setSalesData(prev => ({
          ...prev,
          bagsSoldThisMonth: parseInt(bagsSoldThisMonth.toString()),
          revenueThisMonth: parseInt(revenueThisMonth.toString()),
          ordersThisMonth: ordersThisMonth.size
        }));
      }
      return;
    }
    
    try {
      setSalesLoading(true);
      
      // Initialize variables for caching
      let yearlyBreakdownData = [];
      let top3 = [];
      let salesData = null;
      let monthlyPalletsData = [];
      
      // Load sales data for personal view
      const personalResponse = await fetch(`/api/sales/dashboard?userEmail=${user.email}&view=personal&_t=${Date.now()}`);
      if (personalResponse.ok) {
        const personalResult = await personalResponse.json();
        salesData = personalResult.personal;
        monthlyPalletsData = personalResult.monthlyPallets || [];
        
        setSalesData(salesData);
        setMonthlyPalletsData(monthlyPalletsData);
      }
      
      // Calculate monthly sales data for personal view
      if (dashboardView === 'personal') {
        // Get Ian's customer emails
        const ianCustomers = customers.filter((c: any) => c.assignedto === user.email);
        const customerEmailSet = new Set(ianCustomers.map((c: any) => c.email));
        
        // Filter line items for Ian's customers
        const ianLineItems = lineItems.filter((item: any) => customerEmailSet.has(item.customerEmail));
        
        // Calculate bags sold this month
        const thisMonth = new Date();
        const thisMonthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
        const thisMonthEnd = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0);
        
        let bagsSoldThisMonth = 0;
        let revenueThisMonth = 0;
        let ordersThisMonth = new Set();
        
        ianLineItems.forEach((item: any) => {
          const orderDate = new Date(item.createdAt);
          if (orderDate >= thisMonthStart && orderDate <= thisMonthEnd) {
            let effectiveQuantity = 0;
            if (item.title === 'Build a Pallet') {
              effectiveQuantity = item.quantity || 0;
            } else if (item.title?.includes('Pallet')) {
              effectiveQuantity = (item.quantity || 0) * 50;
            } else {
              effectiveQuantity = item.quantity || 0;
            }
            bagsSoldThisMonth += effectiveQuantity;
            revenueThisMonth += item.totalPrice || 0;
            ordersThisMonth.add(item.orderNumber);
          }
        });
        
        // Update sales data with calculated values
        const updatedSalesData = {
          ...salesData,
          bagsSoldThisMonth: parseInt(bagsSoldThisMonth.toString()),
          revenueThisMonth: parseInt(revenueThisMonth.toString()),
          ordersThisMonth: ordersThisMonth.size
        };
        setSalesData(updatedSalesData);
        salesData = updatedSalesData; // Update for caching
        
        // Calculate yearly breakdown (12 months)
        const yearlyBreakdown = [];
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date();
          monthDate.setMonth(monthDate.getMonth() - i);
          const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
          
          let monthRevenue = 0;
          let monthOrders = new Set();
          let monthBags = 0;
          
          ianLineItems.forEach((item: any) => {
            const orderDate = new Date(item.createdAt);
            if (orderDate >= monthStart && orderDate <= monthEnd) {
              let effectiveQuantity = 0;
              if (item.title === 'Build a Pallet') {
                effectiveQuantity = item.quantity || 0;
              } else if (item.title?.includes('Pallet')) {
                effectiveQuantity = (item.quantity || 0) * 50;
              } else {
                effectiveQuantity = item.quantity || 0;
              }
              monthBags += effectiveQuantity;
              monthRevenue += item.totalPrice || 0;
              monthOrders.add(item.orderNumber);
            }
          });
          
          yearlyBreakdown.push({
            month: monthDate.toISOString().slice(0, 7),
            revenue: monthRevenue,
            orders: monthOrders.size,
            bags: monthBags
          });
        }
        
        setYearlyBreakdownData(yearlyBreakdown);
        
        // Store yearly breakdown for caching
        yearlyBreakdownData = yearlyBreakdown;
      }
      
      // Calculate leaderboard from line items
      const thisMonth = new Date();
      const thisMonthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
      const thisMonthEnd = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0);
      
      // Get all unique owners from customers
      const owners = [...new Set(customers.map((c: any) => c.assignedto).filter(Boolean))];
      
      // Get user profiles to map emails to names
      const userProfilesResponse = await fetch(`/api/users?_t=${Date.now()}`);
      let userProfiles: any[] = [];
      if (userProfilesResponse.ok) {
        userProfiles = await userProfilesResponse.json();
      }
      
      // Calculate stats for each owner
      const ownerStats = owners.map(owner => {
        // Get customers assigned to this owner
        const ownerCustomers = customers.filter((c: any) => c.assignedto === owner);
        const customerEmailSet = new Set(ownerCustomers.map((c: any) => c.email));
        
        // Filter line items for this owner's customers this month
        const ownerLineItems = lineItems.filter((item: any) => {
          const orderDate = new Date(item.createdAt);
          return customerEmailSet.has(item.customerEmail) && 
                 orderDate >= thisMonthStart && 
                 orderDate <= thisMonthEnd;
        });
        
        // Calculate bags, revenue, orders
        let bagsSold = 0;
        let revenue = 0;
        const orderNumbers = new Set();
        
        ownerLineItems.forEach((item: any) => {
          let effectiveQuantity = 0;
          if (item.title === 'Build a Pallet') {
            effectiveQuantity = item.quantity || 0;
          } else if (item.title?.includes('Pallet')) {
            effectiveQuantity = (item.quantity || 0) * 50;
          } else {
            effectiveQuantity = item.quantity || 0;
          }
          
          bagsSold += effectiveQuantity;
          revenue += item.totalPrice || 0;
          orderNumbers.add(item.orderNumber);
        });
        
        // Find user profile for this owner
        const userProfile = userProfiles.find((u: any) => u.email.toLowerCase() === owner.toLowerCase());
        const displayName = userProfile 
          ? `${userProfile.firstname} ${userProfile.lastname}`.trim()
          : owner.split('@')[0];
        
        return {
          owner,
          displayName,
          bagsSold,
          revenue,
          orders: orderNumbers.size
        };
      });
      
      // Sort by bags sold and take top 3
      top3 = ownerStats
        .sort((a, b) => b.bagsSold - a.bagsSold)
        .slice(0, 3);
      
      setLeaderboardData(top3);
      setLeaderboardBagsData(top3);
      
      // Load top customers (with caching)
      const topCustomersCacheKey = `top-customers-${user.email}-${dashboardView}`;
      const cachedTopCustomers = getCachedData(topCustomersCacheKey);
      
      if (cachedTopCustomers) {
        setTopCustomers(cachedTopCustomers);
      } else {
        const topCustomersResponse = await fetch(`/api/sales/top-customers?userEmail=${user.email}&view=${dashboardView}&limit=50&_t=${Date.now()}`);
        if (topCustomersResponse.ok) {
          const topCustomersResult = await topCustomersResponse.json();
          const topCustomers = topCustomersResult.topCustomers || [];
          setCachedData(topCustomersCacheKey, topCustomers);
          setTopCustomers(topCustomers);
        }
      }
      
      // Cache all the calculated data
      setCachedData(cacheKey, { 
        personal: salesData, 
        monthlyPallets: monthlyPalletsData,
        leaderboard: top3,
        yearlyBreakdown: yearlyBreakdownData
      });
      
    } catch (error) {
      console.error('Error loading sales data:', error);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      setCustomerLoading(true);
      
      // Create cache key based on search parameters
      const cacheKey = `customers-${customerSearch}-${customerStatusFilter}-${customerAssignedFilter}-${customerCurrentPage}-${customerLimit}`;
      const cachedCustomers = getCachedData(cacheKey);
      
      if (cachedCustomers) {
        setCustomers(cachedCustomers.customers || []);
        setCustomerTotalCustomers(cachedCustomers.pagination?.total || 0);
        return;
      }
      
      // Use consolidated customer API
      const params = new URLSearchParams();
      params.append('action', 'list');
      params.append('include', 'basic');
      params.append('limit', customerLimit.toString());
      params.append('offset', (customerCurrentPage * customerLimit).toString());
      
      // Build filters object
      const filters: any = {};
      if (customerStatusFilter) {
        filters.status = customerStatusFilter;
      }
      if (customerAssignedFilter) {
        filters.assignedTo = customerAssignedFilter;
      }
      
      if (Object.keys(filters).length > 0) {
        params.append('filters', JSON.stringify(filters));
      }
      
      if (customerSearch) {
        params.append('search', customerSearch);
      }
      
      // Add cache busting
      params.append('_t', Date.now().toString());
      const response = await fetch(`/api/customers/consolidated?${params}`);
      const data = await response.json();
      
      if (response.ok && data.customers) {
        // Cache the customer data
        setCachedData(cacheKey, data);
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

  // Manual refresh function that clears cache
  const refreshAllData = useCallback(async () => {
    invalidateCache();
    await refresh();
    if (user?.email) {
      await loadSalesData();
      await loadQuotes();
    }
    if (activeTab === 'customers') {
      await loadCustomers();
    }
  }, [invalidateCache, refresh, user?.email, loadSalesData, loadQuotes, activeTab, loadCustomers]);



  const loadCustomerDetails = async (customerId: string) => {
    try {
      setLoadingCustomer(true);
      
      // Load customer data with full details and timeline in one call
      const response = await fetch(`/api/customers/consolidated?action=details&id=${customerId}&include=full,timeline&_t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch customer: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.customer) {
        const customer = data.customer;
        setSelectedCustomer(customer);
        
        // Set notes and timeline from the consolidated response
        setCustomerNotes(customer.notes || []);
        setCustomerTimeline(customer.timeline || []);
        
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

  // Memoized inquiry renderer for virtual scrolling
  const renderInquiry = useCallback((inquiry: Inquiry, index: number) => (
    <div 
      key={`inquiry-${inquiry.id}`} 
      onClick={() => loadInquiryDetails(inquiry)}
      className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
    >
      {/* Timeline dot */}
      <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
        inquiry.category === "issues" ? "bg-red-500" :
        inquiry.category === "questions" ? "bg-blue-500" :
        "bg-green-500"
      }`}></div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              {inquiry.customerName || inquiry.customerEmail}
            </h4>
            <p className="text-xs text-gray-500 mb-2">
              {new Date(inquiry.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              inquiry.category === "issues" ? "bg-red-100 text-red-800" :
              inquiry.category === "questions" ? "bg-blue-100 text-blue-800" :
              "bg-green-100 text-green-800"
            }`}>
              {inquiry.category}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              inquiry.status === "new" ? "bg-green-100 text-green-800" :
              inquiry.status === "active" ? "bg-blue-100 text-blue-800" :
              inquiry.status === "assigned" ? "bg-purple-100 text-purple-800" :
              "bg-gray-100 text-gray-800"
            }`}>
              {inquiry.status}
            </span>
          </div>
        </div>
        
        <p className="text-sm text-gray-700 leading-relaxed">
          {getFirstThreeLines(inquiry.originalMessage)}
        </p>
      </div>
    </div>
  ), [loadInquiryDetails]);

  const closeAllModals = () => {
    setShowInquiryModal(false);
    setShowCustomerModal(false);
    setShowNoteModal(false);
    setShowQuoteModal(false);
    setShowPendingOrderModal(false);
    setShowProcessingOrderModal(false);
    setSelectedInquiry(null);
    setSelectedCustomer(null);
    setSelectedQuote(null);
    setSelectedPendingOrder(null);
    setSelectedProcessingOrder(null);
    setInquiryCustomer(null);
    setInquiryCustomerId(null);
    setInquiryCustomerTimeline([]);
    setCustomerNotes([]);
    setCustomerTimeline([]);
  };

  const handleTabChange = (tab: TabType) => {
    closeAllModals();
    setActiveTab(tab);
    
    // Force scroll to top when switching tabs
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Also scroll the main content area to top
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Force scroll on mobile devices
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }, 100);
  };

  async function refresh() {
    if (!user?.email) return;
    
    // For home tab, use the consolidated API
    if (activeTab === "home") {
      await loadHomeDashboard();
      return;
    }
    
    // For other tabs, use the existing logic
    const params = category === "all" ? `?_t=${Date.now()}` : `?category=${category}&_t=${Date.now()}`;
    const cacheKey = `inquiries-${category}`;
    
    // Check cache first
    const cachedInquiries = getCachedData(cacheKey);
    
    if (cachedInquiries) {
      setInquiries(Array.isArray(cachedInquiries) ? cachedInquiries : []);
      return;
    }

    const response = await fetch(`/api/inquiries${params}`, { 
      cache: "no-store"
    });
    const inquiriesData = await response.json();
    
    const safeInquiriesData = Array.isArray(inquiriesData) ? inquiriesData : [];
    
    // Cache the results
    setCachedData(cacheKey, safeInquiriesData);
    setInquiries(safeInquiriesData);
    
    // Only load all inquiries if we don't have them yet or if category is "all"
    if (category === "all" || allInquiries.length === 0) {
      const allInquiriesRes = await fetch(`/api/inquiries?_t=${Date.now()}`);
      const allInquiriesData = await allInquiriesRes.json();
      setAllInquiries(allInquiriesData);
    }
  }

  async function loadHomeDashboard() {
    if (!user?.email) return;
    
    const cacheKey = `home-dashboard-${user.email}`;
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      // Set all the data from cache
      setInquiries(Array.isArray(cachedData.inquiries) ? cachedData.inquiries : []);
      setOrders(Array.isArray(cachedData.orders) ? cachedData.orders : []);
      setUsers(Array.isArray(cachedData.users) ? cachedData.users : []);
      setQuotes(Array.isArray(cachedData.quotes) ? cachedData.quotes : []);
      setAllInquiries(Array.isArray(cachedData.inquiries) ? cachedData.inquiries : []);
      
      // Set dashboard data
      if (cachedData.salesData) {
        setSalesData(cachedData.salesData.personal);
        setMonthlyPalletsData(cachedData.salesData.monthlyPallets || []);
      }
      if (cachedData.topCustomers) {
        setTopCustomers(cachedData.topCustomers);
      }
      if (cachedData.lineItems) {
        setLineItems(cachedData.lineItems);
      }
      if (cachedData.customers) {
        setCustomers(cachedData.customers);
      }
      
      return;
    }

    try {
      const response = await fetch(`/api/dashboard/home?userEmail=${encodeURIComponent(user.email)}&view=personal&_t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch home dashboard: ${response.status}`);
      }
      
      const result = await response.json();
      const data = result.data;
      
      // Set all the data
      setInquiries(Array.isArray(data.inquiries) ? data.inquiries : []);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setUsers(Array.isArray(data.users) ? data.users : []);
      setQuotes(Array.isArray(data.quotes) ? data.quotes : []);
      setAllInquiries(Array.isArray(data.inquiries) ? data.inquiries : []);
      
      // Set dashboard data
      if (data.salesData) {
        setSalesData(data.salesData.personal);
        setMonthlyPalletsData(data.salesData.monthlyPallets || []);
      }
      if (data.topCustomers) {
        setTopCustomers(data.topCustomers);
      }
      if (data.lineItems) {
        setLineItems(data.lineItems);
      }
      if (data.customers) {
        setCustomers(data.customers);
      }
      
      // Cache the entire response
      setCachedData(cacheKey, data);
      
    } catch (error) {
      console.error('Error loading home dashboard:', error);
      // Fallback to individual API calls if consolidated API fails
      await loadIndividualAPIs();
    }
  }

  async function loadIndividualAPIs() {
    // Fallback function that loads data using individual API calls
    const promises = [
      fetch(`/api/inquiries?_t=${Date.now()}`),
      fetch("/api/orders", { cache: "no-store" }),
      fetch("/api/users"),
      fetch(`/api/quotes?assignedTo=${encodeURIComponent(user?.email || '')}`)
    ];
    
    const responses = await Promise.all(promises);
    const [inquiriesData, ordersData, usersData, quotesData] = await Promise.all(
      responses.map(r => r.json())
    );
    
    setInquiries(Array.isArray(inquiriesData) ? inquiriesData : []);
    setOrders(Array.isArray(ordersData) ? ordersData : []);
    setUsers(Array.isArray(usersData) ? usersData : []);
    setQuotes(Array.isArray(quotesData) ? quotesData : []);
    setAllInquiries(Array.isArray(inquiriesData) ? inquiriesData : []);
  }

  async function loadUsers() {
    const cachedUsers = getCachedData('users');
    if (cachedUsers) {
      setUsers(cachedUsers);
      return;
    }

    const res = await fetch("/api/users");
    const data = await res.json();
    setCachedData('users', data);
    setUsers(data);
  }

  async function loadQuotes() {
    if (!user?.email) return;
    
    const cacheKey = `quotes-${user.email}`;
    const cachedQuotes = getCachedData(cacheKey);
    if (cachedQuotes) {
      setQuotes(cachedQuotes);
      return;
    }
    
    try {
      const res = await fetch(`/api/quotes?assignedTo=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      setCachedData(cacheKey, data);
      setQuotes(data);
    } catch (error) {
      console.error('Error loading quotes:', error);
    }
  }

  async function convertQuoteToOrder(quoteId: string, poNumber: string, invoiceEmail: string) {
    try {
      const response = await fetch('/api/quotes/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, poNumber, invoiceEmail })
      });

      const result = await response.json();

      if (response.ok) {
        // Update local quotes state
        setQuotes(quotes.map(q => 
          q.quoteId === quoteId 
            ? { ...q, status: 'pending' as const, poNumber, invoiceEmail }
            : q
        ));
        setShowQuoteModal(false);
        // Refresh orders to show the new order
        await refresh();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error converting quote:', error);
      alert('Failed to convert quote to order');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Load quotes when user becomes available
  useEffect(() => {
    if (user?.email) {
      loadQuotes();
    }
  }, [user?.email]);

  // Update assignedTo when user changes
  useEffect(() => {
    if (user?.email) {
      setQuoteForm(prev => ({ ...prev, assignedTo: user.email }));
    }
  }, [user?.email]);

  // Hide customer search dropdown when email is manually typed
  useEffect(() => {
    if (quoteForm.customerEmail && !customerSearchQuery) {
      setShowCustomerSearch(false);
      setCustomerSearchResults([]);
    }
  }, [quoteForm.customerEmail, customerSearchQuery]);

  // Close quote form when switching tabs
  useEffect(() => {
    if (showQuoteForm) {
      setShowQuoteForm(false);
      setCustomerSearchQuery('');
      setShowCustomerSearch(false);
      setCustomerSearchResults([]);
      setQuoteMessage('');
    }
  }, [activeTab]);

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
    
    // Force scroll to top when tab changes
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
      }
      
      // Force scroll on mobile devices
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    }, 100);
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
    Array.isArray(inquiries) ? inquiries.filter(q => q.status === "new" || (q.status === "active" && !q.assignedOwner)) : [], [inquiries]);
  
  const assignedInquiries = useMemo(() => {
    // Use allInquiries instead of inquiries to get all assigned inquiries regardless of category filter
    const sourceData = Array.isArray(allInquiries) && allInquiries.length > 0 ? allInquiries : inquiries;
    return Array.isArray(sourceData) ? sourceData.filter(q => q.assignedOwner === user?.email && q.status === "active") : [];
  }, [inquiries, allInquiries, user]);

  // Simplified inquiry filtering - use allInquiries for consistent counts
  const newInquiries = useMemo(() => 
    Array.isArray(allInquiries) ? allInquiries.filter(q => q.status === "new") : [], [allInquiries]);

  const activeInquiries = useMemo(() => 
    Array.isArray(allInquiries) ? allInquiries.filter(q => q.status === "active" && q.assignedOwner === user?.email) : [], [allInquiries, user]);

  const currentOrders = useMemo(() => 
    Array.isArray(orders) ? orders.filter(o => o.assignedOwner === user?.email && o.status !== "delivered" && o.status !== "cancelled") : [], [orders, user]);

  const pendingOrders = useMemo(() => 
    currentOrders.filter(o => o.status === "pending"), [currentOrders]);

  const processingOrders = useMemo(() => 
    currentOrders.filter(o => o.status === "processing"), [currentOrders]);

  const allCustomerOrders = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    
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
                <h3 className="text-xl font-bold text-gray-900">My Sales This Month</h3>
              </div>
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
                  <div className="text-2xl font-bold" style={{color: '#915A9D'}}>{salesData?.bagsSoldThisMonth || 0}</div>
                  <div className="text-xs text-gray-600">Bags Sold</div>
                </div>
              </div>
            </div>

            {/* Monthly Leaderboard */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">Monthly Leaderboard</h3>
              </div>
              
              <div className="space-y-3">
                {console.log('Leaderboard data in render:', leaderboardData)}
                {console.log('Dave in leaderboardData:', leaderboardData.find(m => m.owner.toLowerCase() === 'dave@kineticdogfood.com'))}
                {console.log('All owners in leaderboard:', leaderboardData.map(m => m.owner))}
                {leaderboardData.map((member, index) => {
                  return (
                    <div key={member.owner} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {(() => {
                              console.log(`Rendering member ${member.owner}:`, {
                                displayName: member.displayName,
                                owner: member.owner,
                                fullMemberObject: member
                              });
                              return member.displayName || member.owner.split('@')[0];
                            })()}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.orders || 0} orders • ${(member.revenue || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold" style={{color: '#915A9D'}}>
                          {member.bagsSold || 0}
                        </div>
                        <div className="text-xs text-gray-500">bags</div>
                      </div>
                    </div>
                  );
                })}
                
                {leaderboardData.length === 0 && (
                  <div className="text-center py-4 text-gray-500">No leaderboard data available</div>
                )}
              </div>
            </div>

            {/* My Sales Trends */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              {/* Title Section - Fixed at top */}
              <div className="sticky top-0 bg-white rounded-t-xl px-4 pt-4 pb-2 z-20">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 bg-gradient-to-b from-[#915A9D] to-[#915A9D] rounded-full"></div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {dashboardView === 'personal' ? 'My Sales Trends' : 'Sales Trends'}
                  </h3>
                </div>
              </div>
              
              {/* Chart Content Section - Responsive */}
              <div className="p-4">
                {yearlyBreakdownData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Bags Chart */}
                    <div className="relative">
                      <div className="h-32 flex items-end justify-between gap-1 px-2">
                      {yearlyBreakdownData.map((month, index) => {
                        const maxBags = Math.max(...yearlyBreakdownData.map(m => m.bags));
                        const height = maxBags > 0 ? (month.bags / maxBags) * 120 : 2;
                        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthNum = parseInt(month.month.substring(5, 7)) - 1;
                        const year = parseInt(month.month.substring(0, 4));
                        const monthName = monthNames[monthNum];
                        
                        // Check if this is current month
                        const currentDate = new Date();
                        const isCurrentMonth = monthNum === currentDate.getMonth() && year === currentDate.getFullYear();
                        
                        return (
                          <div key={index} className="flex flex-col items-center flex-1 min-w-0">
                            <div
                              className={`w-full rounded-t transition-all duration-300 ${
                                isCurrentMonth
                                  ? 'bg-gradient-to-t from-[#C43C37] to-[#E53E3E]'
                                  : 'bg-gradient-to-t from-gray-400 to-gray-300'
                              }`}
                              style={{ height: `${height}px` }}
                              title={`${monthName}: ${month.bags} bags`}
                            />
                            <div className="text-xs text-gray-600 mt-2 text-center">
                              {monthName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {month.bags}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        ${yearlyBreakdownData.reduce((sum, month) => sum + month.revenue, 0).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">Total Revenue</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {yearlyBreakdownData.reduce((sum, month) => sum + month.orders, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Orders</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{color: '#915A9D'}}>
                        {yearlyBreakdownData.reduce((sum, month) => sum + month.bags, 0)}
                      </div>
                      <div className="text-sm text-gray-600">Total Bags</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-3xl mb-2">📈</div>
                  <div className="text-sm">No yearly data available</div>
                </div>
              )}
              </div>
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
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          {(["all", "assigned"] as const).map((c) => {
            const count = c === "all" ? newInquiries.length : activeInquiries.length;
            const label = c === "all" ? "New" : "Assigned";
            
            return (
              <button
                key={c}
                onClick={() => setCategory(c as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  category === c
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>



        {/* Inquiries Timeline View */}
        <div className="space-y-4">
          {category === "all" ? (
            <>
              <div className="space-y-3">
                {Array.isArray(inquiries) ? inquiries.filter(q => q.status === "new" || (q.status === "active" && !q.assignedOwner)).map((q) => (
                  <div 
                    key={`unassigned-${q.id}`} 
                    onClick={() => loadInquiryDetails(q)}
                    className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
                  >
                    {/* Timeline dot */}
                    <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                      q.category === "issues" ? "bg-red-500" :
                      q.category === "questions" ? "bg-blue-500" :
                      "bg-green-500"
                    }`}></div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {q.customerName || q.customerEmail}
                          </h4>
                          <p className="text-xs text-gray-500 mb-2">
                            {new Date(q.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            q.category === "issues" ? "bg-red-100 text-red-800" :
                            q.category === "questions" ? "bg-blue-100 text-blue-800" :
                            "bg-green-100 text-green-800"
                          }`}>
                            {q.category === "issues" ? "Issue" : q.category === "questions" ? "Question" : q.category.charAt(0).toUpperCase() + q.category.slice(1)}
                          </span>
                          {q.customerType && (
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              q.customerType === 'Customer' ? 'bg-green-100 text-green-800' :
                              q.customerType === 'Contact' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {q.customerType}
                            </span>
                          )}
                          {q.customerCategory && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {q.customerCategory}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        <div style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                          {getFirstThreeLines(q.originalMessage)}
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-500">Click to view details and manage</p>
                    </div>
                  </div>
                )) : null}
                
                {Array.isArray(inquiries) && inquiries.filter(q => q.status === "new" || (q.status === "active" && !q.assignedOwner)).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">📬</div>
                    <div className="text-sm">No new inquiries</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-3">
                {assignedInquiries.map((q) => (
                  <div 
                    key={`assigned-${q.id}`} 
                    onClick={() => loadInquiryDetails(q)}
                    className="flex items-start gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer transition-all duration-200"
                  >
                    {/* Timeline dot */}
                    <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                      q.category === "issues" ? "bg-red-500" :
                      q.category === "questions" ? "bg-blue-500" :
                      "bg-green-500"
                    }`}></div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">
                            {q.customerName || q.customerEmail}
                          </h4>
                          <p className="text-xs text-gray-500 mb-2">
                            {new Date(q.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            q.category === "issues" ? "bg-red-100 text-red-800" :
                            q.category === "questions" ? "bg-blue-100 text-blue-800" :
                            "bg-green-100 text-green-800"
                          }`}>
                            {q.category === "issues" ? "Issue" : q.category === "questions" ? "Question" : q.category.charAt(0).toUpperCase() + q.category.slice(1)}
                          </span>
                          {q.customerType && (
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              q.customerType === 'Customer' ? 'bg-green-100 text-green-800' :
                              q.customerType === 'Contact' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {q.customerType}
                            </span>
                          )}
                          {q.customerCategory && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {q.customerCategory}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-700 mb-2">
                        <div style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                          {getFirstThreeLines(q.originalMessage)}
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-500">Click to view details and manage</p>
                    </div>
                  </div>
                ))}
                
                {assignedInquiries.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-3xl mb-2">📋</div>
                    <div className="text-sm">No inquiries assigned to you</div>
                  </div>
                )}
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
        {/* Compact Header */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          <p className="text-xs text-gray-600 mt-1">Common tasks and workflows</p>
        </div>

        {/* Compact Action Buttons */}
        <div className="space-y-3">
          {/* Create Quote */}
          <button 
            onClick={() => setShowQuoteForm(true)}
            className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-[#3B83BE] transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors flex-shrink-0" style={{ backgroundColor: '#3B83BE20' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#3B83BE' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium text-gray-900">Build a Pallet</h3>
                <p className="text-xs text-gray-600 mt-0.5">Create pallet quote</p>
              </div>
              <div style={{ color: '#3B83BE' }} className="group-hover:opacity-80">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Log Issue */}
          <button 
            onClick={() => {
              // TODO: Implement log issue functionality
              alert('Log Issue functionality coming soon!');
            }}
            className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-[#C43C37] transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors flex-shrink-0" style={{ backgroundColor: '#C43C3720' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#C43C37' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium text-gray-900">Log Issue</h3>
                <p className="text-xs text-gray-600 mt-0.5">Report customer issues</p>
              </div>
              <div style={{ color: '#C43C37' }} className="group-hover:opacity-80">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>

          {/* Send Trial */}
          <button 
            onClick={() => {
              // TODO: Implement send trial functionality
              alert('Send Trial functionality coming soon!');
            }}
            className="w-full bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-[#5BAB56] transition-all duration-200 group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors flex-shrink-0" style={{ backgroundColor: '#5BAB5620' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#5BAB56' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium text-gray-900">Send Trial</h3>
                <p className="text-xs text-gray-600 mt-0.5">Initiate product trials</p>
              </div>
              <div style={{ color: '#5BAB56' }} className="group-hover:opacity-80">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Compact Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-4">
            <div className="text-center py-6 text-gray-500">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-xs">No recent activity</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderOrdersTab() {
    const quotedQuotes = quotes.filter(q => q.status === 'quoted');
    const pendingQuotes = quotes.filter(q => q.status === 'pending');
    
    const renderTabButton = (tab: 'quotes' | 'pending' | 'processing', label: string, count: number) => (
      <button
        onClick={() => setOrdersTab(tab)}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
          ordersTab === tab
            ? 'bg-blue-100 text-blue-700 border border-blue-200'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
        }`}
      >
        {label} ({count})
      </button>
    );

    const renderQuoteCard = (quote: Quote) => (
      <div 
        key={quote.id} 
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => {
          setSelectedQuote(quote);
          setPONumber(quote.poNumber || '');
          setInvoiceEmail(quote.invoiceEmail || '');
          setShowQuoteModal(true);
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 mb-1">
              {quote.quoteId}
            </div>
            <div className="text-xs text-gray-500 mb-1">
              {quote.customerFirstName} {quote.customerLastName}
            </div>
            <div className="text-xs text-gray-400">{quote.customerEmail}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 mb-1">
              ${parseFloat(quote.totalAmount).toFixed(2)}
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              quote.status === "quoted" ? "bg-blue-100 text-blue-600" :
              quote.status === "pending" ? "bg-yellow-100 text-yellow-600" :
              "bg-green-100 text-green-600"
            }`}>
              {quote.status}
            </span>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {new Date(quote.createdAt).toLocaleString()}
        </div>
      </div>
    );

    const renderOrderCard = (order: any) => (
      <div 
        key={order.id} 
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200"
        onClick={() => {
          if (order.status === 'pending') {
            setSelectedPendingOrder(order);
            setShowPendingOrderModal(true);
          } else if (order.status === 'processing') {
            setSelectedProcessingOrder(order);
            setShowProcessingOrderModal(true);
          }
        }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900 mb-1">
              {order.orderNumber}
            </div>
            <div className="text-xs text-gray-500 mb-1">
              {order.customerName || order.customerEmail}
            </div>
            {order.companyName && (
              <div className="text-xs text-gray-400">{order.companyName}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900 mb-1">
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
        <div className="text-xs text-gray-400 mb-1">
          {new Date(order.createdAt).toLocaleString()}
        </div>
        <div className="text-xs text-gray-500">Click to view details</div>
      </div>
    );
    
    return (
      <div className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
          {renderTabButton('quotes', 'Quotes', quotedQuotes.length)}
          {renderTabButton('pending', 'Pending Orders', pendingOrders.length)}
          {renderTabButton('processing', 'Processing Orders', processingOrders.length)}
        </div>

        {/* Tab Content */}
        <div className="space-y-3">
          {ordersTab === 'quotes' && (
            <>
              {quotedQuotes.length > 0 ? (
                quotedQuotes.map(renderQuoteCard)
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <div className="text-gray-500 text-sm">No quotes found</div>
                  <div className="text-gray-400 text-xs mt-1">Create quotes from the Actions tab</div>
                </div>
              )}
            </>
          )}

          {ordersTab === 'pending' && (
            <>
              {pendingOrders.length > 0 ? (
                pendingOrders.map(renderOrderCard)
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <div className="text-gray-500 text-sm">No pending orders</div>
                  <div className="text-gray-400 text-xs mt-1">Orders waiting for payment will appear here</div>
                </div>
              )}
            </>
          )}

          {ordersTab === 'processing' && (
            <>
              {processingOrders.length > 0 ? (
                processingOrders.map(renderOrderCard)
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <div className="text-gray-500 text-sm">No processing orders</div>
                  <div className="text-gray-400 text-xs mt-1">Paid orders ready to ship will appear here</div>
                </div>
              )}
            </>
          )}
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
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 truncate mb-1">
                      {customer.firstName} {customer.lastName}
                    </h3>
                    <p className="text-sm text-gray-500 truncate">{customer.email}</p>
                    {customer.companyName && (
                      <p className="text-xs text-gray-400 truncate">{customer.companyName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      customer.customerType === 'Customer' ? 'bg-green-100 text-green-800' :
                      customer.customerType === 'Contact' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {customer.customerType || 'Unknown'}
                    </span>
                    {customer.customerCategory && (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {customer.customerCategory}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Orders:</span>
                    <span className="font-medium">{customer.totalOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Revenue:</span>
                    <span className="font-medium">${customer.totalSpent.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="mt-2 pt-2 border-t border-gray-100">
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
              <div className="flex items-center gap-2">
                <ProfileDropdown />
              </div>
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
          className="fixed left-0 right-0 bg-white z-10 overflow-y-auto main-content"
          style={{
            top: '3rem', // Below header
            bottom: '5rem', // Above bottom nav
            height: 'calc(100vh - 3rem - 5rem)' // Full height minus header and nav
          }}
        >
          {/* Content */}
          <div className="px-4 pt-4 pb-4">
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
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h2>
                    
                    {/* Customer Type Bubble */}
                    {selectedCustomer.customerType && (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        selectedCustomer.customerType === 'Customer' ? 'bg-green-100 text-green-800' :
                        selectedCustomer.customerType === 'Contact' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedCustomer.customerType}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={closeCustomerModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
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
                          <span className="text-gray-600">Category:</span>
                          <span className="font-medium">{selectedCustomer.customercategory || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Assigned To:</span>
                          <span className="font-medium">{selectedCustomer.assignedOwner || selectedCustomer.assignedTo || 'Unassigned'}</span>
                        </div>
                      </div>
                      
                      {/* Add Note Button */}
                      <div className="pt-4">
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
                                  {item.type === 'quote' && item.metadata.totalAmount && (
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

        {/* Top Customers Modal */}
        {topCustomersModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {topCustomersModal.firstname} {topCustomersModal.lastname}
                    </h2>
                    
                    {/* Customer Type Bubble */}
                    {topCustomersModal.customerType && (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        topCustomersModal.customerType === 'Customer' ? 'bg-green-100 text-green-800' :
                        topCustomersModal.customerType === 'Contact' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {topCustomersModal.customerType}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setTopCustomersModal(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
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
                        <div className="text-sm text-gray-600">Total Spent</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{topCustomersModal.order_count || 0}</div>
                        <div className="text-sm text-gray-600">Total Orders</div>
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
                          <span className="text-gray-600">Category:</span>
                          <span className="font-medium">{topCustomersModal.customercategory || 'Not provided'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Assigned To:</span>
                          <span className="font-medium">
                            {dashboardView === 'leaderboard' 
                              ? (topCustomersModal.owner === 'iand@kineticdogfood.com' ? 'Ian' : 
                                 topCustomersModal.owner === 'ericb@kineticdogfood.com' ? 'Eric' : 
                                 topCustomersModal.owner === 'Dave@kineticdogfood.com' ? 'Dave' : topCustomersModal.owner)
                              : (topCustomersModal.assignedto || 'Unassigned')
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* Add Note Button */}
                      <div className="pt-4">
                        <button
                          onClick={() => {
                            setTopCustomersModal(null);
                            openNoteModal(topCustomersModal.id, 'note');
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                        >
                          Add Note
                        </button>
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
                                  {item.type === 'quote' && item.metadata.totalAmount && (
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
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {inquiryCustomer?.firstName && inquiryCustomer?.lastName 
                      ? `${inquiryCustomer.firstName} ${inquiryCustomer.lastName}`
                      : selectedInquiry?.customerName || selectedInquiry?.customerEmail}
                  </h2>
                  
                  {/* Status and Category Bubbles */}
                  <div className="flex items-center gap-2">
                    {selectedInquiry.status === "new" && (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {selectedInquiry.status}
                      </span>
                    )}
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      selectedInquiry.category === "issues" ? "bg-red-100 text-red-800" :
                      selectedInquiry.category === "questions" ? "bg-blue-100 text-blue-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {selectedInquiry.category === "issues" ? "Issue" : selectedInquiry.category === "questions" ? "Question" : selectedInquiry.category.charAt(0).toUpperCase() + selectedInquiry.category.slice(1)}
                    </span>
                    {inquiryCustomer?.customertype && (
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        inquiryCustomer.customertype === 'Customer' ? 'bg-green-100 text-green-800' :
                        inquiryCustomer.customertype === 'Contact' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {inquiryCustomer.customertype}
                      </span>
                    )}
                    {selectedInquiry?.customerCategory && (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        {selectedInquiry.customerCategory}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={closeInquiryModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div className="space-y-6">
                  {/* Customer Contact Information */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Contact</h3>
                    {inquiryCustomer ? (
                      <div className="space-y-2">
                        <div><span className="text-gray-600">Email:</span> <span className="font-medium">{inquiryCustomer.email}</span></div>
                        {inquiryCustomer.phone && (
                          <div><span className="text-gray-600">Phone:</span> <span className="font-medium">{inquiryCustomer.phone}</span></div>
                        )}
                        {selectedInquiry?.customerCategory && (
                          <div><span className="text-gray-600">Category:</span> <span className="font-medium">{selectedInquiry.customerCategory}</span></div>
                        )}
                        {inquiryCustomer.companyName && (
                          <div><span className="text-gray-600">Company:</span> <span className="font-medium">{inquiryCustomer.companyName}</span></div>
                        )}
                        {inquiryCustomer.numberOfDogs && (
                          <div><span className="text-gray-600">Number of Dogs:</span> <span className="font-medium">{inquiryCustomer.numberOfDogs}</span></div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div><span className="text-gray-600">Email:</span> <span className="font-medium">{selectedInquiry?.customerEmail}</span></div>
                        <div className="text-gray-500 text-sm mt-2">
                          This is a new inquiry. Customer details will be captured when the inquiry is submitted.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                    {(selectedInquiry.status === "new" || (selectedInquiry.status === "active" && !selectedInquiry.assignedOwner)) ? (
                      // New inquiry or unassigned active inquiry - show Take and Not Relevant
                      <>
                        <button
                          onClick={() => takeInquiry(selectedInquiry.id)}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Take Inquiry
                        </button>
                        <button
                          onClick={() => markNotRelevant(selectedInquiry.id)}
                          className="px-4 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
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
                          className="px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                        >
                          Add Note
                        </button>
                        <button
                          onClick={() => closeInquiry(selectedInquiry.id)}
                          className="px-4 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
                        >
                          Close Inquiry
                        </button>
                      </>
                    ) : null}
                  </div>

                  {/* Customer Timeline or Inquiry Message */}
                  {inquiryCustomer ? (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Activity Timeline</h3>
                      <div className="space-y-3">
                        {inquiryCustomerTimeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item, index) => {
                          const isCurrentInquiry = item.id === selectedInquiry?.id;
                          return (
                            <div key={item.id || index} className={`flex items-start gap-3 p-3 rounded-lg ${isCurrentInquiry ? 'bg-blue-50' : 'bg-gray-50'}`}>
                              {/* Timeline dot */}
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                isCurrentInquiry ? 'bg-blue-500' : 'bg-blue-500'
                              }`}></div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between mb-1">
                                  <h4 className="font-medium text-gray-900">{item.subject || item.type}</h4>
                                  <span className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}</span>
                                </div>
                                <p className="text-sm text-gray-700 mb-1">{item.content || item.description || item.note || 'No description available'}</p>
                                {(item.authorEmail || item.authorName) && (
                                  <p className="text-xs text-gray-500">
                                    by {item.authorEmail || item.authorName}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        
                        {inquiryCustomerTimeline.length === 0 && (
                          <div className="text-center py-4 text-gray-500">
                            <div className="text-3xl mb-2">📝</div>
                            <div className="text-sm">No activity recorded yet</div>
                          </div>
                        )}
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

        {/* Quote Detail Modal */}
        {showQuoteModal && selectedQuote && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Quote {selectedQuote.quoteId}
                    </h2>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      selectedQuote.status === "quoted" ? "bg-blue-100 text-blue-800" :
                      selectedQuote.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {selectedQuote.status}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowQuoteModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Customer Info */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div><span className="text-gray-600">Name:</span> <span className="font-medium">{selectedQuote.customerFirstName} {selectedQuote.customerLastName}</span></div>
                    <div><span className="text-gray-600">Email:</span> <span className="font-medium">{selectedQuote.customerEmail}</span></div>
                    {selectedQuote.customerPhone && (
                      <div><span className="text-gray-600">Phone:</span> <span className="font-medium">{selectedQuote.customerPhone}</span></div>
                    )}
                    {selectedQuote.customerCompany && (
                      <div><span className="text-gray-600">Company:</span> <span className="font-medium">{selectedQuote.customerCompany}</span></div>
                    )}
                  </div>
                </div>

                {/* Quote Details */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Quote Details</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div><span className="text-gray-600">Total Amount:</span> <span className="font-medium">${parseFloat(selectedQuote.totalAmount).toFixed(2)}</span></div>
                      <div><span className="text-gray-600">Created:</span> <span className="font-medium">{new Date(selectedQuote.createdAt).toLocaleString()}</span></div>
                    </div>
                    
                    {/* Pallet Items */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Pallet Items</h4>
                      <div className="space-y-1">
                        {selectedQuote.palletItems.map(([sku, qty]) => (
                          <div key={sku} className="flex justify-between text-sm">
                            <span>{sku}</span>
                            <span className="font-medium">{qty}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedQuote.customMessage && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Custom Message</h4>
                        <p className="text-sm text-gray-600 bg-white p-3 rounded border">{selectedQuote.customMessage}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* PO Capture Form (only show if status is 'quoted') */}
                {selectedQuote.status === 'quoted' && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Convert to Order</h3>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          PO Number *
                        </label>
                        <input
                          type="text"
                          value={poNumber}
                          onChange={(e) => setPONumber(e.target.value)}
                          placeholder="Enter purchase order number"
                          className="w-full p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Invoice Email *
                        </label>
                        <input
                          type="email"
                          value={invoiceEmail}
                          onChange={(e) => setInvoiceEmail(e.target.value)}
                          placeholder="Enter procurement email address"
                          className="w-full p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => convertQuoteToOrder(selectedQuote.quoteId, poNumber, invoiceEmail)}
                          disabled={!poNumber.trim() || !invoiceEmail.trim()}
                          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Submit Order
                        </button>
                        <button
                          onClick={() => setShowQuoteModal(false)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Show PO info if already captured */}
                {(selectedQuote.poNumber || selectedQuote.invoiceEmail) && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Order Information</h3>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                      {selectedQuote.poNumber && (
                        <div><span className="text-gray-600">PO Number:</span> <span className="font-medium">{selectedQuote.poNumber}</span></div>
                      )}
                      {selectedQuote.invoiceEmail && (
                        <div><span className="text-gray-600">Invoice Email:</span> <span className="font-medium">{selectedQuote.invoiceEmail}</span></div>
                      )}
                    </div>
                  </div>
                )}
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

      {/* Quote Creation Modal */}
      {showQuoteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh]">
            <div className="p-6 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Build a Pallet Quote</h2>
                  <p className="text-sm text-gray-600 mt-1">Create and send a pallet quote through Shopify</p>
                </div>
                <button
                  onClick={() => {
                    setShowQuoteForm(false);
                    setCustomerSearchQuery('');
                    setShowCustomerSearch(false);
                    setCustomerSearchResults([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {quoteMessage && (
                <div className={`p-4 rounded-lg text-sm mb-4 border ${
                  quoteMessage.includes('✅') 
                    ? 'bg-green-50 text-green-800 border-green-200' 
                    : 'bg-red-50 text-red-800 border-red-200'
                }`}>
                  <div className="flex items-center">
                    {quoteMessage.includes('✅') && (
                      <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="font-medium">{quoteMessage}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-8 overflow-y-auto max-h-[calc(90vh-120px)]">
                <form onSubmit={(e) => { e.preventDefault(); handleCreateQuote(); }} className="space-y-6">
                {/* Search Existing Customer */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Search Existing Customer</h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search by email, phone, or name</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search by email, phone, or name..."
                        value={customerSearchQuery}
                        onChange={(e) => {
                          const query = e.target.value;
                          setCustomerSearchQuery(query);
                          if (query.length >= 2) {
                            searchCustomers(query);
                          } else {
                            setShowCustomerSearch(false);
                            setCustomerSearchResults([]);
                          }
                        }}
                        onBlur={() => {
                          // Hide dropdown when losing focus
                          setTimeout(() => setShowCustomerSearch(false), 150);
                        }}
                        onFocus={() => {
                          if (customerSearchQuery.length >= 2 && customerSearchResults.length > 0) {
                            setShowCustomerSearch(true);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                      />
                      {customerSearchLoading && (
                        <div className="absolute right-3 top-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#3B83BE]"></div>
                        </div>
                      )}
                    </div>
                    
                    {/* Customer Search Results */}
                    {showCustomerSearch && customerSearchResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {customerSearchResults.map((customer) => (
                          <div
                            key={customer.id}
                            onClick={() => selectCustomer(customer)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">
                              {customer.firstName} {customer.lastName}
                            </div>
                            <div className="text-sm text-gray-600">{customer.email}</div>
                            {customer.phone && (
                              <div className="text-sm text-gray-500">{customer.phone}</div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              {customer.customerType} • {customer.totalOrders > 0 ? `${customer.totalOrders} orders` : 'No orders'} • {customer.source || 'Unknown source'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* No results message */}
                    {showCustomerSearch && customerSearchResults.length === 0 && !customerSearchLoading && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3 text-sm text-gray-500">
                        No customers found
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Information */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Customer Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.shippingAddress.firstName}
                        onChange={(e) => updateShippingAddress('firstName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.shippingAddress.lastName}
                        onChange={(e) => updateShippingAddress('lastName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={quoteForm.customerEmail}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="customer@example.com"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={quoteForm.shippingAddress.phone}
                        onChange={(e) => updateShippingAddress('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="+1234567890"
                      />
                    </div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Shipping Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.shippingAddress.address1}
                        onChange={(e) => updateShippingAddress('address1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="123 Main St"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.shippingAddress.city}
                        onChange={(e) => updateShippingAddress('city', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="New York"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.shippingAddress.province}
                        onChange={(e) => updateShippingAddress('province', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="NY"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code *</label>
                      <input
                        type="text"
                        required
                        value={quoteForm.shippingAddress.zip}
                        onChange={(e) => updateShippingAddress('zip', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="10001"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={quoteForm.shippingAddress.phone}
                        onChange={(e) => updateShippingAddress('phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                        placeholder="+1234567890"
                      />
                    </div>
                  </div>
                </div>

                {/* Pallet Items */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Build a Pallet - Product Quantities</h3>
                  <div className="space-y-3">
                    {Object.entries(quoteForm.palletItems).map(([sku, quantity]) => (
                      <div key={sku} className="flex items-center gap-4 p-3 border border-gray-200 rounded-md">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-gray-700 mb-1">{sku}</label>
                          <div className="text-xs text-gray-500">
                            {sku === 'Vital-24K' && 'Vital 24K - Adult Maintenance'}
                            {sku === 'Active-26K' && 'Active 26K - High Energy Dogs'}
                            {sku === 'Puppy-28K' && 'Puppy 28K - Puppy Growth'}
                            {sku === 'Power-30K' && 'Power 30K - Working Dogs'}
                            {sku === 'Ultra-32K' && 'Ultra 32K - Performance Dogs'}
                          </div>
                        </div>
                        <div className="w-24">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                          <input
                            type="number"
                            min="0"
                            value={quantity}
                            onChange={(e) => updatePalletItem(sku, parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent text-center"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-md">
                    <div className="text-sm text-blue-800">
                      <strong>Total Items:</strong> {Object.values(quoteForm.palletItems).reduce((sum, qty) => sum + qty, 0)} bags
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Each pallet typically contains 50 bags. Quantities entered are individual bags.
                    </div>
                  </div>
                </div>

                {/* Custom Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Message</label>
                  <textarea
                    value={quoteForm.customMessage}
                    onChange={(e) => setQuoteForm(prev => ({ ...prev, customMessage: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3B83BE] focus:border-transparent"
                    placeholder="Thank you for your business! Please review and complete your payment."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-2 pb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuoteForm(false);
                      setCustomerSearchQuery('');
                      setShowCustomerSearch(false);
                      setCustomerSearchResults([]);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={quoteLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {quoteLoading ? 'Creating Pallet Quote...' : 'Create & Send Pallet Quote'}
                  </button>
                </div>
                </form>
            </div>
            </div>
        </div>
      )}

      {/* Pending Order Detail Modal */}
      {showPendingOrderModal && selectedPendingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Order Details - {selectedPendingOrder.orderNumber}
                  </h2>
                  <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Pending
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowPendingOrderModal(false);
                    setSelectedPendingOrder(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* Customer Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div><span className="text-gray-600">Customer:</span> <span className="font-medium">{selectedPendingOrder.customerName || selectedPendingOrder.customerEmail}</span></div>
                    <div><span className="text-gray-600">Email:</span> <span className="font-medium">{selectedPendingOrder.customerEmail}</span></div>
                    <div><span className="text-gray-600">Total Amount:</span> <span className="font-medium">${selectedPendingOrder.totalAmount?.toFixed(2) || "N/A"}</span></div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Shipping Address</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {selectedPendingOrder.shippingAddress ? (
                      <div className="whitespace-pre-line">{selectedPendingOrder.shippingAddress}</div>
                    ) : (
                      <div className="text-gray-500 italic">No shipping address provided</div>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Order Items</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {selectedPendingOrder.lineItems && Array.isArray(selectedPendingOrder.lineItems) && selectedPendingOrder.lineItems.length > 0 ? (
                      <div className="space-y-3">
                        {selectedPendingOrder.lineItems.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                            <div>
                              <div className="font-medium">{item.name || item.title}</div>
                              <div className="text-sm text-gray-600">SKU: {item.sku}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">Qty: {item.quantity}</div>
                              <div className="text-sm text-gray-600">${item.price ? (parseFloat(item.price) * item.quantity).toFixed(2) : "N/A" || "N/A"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-4">
                        {selectedPendingOrder.lineItems ? 'No items available' : 'Line items not loaded'}
                      </div>
                    )}
                  </div>
                </div>

                {/* PO and Invoice Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Order Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div><span className="text-gray-600">PO Number:</span> <span className="font-medium">{selectedPendingOrder.poNumber || 'Not provided'}</span></div>
                    <div><span className="text-gray-600">Invoice Email:</span> <span className="font-medium">{selectedPendingOrder.invoiceEmail || 'Not provided'}</span></div>
                    <div><span className="text-gray-600">Order Number:</span> <span className="font-medium">{selectedPendingOrder.orderNumber}</span></div>
                    <div><span className="text-gray-600">Created:</span> <span className="font-medium">{new Date(selectedPendingOrder.createdAt).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing Order Detail Modal */}
      {showProcessingOrderModal && selectedProcessingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Order Details - {selectedProcessingOrder.orderNumber}
                  </h2>
                  <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Processing
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowProcessingOrderModal(false);
                    setSelectedProcessingOrder(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="space-y-6">
                {/* Customer Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Customer Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div><span className="text-gray-600">Customer:</span> <span className="font-medium">{selectedProcessingOrder.customerName || selectedProcessingOrder.customerEmail}</span></div>
                    <div><span className="text-gray-600">Email:</span> <span className="font-medium">{selectedProcessingOrder.customerEmail}</span></div>
                    <div><span className="text-gray-600">Total Amount:</span> <span className="font-medium">${selectedProcessingOrder.totalAmount?.toFixed(2) || "N/A"}</span></div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Shipping Address</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {selectedProcessingOrder.shippingAddress ? (
                      <div className="whitespace-pre-line">{selectedProcessingOrder.shippingAddress}</div>
                    ) : (
                      <div className="text-gray-500 italic">No shipping address provided</div>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Order Items</h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    {selectedProcessingOrder.lineItems && Array.isArray(selectedProcessingOrder.lineItems) && selectedProcessingOrder.lineItems.length > 0 ? (
                      <div className="space-y-3">
                        {selectedProcessingOrder.lineItems.map((item: any, index: number) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                            <div>
                              <div className="font-medium">{item.name || item.title}</div>
                              <div className="text-sm text-gray-600">SKU: {item.sku}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">Qty: {item.quantity}</div>
                              <div className="text-sm text-gray-600">${item.price ? (parseFloat(item.price) * item.quantity).toFixed(2) : "N/A" || "N/A"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-center py-4">
                        {selectedProcessingOrder.lineItems ? 'No items available' : 'Line items not loaded'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tracking Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Shipping Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div>
                      <span className="text-gray-600">Tracking Number:</span> 
                      <span className={`font-medium ml-2 ${selectedProcessingOrder.trackingNumber ? 'text-green-600' : 'text-gray-500'}`}>
                        {selectedProcessingOrder.trackingNumber || 'Tracking Not Yet Updated'}
                      </span>
                    </div>
                    <div><span className="text-gray-600">Status:</span> <span className="font-medium">Processing</span></div>
                    <div><span className="text-gray-600">Created:</span> <span className="font-medium">{new Date(selectedProcessingOrder.createdAt).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    </ProtectedRoute>
  );
}


