import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PageData {
  path: string;
  views: number;
  uniqueVisitors?: number;
  avgDuration?: number;
  bounceRate?: number;
}

interface TopPagesTableProps {
  title: string;
  data: PageData[];
}

export const TopPagesTable = ({ title, data }: TopPagesTableProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No page data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Unique Visitors</TableHead>
              <TableHead className="text-right">Avg. Duration</TableHead>
              <TableHead className="text-right">Bounce Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((page, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{page.path}</TableCell>
                <TableCell className="text-right">{page.views.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {page.uniqueVisitors ? page.uniqueVisitors.toLocaleString() : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {page.avgDuration ? `${Math.floor(page.avgDuration / 60)}m ${page.avgDuration % 60}s` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {page.bounceRate ? `${page.bounceRate.toFixed(1)}%` : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
