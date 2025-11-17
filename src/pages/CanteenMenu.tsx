import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ShoppingCart, Plus, Minus, Trash2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_available: boolean;
};

type CartItem = MenuItem & { quantity: number };

const CanteenMenu = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [canteen, setCanteen] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [showPickupDialog, setShowPickupDialog] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCanteenAndMenu();
    }
  }, [id]);

  const fetchCanteenAndMenu = async () => {
    try {
      const { data: canteenData, error: canteenError } = await supabase
        .from("canteens")
        .select("*")
        .eq("id", id)
        .single();

      if (canteenError) throw canteenError;
      setCanteen(canteenData);

      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("canteen_id", id)
        .eq("is_available", true)
        .order("name");

      if (menuError) throw menuError;
      setMenuItems(menuData || []);
    } catch (error) {
      console.error("Error fetching menu:", error);
      toast.error("Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  const clearItemFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((i) => i.id !== itemId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const placeOrder = async () => {
    if (!user || cart.length === 0) return;

    setPlacing(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          student_id: user.id,
          canteen_id: id,
          total_amount: totalAmount,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Show pickup code dialog
      setPickupCode(orderData.pickup_code);
      setShowPickupDialog(true);
      toast.success("Order placed successfully!");
      setCart([]);
    } catch (error: any) {
      console.error("Error placing order:", error);
      toast.error(error.message || "Failed to place order");
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="bg-card border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/student")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Canteens
          </Button>
          <h1 className="text-3xl font-bold">{canteen?.name}</h1>
          <p className="text-muted-foreground">{canteen?.location}</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-4">Menu</h2>
            {menuItems.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No items available
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {menuItems.map((item) => (
                  <Card key={item.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      {item.description && (
                        <CardDescription>{item.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <span className="text-xl font-bold text-primary">
                          ₹{item.price.toFixed(2)}
                        </span>
                        <Button onClick={() => addToCart(item)} size="sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Your Cart
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Cart is empty</p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ₹{item.price.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => addToCart(item)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            onClick={() => clearItemFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between items-center font-bold text-lg">
                      <span>Total</span>
                      <span className="text-primary">₹{totalAmount.toFixed(2)}</span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={placeOrder}
                      disabled={placing || cart.length === 0}
                    >
                      {placing ? "Placing Order..." : "Place Order"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={showPickupDialog} onOpenChange={(open) => {
        setShowPickupDialog(open);
        if (!open) navigate("/student");
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Order Placed Successfully!
            </DialogTitle>
            <DialogDescription>
              Save your pickup code to collect your order
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 py-4">
            <div className="text-sm text-muted-foreground">Your Pickup Code:</div>
            <div className="text-6xl font-bold tracking-wider text-primary">
              {pickupCode}
            </div>
            <div className="text-sm text-muted-foreground text-center">
              Show this code to the vendor when collecting your order
            </div>
          </div>
          <Button onClick={() => {
            setShowPickupDialog(false);
            navigate("/student");
          }}>
            Got it!
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CanteenMenu;
