# Production Code References

## Overview

Complete, production-ready React, TypeScript, and Tailwind CSS components demonstrating the UI design language standards.

---

## 1. Fixed Desktop Top Navbar with "More" Dropdown

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Home, 
  BarChart3, 
  Layers, 
  Users, 
  Settings, 
  ChevronDown, 
  HelpCircle, 
  ShieldCheck, 
  LogOut, 
  User 
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Projects", href: "/projects", icon: Layers },
  { label: "Team", href: "/team", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

const OVERFLOW_NAV: NavItem[] = [
  { label: "Audit Logs", href: "/audit", icon: ShieldCheck },
  { label: "Documentation", href: "/docs", icon: HelpCircle },
];

export function DesktopTopNavbar({ activeHref = "/dashboard" }: { activeHref?: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 z-50 px-6">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            DL
          </div>
          <span className="font-semibold text-slate-100 tracking-tight">CoreApp</span>
        </div>

        {/* Primary Desktop Nav (Max 5 items + More dropdown) */}
        <nav className="hidden md:flex items-center gap-1">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800/80 text-blue-400 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Overflow Menu */}
          {OVERFLOW_NAV.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen(!moreOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
                aria-expanded={moreOpen}
              >
                <span>More</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
              </button>

              {moreOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-1.5 z-50">
                  {OVERFLOW_NAV.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        className="flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-slate-400" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Profile Avatar & Menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-full hover:bg-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-expanded={profileOpen}
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
              JD
            </div>
          </button>

          {profileOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1.5 z-50">
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <p className="text-xs font-semibold text-slate-200">Jane Doe</p>
                <p className="text-xs text-slate-400 truncate">jane.doe@example.com</p>
              </div>
              <Link
                href="/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>Account Profile</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  // handle logout
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
```

---

## 2. Desktop Fixed Sidebar with Profile Section

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  BarChart, 
  Sliders, 
  LifeBuoy, 
  LogOut, 
  MoreVertical,
  User
} from "lucide-react";

interface SidebarGroup {
  groupName: string;
  items: {
    label: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    groupName: "Overview",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
      { label: "Inventory", href: "/admin/inventory", icon: Package },
    ],
  },
  {
    groupName: "Management",
    items: [
      { label: "Customers", href: "/admin/customers", icon: Users },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart },
      { label: "System Config", href: "/admin/config", icon: Sliders },
    ],
  },
];

export function DesktopSidebar({ activeHref = "/admin" }: { activeHref?: string }) {
  const [profileDropdown, setProfileDropdown] = useState(false);

  return (
    <aside className="fixed top-0 bottom-0 left-0 w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between z-40">
      {/* Brand Header */}
      <div>
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            DL
          </div>
          <span className="font-semibold text-slate-100 text-base">CommerceHub</span>
        </div>

        {/* Grouped Links */}
        <nav className="p-4 space-y-6">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.groupName} className="space-y-1.5">
              <span className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {group.groupName}
              </span>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeHref === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-slate-900 text-blue-400 border border-slate-800"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer / Profile Card */}
      <div className="p-4 border-t border-slate-800/80 relative">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
              AL
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">Alex Lewis</p>
              <p className="text-[11px] text-slate-500 truncate">Admin</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProfileDropdown(!profileDropdown)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="User Options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Popover */}
        {profileDropdown && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1.5 z-50">
            <Link
              href="/admin/profile"
              onClick={() => setProfileDropdown(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-slate-400" />
              <span>Profile Settings</span>
            </Link>
            <Link
              href="/admin/support"
              onClick={() => setProfileDropdown(false)}
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LifeBuoy className="w-4 h-4 text-slate-400" />
              <span>Help & Support</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setProfileDropdown(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
```

---

## 3. Mobile Fixed Bottom Navigation Bar + Bottom Drawer

```tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Home, 
  Search, 
  Bell, 
  FolderKanban, 
  Menu, 
  X, 
  User, 
  ShieldCheck, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  SunMoon
} from "lucide-react";

interface MobileBottomBarProps {
  activeTab?: string;
}

export function MobileNavigation({ activeTab = "home" }: MobileBottomBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Fixed Bottom Bar (Visible on mobile only) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800 z-50 px-2 pb-[env(safe-area-inset-bottom)] flex items-center justify-around">
        <Link
          href="/m"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === "home" ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/m/search"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === "search" ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Search className="w-5 h-5 mb-0.5" />
          <span>Search</span>
        </Link>

        <Link
          href="/m/projects"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === "projects" ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FolderKanban className="w-5 h-5 mb-0.5" />
          <span>Projects</span>
        </Link>

        <Link
          href="/m/notifications"
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeTab === "notifications" ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Bell className="w-5 h-5 mb-0.5" />
          <span>Alerts</span>
        </Link>

        {/* More Button (Triggers Drawer) */}
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            drawerOpen ? "text-blue-400 font-semibold" : "text-slate-400 hover:text-slate-200"
          }`}
          aria-expanded={drawerOpen}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile Bottom Drawer (Sheet) */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full bg-slate-900 border-t border-slate-800 rounded-t-2xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* Drawer Handle */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4" />

            {/* Header & Close */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                  JD
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Jane Doe</h3>
                  <p className="text-xs text-slate-400">Engineering Lead</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overflow Links with Touch Targets >= 48px */}
            <div className="py-3 space-y-1">
              <Link
                href="/m/profile"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-slate-400" />
                  <span>Account & Profile</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </Link>

              <Link
                href="/m/security"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-5 h-5 text-slate-400" />
                  <span>Security & 2FA</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </Link>

              <Link
                href="/m/help"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-800/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-5 h-5 text-slate-400" />
                  <span>Help & Support</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </Link>

              <div className="flex items-center justify-between p-3.5 rounded-xl text-sm font-medium text-slate-200">
                <div className="flex items-center gap-3">
                  <SunMoon className="w-5 h-5 text-slate-400" />
                  <span>Theme (Dark)</span>
                </div>
                <span className="text-xs text-slate-500">System</span>
              </div>
            </div>

            {/* Logout Action */}
            <div className="pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl text-sm font-medium text-rose-400 bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/40 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## 4. Interactive Button with Icon & Loading State

```tsx
"use client";

import React from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  icon?: React.ComponentType<{ className?: string }>;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  isLoading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "text-xs px-2.5 py-1.5 gap-1.5",
    md: "text-sm px-4 py-2 gap-2",
    lg: "text-base px-5 py-2.5 gap-2.5",
  }[size];

  const variantClasses = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white focus:ring-blue-500 shadow-sm",
    secondary: "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 focus:ring-slate-400",
    ghost: "bg-transparent hover:bg-slate-800/80 text-slate-300 hover:text-white focus:ring-slate-500",
    destructive: "bg-rose-600/10 hover:bg-rose-600 hover:text-white text-rose-400 border border-rose-500/20 focus:ring-rose-500",
  }[variant];

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }[size];

  return (
    <button
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizes} animate-spin`} />
      ) : Icon ? (
        <Icon className={iconSizes} />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
```

---

## 5. Responsive Tab Component

```tsx
"use client";

import React, { useState } from "react";
import { Activity, Shield, Users, Server } from "lucide-react";

interface TabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "security", label: "Security", icon: Shield },
  { id: "members", label: "Members", icon: Users },
  { id: "infrastructure", label: "Clusters", icon: Server },
];

export function ResponsiveTabs() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="w-full space-y-4">
      {/* Desktop: Horizontal bar / Mobile: Responsive grid */}
      <div className="border-b border-slate-800 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 md:gap-2 px-3 py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800 text-blue-400 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
        {activeTab === "overview" && <p className="text-sm text-slate-300">Cluster metrics and uptime details.</p>}
        {activeTab === "security" && <p className="text-sm text-slate-300">Firewall policies and TLS certificates.</p>}
        {activeTab === "members" && <p className="text-sm text-slate-300">Role assignments and invite links.</p>}
        {activeTab === "infrastructure" && <p className="text-sm text-slate-300">Node pools and hardware allocation.</p>}
      </div>
    </div>
  );
}
```

---

## 6. Domain-Grounded Metric Card

```tsx
"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  comparisonPercentage: number;
  timeHorizon: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function MetricCard({
  title,
  value,
  comparisonPercentage,
  timeHorizon,
  icon: Icon,
}: MetricCardProps) {
  const isPositive = comparisonPercentage >= 0;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 sm:p-5 flex flex-col justify-between space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        <div className="p-2 rounded-lg bg-slate-800/80 text-slate-300">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {/* Value */}
      <div>
        <span className="text-2xl font-bold tracking-tight text-slate-100">{value}</span>
      </div>

      {/* Comparison & Horizon */}
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className={`flex items-center gap-1 font-semibold ${
            isPositive ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {isPositive ? `+${comparisonPercentage}%` : `${comparisonPercentage}%`}
        </span>
        <span className="text-slate-500 truncate">vs {timeHorizon}</span>
      </div>
    </div>
  );
}
```

---

## 7. Form Modal with Icon Action Buttons

```tsx
"use client";

import React, { useState } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { Button } from "./Button";

interface FormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { endpointName: string; targetUrl: string }) => Promise<void>;
}

export function FormModal({ isOpen, onClose, onSubmit }: FormModalProps) {
  const [endpointName, setEndpointName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endpointName.trim()) {
      setError("Endpoint name is required.");
      return;
    }
    if (!targetUrl.startsWith("https://")) {
      setError("Target URL must begin with https://");
      return;
    }

    try {
      setError(null);
      setLoading(true);
      await onSubmit({ endpointName, targetUrl });
      onClose();
    } catch {
      setError("Failed to register endpoint. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 space-y-4 z-10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-semibold text-slate-100">Create Webhook Endpoint</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Endpoint Identifier</label>
            <input
              type="text"
              value={endpointName}
              onChange={(e) => setEndpointName(e.target.value)}
              placeholder="e.g. stripe-charge-success"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Destination URL</label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://api.domain.com/webhooks"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <Button type="button" variant="ghost" icon={X} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon={Check} isLoading={loading}>
              Save Endpoint
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 8. Input with Leading and Trailing Icons (`InputWithIcon`)

```tsx
"use client";

import React, { forwardRef } from "react";
import { Search, X } from "lucide-react";

interface InputWithIconProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leadingIcon?: React.ComponentType<{ className?: string }>;
  trailingIcon?: React.ComponentType<{ className?: string }>;
  onTrailingIconClick?: () => void;
  trailingIconLabel?: string;
}

export const InputWithIcon = forwardRef<HTMLInputElement, InputWithIconProps>(
  (
    {
      label,
      error,
      leadingIcon: LeadingIcon = Search,
      trailingIcon: TrailingIcon,
      onTrailingIconClick,
      trailingIconLabel = "Clear input",
      className = "",
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {LeadingIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              <LeadingIcon className="w-4 h-4" />
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={`w-full bg-slate-950 border text-sm text-slate-100 placeholder-slate-500 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed ${
              LeadingIcon ? "pl-9" : "pl-3"
            } ${TrailingIcon ? "pr-9" : "pr-3"} py-2 ${
              error
                ? "border-rose-500/80 focus-visible:ring-rose-500"
                : "border-slate-700 hover:border-slate-600 focus-visible:ring-blue-500 focus-visible:border-blue-500"
            } ${className}`}
            {...props}
          />
          {TrailingIcon && (
            <div className="absolute right-2.5 flex items-center">
              {onTrailingIconClick ? (
                <button
                  type="button"
                  onClick={onTrailingIconClick}
                  disabled={disabled}
                  aria-label={trailingIconLabel}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 transition-colors"
                >
                  <TrailingIcon className="w-4 h-4" />
                </button>
              ) : (
                <div className="p-1 pointer-events-none text-slate-400">
                  <TrailingIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    );
  }
);

InputWithIcon.displayName = "InputWithIcon";
```
