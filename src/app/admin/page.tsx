"use client";

import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import ProfileDropdown from "@/components/ProfileDropdown";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncProgress, setSyncProgress] = useState("");
  
  // Webhook state
  const [webhookUrl, setWebhookUrl] = useState("");

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
    setSyncProgress("Starting incremental sync and data explorer update...");
    
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
    <ProtectedRoute adminOnly={true}>
      <div className="min-h-screen bg-white p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8 bg-black p-4 rounded-lg">
          <h1 className="text-4xl kinetic-title text-white">Admin Cockpit ⚡</h1>
          <ProfileDropdown />
        </div>
      

      {/* Data Integration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Shopify Integration */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 bg-[#3B83BE] text-white p-3 rounded-lg">Data Sync</h2>
          <div className="mb-4 p-3 bg-green-50 rounded-md">
            <h3 className="font-medium text-green-900 mb-2 text-sm">✅ Historical Data Complete:</h3>
            <ul className="text-xs text-green-800 space-y-1">
              <li>• <strong>677 Shopify orders</strong> synced and available</li>
              <li>• <strong>All data accessible</strong> in Data Explorer</li>
              <li>• <strong>Ready for development</strong> and GUI building</li>
            </ul>
          </div>
          <div className="space-y-3">
            <button
              onClick={syncNewOrders}
              disabled={isSyncing}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSyncing ? "Syncing..." : "Fetch New Orders"}
            </button>
            <div className="text-center text-sm text-gray-500">
              Use Data Explorer to view and filter all data
            </div>
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
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 bg-[#5BAB56] text-white p-3 rounded-lg">QuickBooks via Zapier</h2>
          
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

        {/* User Management */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 bg-[#C43C37] text-white p-3 rounded-lg">User Management</h2>
          <p className="text-gray-600 mb-4">Manage team access and user accounts</p>
          <a 
            href="/admin/users" 
            className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-center block"
          >
            Manage Users
          </a>
        </div>

        {/* Data Explorer & Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          
          {/* Data Explorer */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 bg-[#D7923E] text-white p-3 rounded-lg">Data Explorer</h2>
            <p className="text-gray-600 mb-4">Explore and analyze your data across all sources</p>
            <a 
              href="/admin/data-explorer" 
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-center block"
            >
              Open Data Explorer
            </a>
          </div>

          {/* Sales Trends */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 bg-[#915A9D] text-white p-3 rounded-lg">Sales Trends</h2>
            <p className="text-gray-600 mb-4">Visualize sales performance and SKU trends over time</p>
            <a 
              href="/admin/trends" 
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-center block"
            >
              View Sales Trends
            </a>
          </div>

        {/* Data Status Overview */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 bg-black text-white p-3 rounded-lg">Data Status Overview</h2>
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
    </ProtectedRoute>
  );
}
