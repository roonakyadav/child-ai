import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  Activity,
  ShieldAlert,
  BarChart3,
  Compass,
  GraduationCap,
  Timer,
  Settings,
  ArrowLeft,
  Bot,
} from "lucide-react";

const navItems = [
  { title: "Overview", url: "/parent-dashboard/overview", icon: LayoutDashboard },
  { title: "Activity Feed", url: "/parent-dashboard/activity", icon: Activity },
  { title: "Safety & Alerts", url: "/parent-dashboard/safety", icon: ShieldAlert },
  { title: "Usage Analytics", url: "/parent-dashboard/analytics", icon: BarChart3 },
  { title: "Interest Mapping", url: "/parent-dashboard/interests", icon: Compass },
  { title: "Learning Progress", url: "/parent-dashboard/progress", icon: GraduationCap },
  { title: "Screen Time", url: "/parent-dashboard/screen-time", icon: Timer },
  { title: "AI Settings", url: "/parent-dashboard/policy", icon: Bot },
  { title: "Settings", url: "/parent-dashboard/settings", icon: Settings },
];

function ParentSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-primary/5 bg-sidebar shadow-soft">
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-4">
            {!collapsed && "Management"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm font-bold text-muted-foreground/80 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                      activeClassName="bg-primary/10 text-primary shadow-sm"
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const ParentLayout = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("parent_authenticated");
    localStorage.removeItem("parent_auth_time");
    navigate("/parent");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background selection:bg-primary/20 selection:text-primary">
        <ParentSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center gap-4 border-b border-primary/5 bg-white/80 px-6 backdrop-blur-md sticky top-0 z-50">
            <SidebarTrigger className="hover:bg-primary/5 text-primary" />
            <div className="h-4 w-px bg-primary/10" />
            <button
              onClick={() => {
                localStorage.removeItem("parent_authenticated");
                localStorage.removeItem("parent_auth_time");
                navigate("/");
              }}
              className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-all group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              Back to Alex's App
            </button>
            <div className="ml-auto flex items-center gap-6">
              <div className="flex items-center gap-3 rounded-2xl bg-background px-4 py-1.5 border border-primary/5 shadow-sm">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-black text-foreground uppercase tracking-widest">
                  Parent Mode
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="text-[11px] font-black text-destructive hover:text-destructive/80 uppercase tracking-widest transition-colors"
              >
                Sign out
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6 sm:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ParentLayout;
