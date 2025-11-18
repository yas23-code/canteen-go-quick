import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UtensilsCrossed, LogOut, CheckCircle2, Clock, Plus, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

type Order = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  pickup_code: string;
  profiles: {
    name: string;
  };
  order_items: {
    quantity: number;
    menu_items: {
      name: string;
    };
  }[];
};

const VendorDashboard = () => {
  const { user, userRole, signOut, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [canteen, setCanteen] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.justRegistered;

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "vendor")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    const checkCanteenRegistration = async () => {
      // Skip check if just registered
      if (justRegistered) {
        return;
      }
      
      if (user && userRole === "vendor") {
        const { data } = await supabase
          .from("canteens")
          .select("id")
          .eq("vendor_id", user.id)
          .maybeSingle();
        
        if (!data) {
          navigate("/vendor/register");
        }
      }
    };
    
    checkCanteenRegistration();
  }, [user, userRole, navigate, justRegistered]);

  useEffect(() => {
    if (user && userRole === "vendor") {
      fetchCanteenAndOrders();
      subscribeToOrders();
    }
  }, [user, userRole]);

  const fetchCanteenAndOrders = async () => {
    if (!user) return;

    try {
      const { data: canteenData, error: canteenError } = await supabase
        .from("canteens")
        .select("*")
        .eq("vendor_id", user.id)
        .limit(1)
        .single();

      if (canteenError) throw canteenError;
      setCanteen(canteenData);

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (
            quantity,
            menu_items (name)
          )
        `)
        .eq("canteen_id", canteenData.id)
        .order("created_at", { ascending: false });

      // Fetch student profiles separately
      if (ordersData) {
        const studentIds = [...new Set(ordersData.map((o) => o.student_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", studentIds);

        const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);
        
        const ordersWithProfiles = ordersData.map((order) => ({
          ...order,
          profiles: profilesMap.get(order.student_id) || { name: "Unknown" },
        }));
        
        setOrders(ordersWithProfiles as any);
      }

      if (ordersError) throw ordersError;
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const subscribeToOrders = () => {
    if (!user) return;

    const channel = supabase
      .channel("vendor-orders")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          console.log("New order:", payload);
          fetchCanteenAndOrders();
          toast.success("New order received!");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markOrderReady = async (orderId: string) => {
    if (updatingOrderId) return;
    
    setUpdatingOrderId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "ready" })
        .eq("id", orderId);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      toast.success("Order marked as ready!");
      await fetchCanteenAndOrders();
    } catch (error: any) {
      console.error("Error updating order:", error);
      toast.error(error.message || "Failed to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const markOrderCompleted = async (orderId: string) => {
    if (updatingOrderId) return;
    
    setUpdatingOrderId(orderId);
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", orderId);

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      toast.success("Order marked as completed!");
      await fetchCanteenAndOrders();
    } catch (error: any) {
      console.error("Error completing order:", error);
      toast.error(error.message || "Failed to complete order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filterOrdersBySearch = (ordersList: Order[]) => {
    if (!searchTerm) return ordersList;
    return ordersList.filter((order) => 
      order.pickup_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const pendingOrders = filterOrdersBySearch(orders.filter((o) => o.status === "pending"));
  const readyOrders = filterOrdersBySearch(orders.filter((o) => o.status === "ready"));
  const completedOrders = filterOrdersBySearch(orders.filter((o) => o.status === "completed"));

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!canteen) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Canteen Found</CardTitle>
            <CardDescription>
              You don't have a canteen registered yet. Please contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">{canteen.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{canteen.location}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/vendor/menu")}>
              <Plus className="h-4 w-4 mr-2" />
              Manage Menu
            </Button>
            <Button variant="outline" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by pickup code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending">
              <Clock className="h-4 w-4 mr-2" />
              Pending ({pendingOrders.length})
            </TabsTrigger>
            <TabsTrigger value="ready">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Ready ({readyOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              <Package className="h-4 w-4 mr-2" />
              Completed ({completedOrders.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No pending orders
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {order.profiles.name}
                            <span className="text-sm font-mono text-primary">#{order.pickup_code}</span>
                          </CardTitle>
                          <CardDescription>₹{order.total_amount.toFixed(2)}</CardDescription>
                        </div>
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        {order.order_items.map((item, idx) => (
                          <div key={idx} className="text-sm">
                            {item.quantity}x {item.menu_items.name}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      <Button
                        className="w-full"
                        onClick={() => markOrderReady(order.id)}
                        disabled={updatingOrderId === order.id}
                      >
                        {updatingOrderId === order.id ? "Updating..." : "Mark as Ready"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ready">
            {readyOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No ready orders
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {readyOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {order.profiles.name}
                            <span className="text-sm font-mono text-primary">#{order.pickup_code}</span>
                          </CardTitle>
                          <CardDescription>₹{order.total_amount.toFixed(2)}</CardDescription>
                        </div>
                        <Badge className="bg-success text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          {item.quantity}x {item.menu_items.name}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      <Button
                        className="w-full mt-2"
                        onClick={() => markOrderCompleted(order.id)}
                        disabled={updatingOrderId === order.id}
                      >
                        {updatingOrderId === order.id ? "Completing..." : "Mark as Completed"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed">
            {completedOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No completed orders
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{order.profiles.name}</CardTitle>
                          <CardDescription>₹{order.total_amount.toFixed(2)}</CardDescription>
                        </div>
                        <Badge className="bg-success text-white">
                          <Package className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          {item.quantity}x {item.menu_items.name}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default VendorDashboard;
