import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UtensilsCrossed, MapPin, LogOut, ShoppingBag, Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

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
  canteens: {
    name: string;
  };
};

const StudentDashboard = () => {
  const { user, userRole, signOut, loading: authLoading } = useAuth();
  const [canteens, setCanteens] = useState<Canteen[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== "student")) {
      navigate("/auth");
    }
  }, [user, userRole, authLoading, navigate]);

  useEffect(() => {
    if (user && userRole === "student") {
      fetchCanteens();
      fetchOrders();
      subscribeToOrders();
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

  const subscribeToOrders = () => {
    if (!user) return;

    const channel = supabase
      .channel("student-orders")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `student_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Order updated:", payload);
          fetchOrders();
          if (payload.new.status === "ready") {
            toast.success("Your order is ready for pickup! ✅");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
          <Button variant="outline" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Orders Section */}
        {orders.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-primary" />
              Your Orders
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {orders.map((order) => (
                <Card key={order.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{order.canteens.name}</CardTitle>
                        <CardDescription>₹{order.total_amount.toFixed(2)}</CardDescription>
                      </div>
                      {order.status === "ready" ? (
                        <Badge className="bg-success text-white">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <Separator />

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
