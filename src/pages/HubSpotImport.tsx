import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Building2, ArrowLeft, Download, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function HubSpotImport() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm || searchTerm.length < 2) {
      toast.error("Please enter at least 2 characters");
      return;
    }

    console.log('[HubSpot Import] Starting search for:', searchTerm);
    setIsSearching(true);
    
    try {
      console.log('[HubSpot Import] Invoking hubspot-sync function...');
      const { data, error } = await supabase.functions.invoke('hubspot-sync', {
        body: { action: 'search_companies', searchTerm }
      });

      console.log('[HubSpot Import] Response:', { data, error });

      if (error) {
        console.error('[HubSpot Import] Error from edge function:', error);
        throw error;
      }
      
      console.log('[HubSpot Import] Search results:', data);
      setSearchResults(data || []);
      setSelectedCompany(null);
      setContacts([]);
      
      if (!data || data.length === 0) {
        toast.info("No companies found matching your search");
      } else {
        toast.success(`Found ${data.length} companies`);
      }
    } catch (error: any) {
      console.error('[HubSpot Import] Search error:', error);
      toast.error(`Search failed: ${error.message || 'Unknown error'}`, {
        description: error.details || 'Check console for more details'
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchById = async () => {
    if (!companyId) {
      toast.error("Please enter a HubSpot Company or Contact ID");
      return;
    }

    console.log('[HubSpot Import] Fetching by ID:', companyId);
    setIsFetching(true);
    
    try {
      console.log('[HubSpot Import] Invoking hubspot-sync function...');
      const { data, error } = await supabase.functions.invoke('hubspot-sync', {
        body: { action: 'fetch_company_by_id', companyId }
      });

      console.log('[HubSpot Import] Response:', { data, error });

      if (error) {
        console.error('[HubSpot Import] Error from edge function:', error);
        throw error;
      }
      
      setSelectedCompany(data.company);
      setContacts(data.contacts || []);
      setSearchResults([]);
      toast.success("Company details loaded successfully");
    } catch (error: any) {
      console.error('[HubSpot Import] Fetch error:', error);
      toast.error(`Fetch failed: ${error.message || 'Unknown error'}`, {
        description: error.details || 'Check console for more details'
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelectCompany = async (company: any) => {
    console.log('[HubSpot Import] Selecting company:', company.id);
    setIsFetching(true);
    
    try {
      console.log('[HubSpot Import] Invoking hubspot-sync function...');
      const { data, error } = await supabase.functions.invoke('hubspot-sync', {
        body: { action: 'fetch_company_by_id', companyId: company.id }
      });

      console.log('[HubSpot Import] Response:', { data, error });

      if (error) {
        console.error('[HubSpot Import] Error from edge function:', error);
        throw error;
      }
      
      setSelectedCompany(data.company);
      setContacts(data.contacts || []);
      toast.success("Company details loaded successfully");
    } catch (error: any) {
      console.error('[HubSpot Import] Select company error:', error);
      toast.error(`Failed to load company details: ${error.message || 'Unknown error'}`, {
        description: error.details || 'Check console for more details'
      });
    } finally {
      setIsFetching(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCompany) return;

    console.log('[HubSpot Import] Starting import for:', selectedCompany.properties.name);
    setIsImporting(true);
    
    try {
      console.log('[HubSpot Import] Invoking hubspot-sync function...');
      const { data, error } = await supabase.functions.invoke('hubspot-sync', {
        body: { 
          action: 'import_company', 
          company: selectedCompany,
          contacts: contacts
        }
      });

      console.log('[HubSpot Import] Response:', { data, error });

      if (error) {
        console.error('[HubSpot Import] Error from edge function:', error);
        throw error;
      }
      
      toast.success(`Successfully imported ${selectedCompany.properties.name}`);
      // Generate slug from imported client data
      const clientSlug = data.client.company || data.client.name;
      navigate(`/clients/${clientSlug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-") || "client"}`);
    } catch (error: any) {
      console.error('[HubSpot Import] Import error:', error);
      toast.error(`Import failed: ${error.message || 'Unknown error'}`, {
        description: error.details || 'Check console for more details'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard/clients')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Clients
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Import from HubSpot</h1>
          <p className="text-muted-foreground">
            Search for companies or fetch by ID to import into your client database
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Search by Name */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search by Company Name
              </CardTitle>
              <CardDescription>
                Search HubSpot companies by name (minimum 2 characters)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter company name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.map((company) => (
                    <Card key={company.id} className="cursor-pointer hover:border-primary" onClick={() => handleSelectCompany(company)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{company.properties.name}</h3>
                            <p className="text-sm text-muted-foreground">{company.properties.industry || 'No industry'}</p>
                            {company.properties.city && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {company.properties.city}, {company.properties.country}
                              </p>
                            )}
                          </div>
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fetch by ID */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Fetch by ID
              </CardTitle>
              <CardDescription>
                Enter a HubSpot Company ID or Contact ID to fetch details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter HubSpot ID..."
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleFetchById()}
                />
                <Button onClick={handleFetchById} disabled={isFetching}>
                  {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company Preview */}
        {selectedCompany && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{selectedCompany.properties.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    HubSpot ID: {selectedCompany.id}
                    {selectedCompany.properties.website && (
                      <a href={selectedCompany.properties.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Visit Website
                      </a>
                    )}
                  </CardDescription>
                </div>
                <Button onClick={handleImport} disabled={isImporting}>
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Import Company
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="font-semibold mb-3">Basic Information</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {selectedCompany.properties.industry && (
                    <div>
                      <p className="text-sm text-muted-foreground">Industry</p>
                      <p className="font-medium">{selectedCompany.properties.industry}</p>
                    </div>
                  )}
                  {selectedCompany.properties.type && (
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <Badge variant="outline">{selectedCompany.properties.type}</Badge>
                    </div>
                  )}
                  {selectedCompany.properties.phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedCompany.properties.phone}</p>
                    </div>
                  )}
                  {selectedCompany.properties.domain && (
                    <div>
                      <p className="text-sm text-muted-foreground">Domain</p>
                      <p className="font-medium">{selectedCompany.properties.domain}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Financial & Company Info */}
              <div>
                <h3 className="font-semibold mb-3">Company Details</h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {selectedCompany.properties.annualrevenue && (
                    <div>
                      <p className="text-sm text-muted-foreground">Annual Revenue</p>
                      <p className="font-medium">${parseInt(selectedCompany.properties.annualrevenue).toLocaleString()}</p>
                    </div>
                  )}
                  {selectedCompany.properties.numberofemployees && (
                    <div>
                      <p className="text-sm text-muted-foreground">Team Size</p>
                      <p className="font-medium">{selectedCompany.properties.numberofemployees} employees</p>
                    </div>
                  )}
                  {selectedCompany.properties.founded_year && (
                    <div>
                      <p className="text-sm text-muted-foreground">Founded</p>
                      <p className="font-medium">{selectedCompany.properties.founded_year}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Location */}
              {(selectedCompany.properties.city || selectedCompany.properties.state || selectedCompany.properties.country) && (
                <>
                  <div>
                    <h3 className="font-semibold mb-3">Location</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      {selectedCompany.properties.city && (
                        <div>
                          <p className="text-sm text-muted-foreground">City</p>
                          <p className="font-medium">{selectedCompany.properties.city}</p>
                        </div>
                      )}
                      {selectedCompany.properties.state && (
                        <div>
                          <p className="text-sm text-muted-foreground">State</p>
                          <p className="font-medium">{selectedCompany.properties.state}</p>
                        </div>
                      )}
                      {selectedCompany.properties.country && (
                        <div>
                          <p className="text-sm text-muted-foreground">Country</p>
                          <p className="font-medium">{selectedCompany.properties.country}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Description */}
              {selectedCompany.properties.description && (
                <div>
                  <h3 className="font-semibold mb-3">Description</h3>
                  <p className="text-sm text-muted-foreground">{selectedCompany.properties.description}</p>
                </div>
              )}

              {/* Contacts */}
              {contacts.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-3">Associated Contacts ({contacts.length})</h3>
                    <div className="space-y-2">
                      {contacts.slice(0, 5).map((contact) => (
                        <Card key={contact.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {contact.properties.firstname} {contact.properties.lastname}
                                </p>
                                {contact.properties.email && (
                                  <p className="text-sm text-muted-foreground">{contact.properties.email}</p>
                                )}
                                {contact.properties.jobtitle && (
                                  <p className="text-xs text-muted-foreground">{contact.properties.jobtitle}</p>
                                )}
                              </div>
                              {contact.properties.lifecyclestage && (
                                <Badge variant="secondary">{contact.properties.lifecyclestage}</Badge>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {contacts.length > 5 && (
                        <p className="text-sm text-muted-foreground text-center">
                          + {contacts.length - 5} more contacts will be imported
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
