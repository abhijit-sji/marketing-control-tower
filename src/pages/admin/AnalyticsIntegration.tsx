import { useState, useEffect } from "react";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface Brand {
  id: string;
  name: string;
}

export default function AnalyticsIntegration() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");
  const [inputMeasurementId, setInputMeasurementId] = useState("");
  const [inputStreamUrl, setInputStreamUrl] = useState("");
  
  const { connection, measurementId, streamUrl, loading, fetchConnection, saveMeasurementId, removeMeasurementId } = 
    useGoogleAnalytics(selectedBrandId);

  useEffect(() => {
    const fetchBrands = async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) {
        console.error("Error fetching brands:", error);
        toast.error("Failed to load brands");
      } else {
        setBrands(data || []);
        if (data && data.length > 0 && !selectedBrandId) {
          setSelectedBrandId(data[0].id);
        }
      }
    };

    fetchBrands();
  }, []);

  useEffect(() => {
    if (selectedBrandId) {
      fetchConnection();
    }
  }, [selectedBrandId, fetchConnection]);

  useEffect(() => {
    if (measurementId) {
      setInputMeasurementId(measurementId);
    } else {
      setInputMeasurementId("");
    }
    
    if (streamUrl) {
      setInputStreamUrl(streamUrl);
    } else {
      setInputStreamUrl("");
    }
  }, [measurementId, streamUrl]);

  const handleSave = async () => {
    if (!inputMeasurementId.trim()) {
      toast.error("Please enter a Measurement ID");
      return;
    }

    if (!inputMeasurementId.match(/^G-[A-Z0-9]+$/)) {
      toast.error("Invalid Measurement ID format. Expected: G-XXXXXXXXXX");
      return;
    }

    if (!inputStreamUrl.trim()) {
      toast.error("Please enter a Stream URL");
      return;
    }

    try {
      await saveMeasurementId(inputMeasurementId.trim(), inputStreamUrl.trim());
      toast.success("Google Analytics connected successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to save configuration");
    }
  };

  const handleRemove = async () => {
    try {
      await removeMeasurementId();
      toast.success("Google Analytics disconnected successfully");
      setInputMeasurementId("");
      setInputStreamUrl("");
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Google Analytics Integration</h1>
          <p className="text-muted-foreground mt-2">
            Configure Google Analytics Measurement ID for each brand
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Brand</CardTitle>
            <CardDescription>
              Choose the brand you want to configure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedBrandId && (
          <Card>
            <CardHeader>
              <CardTitle>Google Analytics Configuration</CardTitle>
              <CardDescription>
                Enter your Google Analytics 4 Stream URL and Measurement ID
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {connection && (
                    <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-md">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                      <div className="flex-1">
                        <p className="font-medium text-success">Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Measurement ID: {measurementId}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Stream: {streamUrl}
                        </p>
                      </div>
                    </div>
                  )}

                  {!connection && (
                    <div className="flex items-center gap-2 p-3 bg-muted border rounded-md">
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Not connected to Google Analytics
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="streamUrl">Stream URL</Label>
                      <Input
                        id="streamUrl"
                        placeholder="https://example.com"
                        value={inputStreamUrl}
                        onChange={(e) => setInputStreamUrl(e.target.value)}
                        type="url"
                      />
                      <p className="text-xs text-muted-foreground">
                        The website URL that you're tracking with Google Analytics
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="measurementId">Measurement ID</Label>
                      <Input
                        id="measurementId"
                        placeholder="G-XXXXXXXXXX"
                        value={inputMeasurementId}
                        onChange={(e) => setInputMeasurementId(e.target.value.toUpperCase())}
                        pattern="G-[A-Z0-9]+"
                      />
                      <p className="text-xs text-muted-foreground">
                        Find your Measurement ID in Google Analytics under Admin → Data Streams
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleSave} disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {connection ? "Update" : "Connect"} Google Analytics
                    </Button>
                    
                    {connection && (
                      <Button 
                        variant="destructive" 
                        onClick={handleRemove} 
                        disabled={loading}
                      >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Disconnect
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
