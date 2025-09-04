"use client";

import { useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncProgress, setSyncProgress] = useState("");
  
  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState("");

  async function loadUsers() {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(data);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !firstName || !lastName) return;
    
    try {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName }),
      });
      setEmail("");
      setFirstName("");
      setLastName("");
      loadUsers();
    } catch (error) {
      alert("Error adding user");
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    try {
      await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      loadUsers();
    } catch (error) {
      alert("Error deleting user");
    }
  }

  async function syncShopifyOrders() {
    setIsSyncing(true);
    setSyncMessage("");
    setSyncProgress("Starting sync...");
    
    try {
      const response = await fetch("/api/shopify/sync-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: "f184d9-2",
          accessToken: "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",
          limit: 250 // Shopify's maximum limit
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSyncMessage(`✅ ${result.message} (${result.stats.inserted} new, ${result.stats.updated} updated)`);
        setSyncProgress("");
      } else {
        setSyncMessage(`❌ Error: ${result.error}`);
        setSyncProgress("");
      }
    } catch (error) {
      setSyncMessage(`❌ Error: ${error instanceof Error ? error.message : "Failed to sync"}`);
      setSyncProgress("");
    } finally {
      setIsSyncing(false);
    }
  }

  async function syncNewOrders() {
    setIsSyncing(true);
    setSyncMessage("");
    setSyncProgress("Starting incremental sync...");
    
    try {
      const response = await fetch("/api/shopify/sync-incremental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: "f184d9-2",
          accessToken: "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"
        }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setSyncMessage(`✅ ${result.message}`);
        setSyncProgress("");
      } else {
        setSyncMessage(`❌ Error: ${result.error}`);
        setSyncProgress("");
      }
    } catch (error) {
      setSyncMessage(`❌ Error: ${error instanceof Error ? error.message : "Failed to sync new orders"}`);
      setSyncProgress("");
    } finally {
      setIsSyncing(false);
    }
  }

  // Set webhook URL on component mount
  useEffect(() => {
    const baseUrl = window.location.origin;
    setWebhookUrl(`${baseUrl}/api/webhooks/quickbooks`);
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Admin Cockpit ⚡</h1>
      
      {/* User Management Section */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">User Management</h2>
        <form onSubmit={addUser} className="grid gap-4 grid-cols-1 sm:grid-cols-4 mb-4">
          <input
            className="border rounded px-3 py-2"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">
            Add User
          </button>
        </form>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Sales Team ({users.length} users)</h3>
        </div>
        
        <div className="grid gap-3 max-h-60 overflow-y-auto">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium">{user.firstName} {user.lastName}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
                <div className="text-xs text-gray-500">
                  Added: {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => deleteUser(user.id)}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Integration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Shopify Integration */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Shopify Integration</h2>
          <div className="mb-4 p-3 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-900 mb-2 text-sm">Sync Strategy:</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• <strong>One-Time Full Sync:</strong> Get all 677 historical orders (run once)</li>
              <li>• <strong>Incremental Sync:</strong> Get only new orders since last sync (run regularly)</li>
              <li>• <strong>Recent Orders:</strong> Get last 250 orders (for testing)</li>
            </ul>
          </div>
          <div className="space-y-3">
            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncMessage("");
                setSyncProgress("Starting FULL sync of ALL orders...");
                
                try {
                  const response = await fetch("/api/shopify/sync-all-orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      shop: "f184d9-2",
                      accessToken: "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"
                    }),
                  });
                  
                  const result = await response.json();
                  
                  if (response.ok) {
                    setSyncMessage(`✅ ${result.message} (${result.stats.inserted} new, ${result.stats.updated} updated)`);
                    setSyncProgress("");
                  } else {
                    setSyncMessage(`❌ Error: ${result.error}`);
                    setSyncProgress("");
                  }
                } catch (error) {
                  setSyncMessage(`❌ Error: ${error instanceof Error ? error.message : "Failed to sync all orders"}`);
                  setSyncProgress("");
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {isSyncing ? "Syncing ALL..." : "One-Time Full Sync (All 677 Orders)"}
            </button>
            <button
              onClick={syncNewOrders}
              disabled={isSyncing}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSyncing ? "Syncing..." : "Sync New Orders Only (Incremental)"}
            </button>
            <button
              onClick={syncShopifyOrders}
              disabled={isSyncing}
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isSyncing ? "Syncing..." : "Sync Recent Orders (250 limit)"}
            </button>
            <button
              onClick={async () => {
                setIsSyncing(true);
                try {
                  const response = await fetch('/api/sync/unified', { method: 'POST' });
                  const data = await response.json();
                  setSyncMessage(`✅ ${data.message || 'Unified sync completed'}`);
                } catch (error) {
                  setSyncMessage(`❌ Error: ${error.message}`);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {isSyncing ? "Syncing..." : "Sync to Unified Tables"}
            </button>
          </div>
          
          {syncMessage && (
            <div className={`p-3 rounded text-sm mt-4 ${
              syncMessage.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {syncMessage}
            </div>
          )}
          
          {syncProgress && (
            <div className="p-3 rounded text-sm mt-4 bg-blue-100 text-blue-800">
              {syncProgress}
            </div>
          )}
        </div>

        {/* QuickBooks Webhook */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">QuickBooks via Zapier</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook URL for Zapier
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-50 text-sm"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(webhookUrl)}
                  className="px-3 py-2 bg-gray-600 text-white rounded-r-md hover:bg-gray-700 text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div className="p-3 bg-green-50 rounded-md">
              <h3 className="font-medium text-green-900 mb-2 text-sm">Zapier Configuration:</h3>
              <ol className="text-xs text-green-800 space-y-1">
                <li>1. Create a Zapier webhook trigger</li>
                <li>2. Use the URL above as your webhook endpoint</li>
                <li>3. Configure QuickBooks to send new invoices to this webhook</li>
                <li>4. New invoices will automatically appear in your system!</li>
              </ol>
            </div>
            
            <div className="p-3 bg-yellow-50 rounded-md">
              <h3 className="font-medium text-yellow-900 mb-2 text-sm">Local Development:</h3>
              <p className="text-xs text-yellow-800">
                For local testing, use <code className="bg-yellow-100 px-1 rounded">http://localhost:3000/api/webhooks/quickbooks</code>
                <br />
                You'll need to use ngrok or similar to expose localhost to Zapier.
              </p>
            </div>
            
            <button
              onClick={() => window.open('/api/webhooks/quickbooks', '_blank')}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Test Webhook Endpoint
            </button>
          </div>
        </div>
      </div>

      {/* Data Explorer & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Data Explorer */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Data Explorer</h2>
          <p className="text-gray-600 mb-4">Explore and analyze your data across all sources</p>
          <a 
            href="/admin/data-explorer" 
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-center block"
          >
            Open Data Explorer
          </a>
        </div>

        {/* Data Status Overview */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Data Status Overview</h2>
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Source Tables</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• shopify_customers</li>
                <li>• shopify_orders</li>
                <li>• quickbooks_customers</li>
                <li>• quickbooks_orders</li>
              </ul>
            </div>
            <div className="p-4 bg-gray-50 rounded-md">
              <h3 className="font-medium text-gray-900 mb-2">Unified Tables</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• customers (unified)</li>
                <li>• orders (unified)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
