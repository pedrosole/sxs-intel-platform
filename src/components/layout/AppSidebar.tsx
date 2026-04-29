"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  MessageSquare,
  Users,
  FolderOpen,
  Settings,
  ChevronLeft,
  Menu,
  BarChart3,
  Zap,
  Palette,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const menuItems = [
  { label: "Chat", icon: MessageSquare, path: "/" },
  { label: "Equipe", icon: Users, path: "/equipe" },
  { label: "Clientes", icon: FolderOpen, path: "/clientes" },
  { label: "Pipeline", icon: Zap, path: "/pipeline" },
  { label: "Design Studio", icon: Palette, path: "/design" },
]

const adminItems = [
  { label: "Analytics", icon: BarChart3, path: "/analytics" },
  { label: "Config", icon: Settings, path: "/config" },
]

function NavButton({
  item,
  collapsed = false,
  isActive,
  onClick,
}: {
  item: { label: string; icon: React.ComponentType<{ className?: string }>; path: string; badge?: number }
  collapsed?: boolean
  isActive: boolean
  onClick?: () => void
}) {
  const Icon = item.icon

  const btnContent = (
    <Link
      href={item.path}
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 rounded-lg text-sm transition-all duration-150
        ${collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5"}
        ${isActive
          ? "bg-primary text-primary-foreground font-semibold shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
        }
      `}
    >
      <Icon className={`shrink-0 ${collapsed ? "h-5 w-5" : "h-4 w-4"}`} />
      {!collapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
      {!collapsed && item.badge && item.badge > 0 ? (
        <Badge variant="destructive" className="h-5 px-1.5 text-[10px] font-bold">
          {item.badge > 99 ? "99+" : item.badge}
        </Badge>
      ) : null}
      {collapsed && item.badge && item.badge > 0 ? (
        <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-destructive" />
      ) : null}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger className="relative w-full">
          {btnContent}
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return btnContent
}

function SidebarContent({
  collapsed = false,
  pathname,
  onNavigate,
}: {
  collapsed?: boolean
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className={`flex items-center border-b border-sidebar-border h-14 ${collapsed ? "justify-center px-2" : "px-4"}`}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger className="text-lg font-bold text-primary">
              S
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs font-medium">SXS Intel</TooltipContent>
          </Tooltip>
        ) : (
          <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
            <span className="text-primary">SXS</span> Intel
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-3 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}>
        {menuItems.map((item) => (
          <NavButton
            key={item.path}
            item={item}
            collapsed={collapsed}
            isActive={pathname === item.path}
            onClick={onNavigate}
          />
        ))}

        {/* Admin group */}
        <div className={`pt-4 pb-1.5 ${collapsed ? "flex justify-center" : ""}`}>
          {collapsed
            ? <div className="w-6 border-t border-border" />
            : <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-3">Gestao</p>
          }
        </div>
        {adminItems.map((item) => (
          <NavButton
            key={item.path}
            item={item}
            collapsed={collapsed}
            isActive={pathname === item.path}
            onClick={onNavigate}
          />
        ))}
      </nav>
    </div>
  )
}

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`
          hidden lg:flex flex-col shrink-0
          bg-white/[0.03] backdrop-blur-xl border-r border-white/[0.08]
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? "w-16" : "w-60"}
        `}
      >
        <SidebarContent collapsed={sidebarCollapsed} pathname={pathname} />
        {/* Collapse button */}
        <div className={`border-t border-border/50 py-2 ${sidebarCollapsed ? "px-2" : "px-3"}`}>
          {!sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Recolher</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger
                className="w-full flex items-center justify-center py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                onClick={() => setSidebarCollapsed(false)}
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Expandir</TooltipContent>
            </Tooltip>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm shrink-0 lg:hidden">
          <div className="px-4 py-3 flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors lg:hidden">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
                <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              <span className="text-primary">SXS</span> Intel
            </span>
          </div>
        </header>

        {/* Page content */}
        {children}
      </div>
    </div>
  )
}
