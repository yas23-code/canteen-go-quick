import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

type MenuItem = {
  name: string;
  price: string;
};

const VendorRegistration = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [canteenName, setCanteenName] = useState("");
  const [canteenLocation, setCanteenLocation] = useState("");
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { name: "", price: "" },
  ]);
  const [loading, setLoading] = useState(false);

  // Redirect non-vendors to appropriate pages
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate("/auth");
      } else if (userRole === "student") {
        navigate("/student");
      }
    }
  }, [user, userRole, authLoading, navigate]);

  const addMenuItem = () => {
    setMenuItems([...menuItems, { name: "", price: "" }]);
  };

  const removeMenuItem = (index: number) => {
    if (menuItems.length > 1) {
      setMenuItems(menuItems.filter((_, i) => i !== index));
    }
  };

  const updateMenuItem = (index: number, field: "name" | "price", value: string) => {
    const updated = [...menuItems];
    updated[index][field] = value;
    setMenuItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    if (!canteenName.trim() || !canteenLocation.trim()) {
      toast.error("Please fill in all canteen details");
      return;
    }

    const validMenuItems = menuItems.filter(
      (item) => item.name.trim() && item.price.trim()
    );

    if (validMenuItems.length === 0) {
      toast.error("Please add at least one menu item");
      return;
    }

    setLoading(true);

    try {
      // Create canteen
      const { data: canteenData, error: canteenError } = await supabase
        .from("canteens")
        .insert({
          name: canteenName,
          location: canteenLocation,
          vendor_id: user.id,
        })
        .select()
        .single();

      if (canteenError) throw canteenError;

      // Create menu items
      const menuItemsToInsert = validMenuItems.map((item) => ({
        canteen_id: canteenData.id,
        name: item.name,
        price: parseFloat(item.price),
      }));

      const { error: menuError } = await supabase
        .from("menu_items")
        .insert(menuItemsToInsert);

      if (menuError) throw menuError;

      toast.success("Canteen registered successfully!");
      navigate("/vendor");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast.error(error.message || "Failed to register canteen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <UtensilsCrossed className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl">Register Your Canteen</CardTitle>
            <CardDescription>
              Set up your canteen details and menu to start receiving orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="canteenName">Canteen Name</Label>
                <Input
                  id="canteenName"
                  placeholder="e.g., Central Cafeteria"
                  value={canteenName}
                  onChange={(e) => setCanteenName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="canteenLocation">Canteen Location</Label>
                <Input
                  id="canteenLocation"
                  placeholder="e.g., Building A, Ground Floor"
                  value={canteenLocation}
                  onChange={(e) => setCanteenLocation(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Menu Items</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMenuItem}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-3">
                  {menuItems.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <div className="flex-1">
                        <Input
                          placeholder="Item name"
                          value={item.name}
                          onChange={(e) =>
                            updateMenuItem(index, "name", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={item.price}
                          onChange={(e) =>
                            updateMenuItem(index, "price", e.target.value)
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMenuItem(index)}
                        disabled={menuItems.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Registering..." : "Register Canteen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VendorRegistration;
