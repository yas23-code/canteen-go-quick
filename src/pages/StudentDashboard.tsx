import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed, MapPin, LogOut, Bell, BellOff, History } from "lucide-react";
import { toast } from "sonner";
import { requestNotificationPermission, showOrderReadyNotification } from "@/utils/notifications";

type Canteen = {
  id: string;
  name: string;
  location: string;
  image_url: string | null;
};

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  pickup_code: string;
  canteens: {
    name: string;
  };
};

const StudentDashboard = () => {
  const { user, userRole, signOut, loading: authLoading } = useAuth();
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "student")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    // Check notification permission status
    if ("Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  useEffect(() => {
    if (user && userRole === "student") {
      fetchCanteens();
      fetchOrders();
      subscribeToOrderUpdates();
    }
  }, [user, userRole]);

  const fetchCanteens = async () => {
    try {
      const { data, error } = await supabase
        .from("canteens")
        .select("*")
        .order("name");

      if (error) throw error;
      setCanteens(data || []);
    } catch (error) {
      console.error("Error fetching canteens:", error);
      toast.error("Failed to load canteens");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToOrderUpdates = () => {
    if (!user) return;

    const channel = supabase
      .channel("student-order-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `student_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("Order update:", payload);
          
          const newOrder = payload.new as any;
          const oldOrder = payload.old as any;
          
          // Check if order just became ready
          if (oldOrder.status === "pending" && newOrder.status === "ready") {
            // Fetch canteen details for the notification
            const { data: canteenData } = await supabase
              .from("canteens")
              .select("name")
              .eq("id", newOrder.canteen_id)
              .single();
            
            if (notificationsEnabled && canteenData) {
              showOrderReadyNotification({
                canteenName: canteenData.name,
                totalAmount: newOrder.total_amount,
              });
            }
            
            toast.success("Your order is ready for pickup!");
            fetchOrders();
          } else if (newOrder.status !== oldOrder.status) {
            fetchOrders();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const granted = await requestNotificationPermission();
      setNotificationsEnabled(granted);
      if (granted) {
        toast.success("Notifications enabled! You'll be notified when your orders are ready.");
      } else {
        toast.error("Notification permission denied. Please enable it in your browser settings.");
      }
    } else {
      toast.info("To disable notifications, please update your browser settings.");
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          canteens (name)
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">CanteenGo</h1>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={notificationsEnabled ? "default" : "outline"}
              size="sm"
              onClick={handleNotificationToggle}
              title={notificationsEnabled ? "Notifications enabled" : "Enable notifications"}
            >
              {notificationsEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/student/orders")}>
              <History className="h-4 w-4 mr-2" />
              Orders
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Canteens Section */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Available Canteens</h2>
          {canteens.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No canteens available at the moment
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {canteens.map((canteen) => (
                <Card
                  key={canteen.id}
                  className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group"
                  onClick={() => navigate(`/student/canteen/${canteen.id}`)}
                >
                  <div className="h-48 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <UtensilsCrossed className="h-16 w-16 text-primary/40 group-hover:scale-110 transition-transform" />
                  </div>
                  <CardHeader>
                    <CardTitle className="group-hover:text-primary transition-colors">
                      {canteen.name}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {canteen.location}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" variant="default">
                      View Menu
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default StudentDashboard;
