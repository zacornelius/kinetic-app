"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import ProfileDropdown from '@/components/ProfileDropdown';

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  billingAddress: string;
  shippingAddress: string;
  source: string;
  status: string;
  totalInquiries: number;
  totalOrders: number;
  totalSpent: number;
  lastContactDate: string;
  tags: string[];
  assignedTo: string;
  priority: string;
}

interface Note {
  id: string;
  authorEmail: string;
  note: string;
  type: string;
  createdAt: string;
  isPrivate: boolean;
  authorName: string;
}

export default function CustomerProfilePage() {
  const { user } = useAuth();
  const params = useParams();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('general');
  const [isPrivate, setIsPrivate] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      
      // Load customer profile
      const customerResponse = await fetch(`/api/customers/enhanced?search=${customerId}&limit=1`);
      const customerData = await customerResponse.json();
      
      if (customerData.customers.length > 0) {
        setCustomer(customerData.customers[0]);
        
        // Load customer notes
        const notesResponse = await fetch(`/api/customers/notes?customerId=${customerId}`);
        const notesData = await notesResponse.json();
        setNotes(notesData.notes);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim() || !customer) return;

    try {
      setAddingNote(true);
      
      const response = await fetch('/api/customers/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          authorEmail: user?.email,
          note: newNote.trim(),
          type: noteType,
          isPrivate
        })
      });

      if (response.ok) {
        setNewNote('');
        loadCustomerData(); // Reload to get updated notes
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer': return 'bg-green-100 text-green-800';
      case 'prospect': return 'bg-yellow-100 text-yellow-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!customer) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white shadow-sm border-b">
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl kinetic-title text-gray-900">Customer Not Found</h1>
                <ProfileDropdown />
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="bg-white rounded-lg shadow-sm p-6 text-center">
              <p className="text-gray-500">Customer not found or access denied.</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl kinetic-title text-gray-900">
                  {customer.firstName} {customer.lastName}
                </h1>
                <p className="text-gray-600">{customer.email}</p>
              </div>
              <ProfileDropdown />
            </div>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Customer Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                {customer.status}
              </span>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Priority</h3>
              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(customer.priority)}`}>
                {customer.priority}
              </span>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Source</h3>
              <span className="text-sm font-medium text-gray-900 capitalize">{customer.source}</span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Orders</h3>
              <div className="text-2xl font-bold text-blue-600">{customer.totalOrders}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Spent</h3>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(customer.totalSpent)}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Inquiries</h3>
              <div className="text-2xl font-bold text-purple-600">{customer.totalInquiries}</div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900">{customer.email}</p>
                </div>
                {customer.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-sm text-gray-900">{customer.phone}</p>
                  </div>
                )}
                {customer.companyName && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Company</label>
                    <p className="text-sm text-gray-900">{customer.companyName}</p>
                  </div>
                )}
                {customer.billingAddress && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Billing Address</label>
                    <p className="text-sm text-gray-900 whitespace-pre-line">{customer.billingAddress}</p>
                  </div>
                )}
                {customer.shippingAddress && customer.shippingAddress !== customer.billingAddress && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Shipping Address</label>
                    <p className="text-sm text-gray-900 whitespace-pre-line">{customer.shippingAddress}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes & Interactions</h2>
              
              {/* Add Note Form */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="space-y-3">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note about this customer..."
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                    rows={3}
                  />
                  <div className="flex items-center space-x-4">
                    <select
                      value={noteType}
                      onChange={(e) => setNoteType(e.target.value)}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1"
                    >
                      <option value="general">General</option>
                      <option value="call">Call</option>
                      <option value="email">Email</option>
                      <option value="meeting">Meeting</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="issue">Issue</option>
                    </select>
                    <label className="flex items-center text-sm">
                      <input
                        type="checkbox"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="mr-2"
                      />
                      Private
                    </label>
                    <button
                      onClick={addNote}
                      disabled={!newNote.trim() || addingNote}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {addingNote ? 'Adding...' : 'Add Note'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notes.map((note) => (
                  <div key={note.id} className="border-l-4 border-blue-200 pl-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-500">
                        {note.authorName} • {note.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(note.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900">{note.note}</p>
                    {note.isPrivate && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 mt-1">
                        Private
                      </span>
                    )}
                  </div>
                ))}
                {notes.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No notes yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
