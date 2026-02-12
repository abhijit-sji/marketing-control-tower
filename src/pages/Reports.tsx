import { Calendar, Download, Filter, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const monthlyData = [
  { month: 'Jan', social: 120, website: 80, paid: 65 },
  { month: 'Feb', social: 150, website: 95, paid: 75 },
  { month: 'Mar', social: 180, website: 110, paid: 85 },
  { month: 'Apr', social: 165, website: 125, paid: 90 },
  { month: 'May', social: 200, website: 140, paid: 95 },
  { month: 'Jun', social: 220, website: 155, paid: 105 },
];

const channelData = [
  { name: 'Social Media', value: 45, color: 'hsl(var(--primary))' },
  { name: 'Website', value: 30, color: 'hsl(var(--accent))' },
  { name: 'Paid Ads', value: 20, color: 'hsl(var(--success))' },
  { name: 'Email', value: 5, color: 'hsl(var(--warning))' },
];

export default function Reports() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Marketing Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and performance insights
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Select defaultValue="last-30-days">
            <SelectTrigger className="w-40">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last-7-days">Last 7 days</SelectItem>
              <SelectItem value="last-30-days">Last 30 days</SelectItem>
              <SelectItem value="last-90-days">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
          
          <Button className="bg-gradient-primary">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <span className="text-sm font-medium text-muted-foreground">Total ROI</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">4.2x</div>
              <div className="text-xs text-success">+18% vs last month</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Total Leads</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">1,247</div>
              <div className="text-xs text-success">+25% vs last month</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium text-muted-foreground">Conversion Rate</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">3.8%</div>
              <div className="text-xs text-success">+12% vs last month</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-warning" />
              <span className="text-sm font-medium text-muted-foreground">Cost Per Lead</span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-foreground">$28</div>
              <div className="text-xs text-success">-15% vs last month</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Channel Performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Channel Performance Trends</CardTitle>
            <p className="text-sm text-muted-foreground">
              Monthly lead generation by channel
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    className="text-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  />
                  <Bar dataKey="social" fill="hsl(var(--primary))" name="Social" radius={4} />
                  <Bar dataKey="website" fill="hsl(var(--accent))" name="Website" radius={4} />
                  <Bar dataKey="paid" fill="hsl(var(--success))" name="Paid Ads" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lead Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Sources</CardTitle>
            <p className="text-sm text-muted-foreground">
              Distribution by channel
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-lg)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {channelData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <p className="text-sm text-muted-foreground">
            Auto-generated insights and summaries
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                title: "Weekly Performance Summary",
                date: "Jan 21, 2024",
                status: "Generated",
                highlights: ["25% increase in social engagement", "Website conversions up 18%"]
              },
              {
                title: "Campaign ROI Analysis",
                date: "Jan 20, 2024", 
                status: "Generated",
                highlights: ["LinkedIn campaigns performing 35% above target", "CPC reduced by 12%"]
              },
              {
                title: "Competitor Analysis Report",
                date: "Jan 19, 2024",
                status: "In Progress",
                highlights: ["Analyzing 5 key competitors", "Social media gap analysis"]
              }
            ].map((report, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 border border-border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">{report.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{report.date}</p>
                  <div className="mt-2 space-y-1">
                    {report.highlights.map((highlight, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">• {highlight}</p>
                    ))}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    report.status === 'Generated' 
                      ? 'bg-success-light text-success' 
                      : 'bg-warning-light text-warning'
                  }`}>
                    {report.status}
                  </span>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}