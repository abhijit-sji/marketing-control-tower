import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useUsers } from '@/hooks/useUsers';

interface ParsedRow {
  serial_number: number;
  type_of_work: string;
  responsibilities: string;
}

export function AccountabilityChartImporter() {
  const { toast } = useToast();
  const { data: users = [] } = useUsers();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const rows: ParsedRow[] = [];
    
    // Skip first line if it's a header with employee name
    let startIndex = 0;
    if (lines[0] && !lines[0].includes('Sr. No.')) {
      startIndex = 1;
    }
    
    // Find header row
    let headerIndex = startIndex;
    for (let i = startIndex; i < lines.length; i++) {
      if (lines[i].includes('Sr. No.') || lines[i].includes('Type of work')) {
        headerIndex = i;
        break;
      }
    }
    
    // Parse data rows
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV with respect to quoted fields
      const fields: string[] = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());
      
      // Ensure we have at least 3 fields
      while (fields.length < 3) {
        fields.push('');
      }
      
      const [serialStr, typeOfWork, responsibilities] = fields;
      const serialNumber = parseInt(serialStr);
      
      // Skip invalid rows
      if (isNaN(serialNumber) || !typeOfWork || typeOfWork.trim() === '') {
        continue;
      }
      
      rows.push({
        serial_number: serialNumber,
        type_of_work: typeOfWork.trim(),
        responsibilities: responsibilities.trim(),
      });
    }
    
    return rows;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: 'Invalid File',
        description: 'Please select a CSV file',
        variant: 'destructive',
      });
      return;
    }
    
    setFile(selectedFile);
    setImportComplete(false);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = parseCSV(text);
        setParsedData(parsed);
        
        if (parsed.length === 0) {
          toast({
            title: 'No Data Found',
            description: 'The CSV file appears to be empty or incorrectly formatted',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'File Parsed',
            description: `Found ${parsed.length} accountability items`,
          });
        }
      } catch (error) {
        toast({
          title: 'Parse Error',
          description: 'Failed to parse CSV file. Please check the format.',
          variant: 'destructive',
        });
        console.error('CSV parse error:', error);
      }
    };
    
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!selectedUserId) {
      toast({
        title: 'User Required',
        description: 'Please select a user to import data for',
        variant: 'destructive',
      });
      return;
    }
    
    if (parsedData.length === 0) {
      toast({
        title: 'No Data',
        description: 'Please upload a CSV file first',
        variant: 'destructive',
      });
      return;
    }
    
    setIsImporting(true);
    
    try {
      // First, delete existing accountability data for this user
      const { error: deleteError } = await supabase
        .from('user_accountability_chart')
        .delete()
        .eq('user_id', selectedUserId);
      
      if (deleteError) throw deleteError;
      
      // Insert new data
      const insertData = parsedData.map(row => ({
        user_id: selectedUserId,
        serial_number: row.serial_number,
        type_of_work: row.type_of_work,
        responsibilities: row.responsibilities,
      }));
      
      const { error: insertError } = await supabase
        .from('user_accountability_chart')
        .insert(insertData);
      
      if (insertError) throw insertError;
      
      setImportComplete(true);
      toast({
        title: 'Import Successful',
        description: `Successfully imported ${parsedData.length} accountability items`,
      });
      
      // Reset form
      setTimeout(() => {
        setFile(null);
        setParsedData([]);
        setSelectedUserId('');
        setImportComplete(false);
      }, 3000);
      
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import accountability data',
        variant: 'destructive',
      });
      console.error('Import error:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setParsedData([]);
    setSelectedUserId('');
    setImportComplete(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import Accountability Chart from CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file to bulk import accountability data. The CSV should have columns: Sr. No., Type of work, Responsibilities
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {importComplete ? (
          <Alert className="border-green-500 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Accountability data imported successfully!
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="user-select">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="user-select">
                  <SelectValue placeholder="Choose a user to import data for" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={!selectedUserId}
                />
                {file && (
                  <Button variant="ghost" size="sm" onClick={handleClear}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {!selectedUserId && (
                <p className="text-sm text-muted-foreground">
                  Please select a user first
                </p>
              )}
            </div>

            {/* Preview Table */}
            {parsedData.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Preview ({parsedData.length} items)</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleClear} disabled={isImporting}>
                      Cancel
                    </Button>
                    <Button onClick={handleImport} disabled={isImporting}>
                      {isImporting ? 'Importing...' : `Import ${parsedData.length} Items`}
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-md max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">Sr. No.</TableHead>
                        <TableHead className="w-[250px]">Type of Work</TableHead>
                        <TableHead>Responsibilities</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{row.serial_number}</TableCell>
                          <TableCell>{row.type_of_work}</TableCell>
                          <TableCell className="whitespace-pre-wrap">{row.responsibilities}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Instructions */}
            {parsedData.length === 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">CSV Format Requirements:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      <li>First row can contain employee name (optional)</li>
                      <li>Header row: Sr. No., Type of work, Responsibilities</li>
                      <li>Data rows with serial numbers, work types, and responsibilities</li>
                      <li>Responsibilities can contain multiple lines</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
