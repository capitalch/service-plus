import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wrench, Package, Users, ClipboardList, Plus, Search, AlertTriangle, 
  CheckCircle, Clock, Settings, Bell, Menu, X, ChevronRight, 
  TrendingUp, DollarSign, FileText, BarChart3, User,
  Home, Inbox, Archive, Calendar, Phone
} from 'lucide-react';

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [repairJobs, setRepairJobs] = useState([]);
  const [spareParts, setSpareParts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [isJobDialogOpen, setIsJobDialogOpen] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const jobsData = await window.storage.get('repair-jobs-v2');
        const partsData = await window.storage.get('spare-parts-v2');
        const customersData = await window.storage.get('customers-v2');

        if (jobsData) setRepairJobs(JSON.parse(jobsData.value));
        if (partsData) setSpareParts(JSON.parse(partsData.value));
        if (customersData) setCustomers(JSON.parse(customersData.value));
      } catch (error) {
        initializeSampleData();
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      window.storage.set('repair-jobs-v2', JSON.stringify(repairJobs));
      window.storage.set('spare-parts-v2', JSON.stringify(spareParts));
      window.storage.set('customers-v2', JSON.stringify(customers));
    }
  }, [repairJobs, spareParts, customers, isLoading]);

  const initializeSampleData = () => {
    const sampleParts = [
      { id: '1', name: 'CT-S200 Power Adapter', category: 'Power Supply', stockLevel: 5, minStock: 3, price: 850, location: 'Shelf A1' },
      { id: '2', name: 'Synthesizer Key White', category: 'Keys', stockLevel: 20, minStock: 10, price: 150, location: 'Drawer B2' },
      { id: '3', name: 'LCD Display Module', category: 'Display', stockLevel: 2, minStock: 5, price: 1200, location: 'Cabinet C1' },
      { id: '4', name: 'Calculator Battery CR2032', category: 'Battery', stockLevel: 50, minStock: 20, price: 30, location: 'Drawer D1' },
      { id: '5', name: 'Keyboard Ribbon Cable', category: 'Cable', stockLevel: 8, minStock: 5, price: 200, location: 'Shelf A2' },
    ];

    const sampleCustomers = [
      { id: '1', name: 'Rahul Sharma', phone: '9876543210', email: 'rahul@email.com', address: 'Mumbai, MH', repairHistory: [] },
      { id: '2', name: 'Priya Patel', phone: '9123456789', email: 'priya@email.com', address: 'Delhi, DL', repairHistory: [] },
      { id: '3', name: 'Amit Kumar', phone: '9988776655', email: 'amit@email.com', address: 'Bangalore, KA', repairHistory: [] },
    ];

    const sampleJobs = [
      {
        id: '1',
        jobNumber: 'REP-001',
        customerId: '1',
        customerName: 'Rahul Sharma',
        customerPhone: '9876543210',
        deviceType: 'Synthesizer',
        deviceModel: 'Casio CT-S200',
        serialNumber: 'CTS200-12345',
        reportedIssue: 'No power, adapter issue suspected',
        status: 'in-progress',
        priority: 'high',
        assignedTo: 'Technician A',
        partsUsed: [{ partId: '1', quantity: 1, partName: 'CT-S200 Power Adapter', price: 850 }],
        laborCharge: 500,
        estimatedCompletion: '2026-01-30',
        notes: 'Power adapter confirmed faulty. Replacement ordered.',
        createdAt: '2026-01-25',
        updatedAt: '2026-01-27',
      },
      {
        id: '2',
        jobNumber: 'REP-002',
        customerId: '2',
        customerName: 'Priya Patel',
        customerPhone: '9123456789',
        deviceType: 'Calculator',
        deviceModel: 'Casio FX-991EX',
        serialNumber: 'FX991-67890',
        reportedIssue: 'Display not working',
        status: 'diagnosed',
        priority: 'medium',
        assignedTo: 'Technician B',
        partsUsed: [],
        laborCharge: 300,
        estimatedCompletion: '2026-02-01',
        notes: 'LCD needs replacement',
        createdAt: '2026-01-26',
        updatedAt: '2026-01-27',
      },
      {
        id: '3',
        jobNumber: 'REP-003',
        customerId: '3',
        customerName: 'Amit Kumar',
        customerPhone: '9988776655',
        deviceType: 'Keyboard',
        deviceModel: 'Casio CT-X700',
        serialNumber: 'CTX700-11111',
        reportedIssue: 'Several keys not responding',
        status: 'received',
        priority: 'urgent',
        assignedTo: 'Technician A',
        partsUsed: [],
        laborCharge: 0,
        estimatedCompletion: '2026-01-29',
        notes: '',
        createdAt: '2026-01-28',
        updatedAt: '2026-01-28',
      },
      {
        id: '4',
        jobNumber: 'REP-004',
        customerId: '1',
        customerName: 'Rahul Sharma',
        customerPhone: '9876543210',
        deviceType: 'Synthesizer',
        deviceModel: 'Casio LK-S250',
        serialNumber: 'LKS250-22222',
        reportedIssue: 'Sound distortion',
        status: 'completed',
        priority: 'low',
        assignedTo: 'Technician B',
        partsUsed: [],
        laborCharge: 400,
        estimatedCompletion: '2026-01-28',
        notes: 'Cleaned internal components, sound issue resolved',
        createdAt: '2026-01-24',
        updatedAt: '2026-01-28',
      },
    ];

    setSpareParts(sampleParts);
    setCustomers(sampleCustomers);
    setRepairJobs(sampleJobs);
  };

  const menuItems = [
    { id: 'dashboard', icon: Home, label: 'Dashboard', section: 'main' },
    { id: 'jobs', icon: Wrench, label: 'Repair Jobs', section: 'operations', badge: repairJobs.filter(j => j.status !== 'delivered').length },
    { id: 'intake', icon: Inbox, label: 'Job Intake', section: 'operations' },
    { id: 'queue', icon: ClipboardList, label: 'Job Queue', section: 'operations' },
    { id: 'completed', icon: Archive, label: 'Completed Jobs', section: 'operations' },
    { id: 'parts', icon: Package, label: 'Spare Parts', section: 'inventory', badge: spareParts.filter(p => p.stockLevel <= p.minStock).length },
    { id: 'goods', icon: FileText, label: 'Goods in Trust', section: 'inventory' },
    { id: 'customers', icon: Users, label: 'Customers', section: 'customers' },
    { id: 'portal', icon: User, label: 'Customer Portal', section: 'customers' },
    { id: 'invoices', icon: DollarSign, label: 'Invoicing', section: 'financial' },
    { id: 'reports', icon: BarChart3, label: 'Reports', section: 'financial' },
  ];

  const stats = {
    activeRepairs: repairJobs.filter(j => !['delivered', 'completed'].includes(j.status)).length,
    pendingDiagnosis: repairJobs.filter(j => j.status === 'received').length,
    completedToday: repairJobs.filter(j => j.status === 'completed' && j.updatedAt === new Date().toISOString().split('T')[0]).length,
    lowStockItems: spareParts.filter(p => p.stockLevel <= p.minStock).length,
    revenue: repairJobs
      .filter(j => j.status === 'completed' || j.status === 'delivered')
      .reduce((sum, j) => sum + j.laborCharge + j.partsUsed.reduce((psum, p) => psum + p.price * p.quantity, 0), 0),
  };

  const getStatusColor = (status) => {
    const colors = {
      received: 'bg-blue-500',
      diagnosed: 'bg-purple-500',
      'in-progress': 'bg-yellow-500',
      completed: 'bg-green-500',
      delivered: 'bg-gray-400',
    };
    return colors[status];
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    return colors[priority];
  };

  const DashboardView = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold mb-1">Dashboard</h2>
        <p className="text-gray-500">Welcome back! Here is your shop overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Repairs</p>
                <p className="text-3xl font-bold mt-2">{stats.activeRepairs}</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12% from last week
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Wrench className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Diagnosis</p>
                <p className="text-3xl font-bold mt-2">{stats.pendingDiagnosis}</p>
                <p className="text-xs text-gray-500 mt-1">Needs attention</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Revenue MTD</p>
                <p className="text-3xl font-bold mt-2">₹{(stats.revenue / 1000).toFixed(1)}K</p>
                <p className="text-xs text-green-600 mt-1 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +8% from last month
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Low Stock Alerts</p>
                <p className="text-3xl font-bold mt-2">{stats.lowStockItems}</p>
                <p className="text-xs text-orange-600 mt-1">Requires reorder</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {stats.lowStockItems > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            {stats.lowStockItems} spare parts are running low on stock. Review inventory to avoid delays.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates on repair jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {repairJobs.slice(0, 5).map(job => (
                <div key={job.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors" onClick={() => {
                  setSelectedJob(job);
                  setIsJobDialogOpen(true);
                }}>
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${getStatusColor(job.status)} text-white flex-shrink-0`}>
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{job.jobNumber}</span>
                      <Badge className={getPriorityColor(job.priority)} variant="secondary">{job.priority}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{job.deviceModel} - {job.customerName}</p>
                    <p className="text-xs text-gray-400 mt-1">Updated {job.updatedAt}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repair Status Overview</CardTitle>
            <CardDescription>Jobs by status category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['received', 'diagnosed', 'in-progress', 'completed', 'delivered'].map(status => {
                const count = repairJobs.filter(j => j.status === status).length;
                const percentage = repairJobs.length > 0 ? (count / repairJobs.length) * 100 : 0;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize font-medium">{status.replace('-', ' ')}</span>
                      <span className="text-gray-500">{count} jobs</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${getStatusColor(status)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const KanbanView = () => {
    const statusColumns = ['received', 'diagnosed', 'in-progress', 'completed', 'delivered'];

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Repair Jobs</h2>
            <p className="text-gray-500">Manage all repair jobs in one place</p>
          </div>
          <Button onClick={() => setActiveView('intake')}>
            <Plus className="h-4 w-4 mr-2" />
            New Job
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-4 pb-4">
          {statusColumns.map(status => (
            <div key={status} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold capitalize flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${getStatusColor(status)}`} />
                  {status.replace('-', ' ')}
                </h3>
                <Badge variant="secondary">{repairJobs.filter(j => j.status === status).length}</Badge>
              </div>

              <div className="space-y-3">
                {repairJobs
                  .filter(job => job.status === status)
                  .map(job => (
                    <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                      setSelectedJob(job);
                      setIsJobDialogOpen(true);
                    }}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-semibold text-sm">{job.jobNumber}</span>
                          <Badge className={getPriorityColor(job.priority)} variant="secondary">{job.priority}</Badge>
                        </div>
                        <p className="text-sm font-medium text-gray-700 mb-1">{job.deviceModel}</p>
                        <p className="text-xs text-gray-500 mb-2">{job.customerName}</p>
                        <p className="text-xs text-gray-400 truncate mb-3">{job.reportedIssue}</p>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            {job.estimatedCompletion}
                          </span>
                          <span className="text-gray-500">{job.assignedTo}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const JobIntakeView = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deviceType: '',
      deviceModel: '',
      serialNumber: '',
      reportedIssue: '',
      priority: 'medium',
      assignedTo: '',
      estimatedCompletion: '',
    });

    const handleSubmit = () => {
      const newJob = {
        id: Date.now().toString(),
        jobNumber: `REP-${String(repairJobs.length + 1).padStart(3, '0')}`,
        customerId: Date.now().toString(),
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        deviceType: formData.deviceType,
        deviceModel: formData.deviceModel,
        serialNumber: formData.serialNumber,
        reportedIssue: formData.reportedIssue,
        status: 'received',
        priority: formData.priority,
        assignedTo: formData.assignedTo,
        partsUsed: [],
        laborCharge: 0,
        estimatedCompletion: formData.estimatedCompletion,
        notes: '',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
      };

      setRepairJobs([newJob, ...repairJobs]);
      setActiveView('jobs');
      setFormData({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        deviceType: '',
        deviceModel: '',
        serialNumber: '',
        reportedIssue: '',
        priority: 'medium',
        assignedTo: '',
        estimatedCompletion: '',
      });
      setStep(1);
    };

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold">New Repair Job</h2>
          <p className="text-gray-500">Create a new repair job</p>
        </div>

        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map(s => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center h-10 w-10 rounded-full ${step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'} font-semibold`}>
                {s}
              </div>
              {s < 3 && <div className={`h-1 w-20 mx-2 ${step > s ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      placeholder="10-digit mobile number"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    placeholder="customer@email.com"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Device Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Device Type</Label>
                    <Select value={formData.deviceType} onValueChange={(value) => setFormData({ ...formData, deviceType: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Synthesizer">Synthesizer</SelectItem>
                        <SelectItem value="Calculator">Calculator</SelectItem>
                        <SelectItem value="Keyboard">Keyboard</SelectItem>
                        <SelectItem value="Piano">Digital Piano</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Device Model</Label>
                    <Input
                      value={formData.deviceModel}
                      onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
                      placeholder="e.g., Casio CT-S200"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Serial Number</Label>
                  <Input
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="Device serial number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reported Issue</Label>
                  <Textarea
                    value={formData.reportedIssue}
                    onChange={(e) => setFormData({ ...formData, reportedIssue: e.target.value })}
                    placeholder="Describe the problem..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold mb-4">Job Assignment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority Level</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign To</Label>
                    <Input
                      value={formData.assignedTo}
                      onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                      placeholder="Technician name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Estimated Completion Date</Label>
                  <Input
                    type="date"
                    value={formData.estimatedCompletion}
                    onChange={(e) => setFormData({ ...formData, estimatedCompletion: e.target.value })}
                  />
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <h4 className="font-semibold mb-3">Job Summary</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-gray-600">Customer:</span> {formData.customerName}</div>
                    <div><span className="text-gray-600">Phone:</span> {formData.customerPhone}</div>
                    <div><span className="text-gray-600">Device:</span> {formData.deviceType}</div>
                    <div><span className="text-gray-600">Model:</span> {formData.deviceModel}</div>
                    <div><span className="text-gray-600">Priority:</span> <Badge className={getPriorityColor(formData.priority)}>{formData.priority}</Badge></div>
                    <div><span className="text-gray-600">Assigned:</span> {formData.assignedTo}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-6">
              <Button
                variant="outline"
                onClick={() => step > 1 ? setStep(step - 1) : setActiveView('dashboard')}
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </Button>
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit}>
                  Create Job
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const SparePartsView = () => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [filter, setFilter] = useState('all');
    const [newPart, setNewPart] = useState({
      name: '',
      category: '',
      stockLevel: 0,
      minStock: 0,
      price: 0,
      location: '',
    });

    const handleAddPart = () => {
      const part = {
        id: Date.now().toString(),
        ...newPart,
      };
      setSpareParts([...spareParts, part]);
      setIsDialogOpen(false);
      setNewPart({ name: '', category: '', stockLevel: 0, minStock: 0, price: 0, location: '' });
    };

    const updateStock = (partId, change) => {
      setSpareParts(spareParts.map(part =>
        part.id === partId ? { ...part, stockLevel: Math.max(0, part.stockLevel + change) } : part
      ));
    };

    const filteredParts = filter === 'low-stock'
      ? spareParts.filter(p => p.stockLevel <= p.minStock)
      : spareParts;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold">Spare Parts Inventory</h2>
            <p className="text-gray-500">Manage stock levels and pricing</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Part
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Spare Part</DialogTitle>
                <DialogDescription>Enter details for the new inventory item</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Part Name</Label>
                  <Input value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={newPart.category} onChange={(e) => setNewPart({ ...newPart, category: e.target.value })} placeholder="e.g., Power Supply, Keys" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Initial Stock</Label>
                    <Input type="number" value={newPart.stockLevel} onChange={(e) => setNewPart({ ...newPart, stockLevel: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Stock Alert</Label>
                    <Input type="number" value={newPart.minStock} onChange={(e) => setNewPart({ ...newPart, minStock: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input type="number" value={newPart.price} onChange={(e) => setNewPart({ ...newPart, price: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Storage Location</Label>
                  <Input value={newPart.location} onChange={(e) => setNewPart({ ...newPart, location: e.target.value })} placeholder="e.g., Shelf A1" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddPart}>Add Part</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All Parts
          </Button>
          <Button
            variant={filter === 'low-stock' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('low-stock')}
          >
            <AlertTriangle className="h-4 w-4 mr-1" />
            Low Stock
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredParts.map(part => (
            <Card key={part.id} className={`hover:shadow-lg transition-shadow ${part.stockLevel <= part.minStock ? 'border-orange-300' : ''}`}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{part.name}</h3>
                    <p className="text-sm text-gray-500">{part.category}</p>
                    <p className="text-sm text-gray-500 mt-1">{part.location}</p>
                  </div>
                  {part.stockLevel <= part.minStock && (
                    <Badge className="bg-orange-100 text-orange-800">Low</Badge>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-600">Stock Level</span>
                    <span className="text-sm text-gray-600">Min: {part.minStock}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold">{part.stockLevel}</div>
                    <div className="flex-1">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${part.stockLevel <= part.minStock ? 'bg-orange-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min((part.stockLevel / (part.minStock * 2)) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">Price</span>
                  <span className="text-lg font-bold text-green-600">₹{part.price}</span>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStock(part.id, -1)}>
                    -1
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStock(part.id, 1)}>
                    +1
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => updateStock(part.id, 10)}>
                    +10
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const CustomerPortalView = () => {
    const [jobId, setJobId] = useState('');
    const [foundJob, setFoundJob] = useState(null);

    const searchJob = () => {
      const job = repairJobs.find(j => j.jobNumber.toLowerCase() === jobId.toLowerCase());
      setFoundJob(job || null);
    };

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2">Track Your Repair</h2>
          <p className="text-gray-500">Enter your job number to check the status</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2 mb-6">
              <Input
                placeholder="Enter Job Number (e.g., REP-001)"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchJob()}
                className="text-lg"
              />
              <Button onClick={searchJob} size="lg">
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>

            {foundJob && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">{foundJob.jobNumber}</h3>
                      <p className="text-gray-600">{foundJob.deviceType} - {foundJob.deviceModel}</p>
                    </div>
                    <Badge className={getPriorityColor(foundJob.priority)} variant="secondary">
                      {foundJob.priority} priority
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Customer</p>
                      <p className="font-medium">{foundJob.customerName}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p className="font-medium">{foundJob.customerPhone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Technician</p>
                      <p className="font-medium">{foundJob.assignedTo}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Est. Completion</p>
                      <p className="font-medium">{foundJob.estimatedCompletion}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Reported Issue</h4>
                  <p className="text-gray-600">{foundJob.reportedIssue}</p>
                </div>

                {foundJob.notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Technician Notes</h4>
                    <p className="text-gray-600">{foundJob.notes}</p>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-4">Repair Progress</h4>
                  <div className="relative">
                    <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200" />
                    <div className="relative flex justify-between">
                      {['received', 'diagnosed', 'in-progress', 'completed', 'delivered'].map((status, idx) => {
                        const isActive = ['received', 'diagnosed', 'in-progress', 'completed', 'delivered'].indexOf(foundJob.status) >= idx;
                        const isCurrent = foundJob.status === status;
                        return (
                          <div key={status} className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-4 border-white z-10 ${
                              isActive ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
                            } ${isCurrent ? 'ring-4 ring-green-200' : ''}`}>
                              {isActive ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                            </div>
                            <div className={`text-xs mt-2 font-medium capitalize ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                              {status.replace('-', ' ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {foundJob.status === 'completed' && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Your device is ready for pickup! Please contact us or visit the shop.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {jobId && !foundJob && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  No job found with this number. Please check and try again.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const JobDetailDialog = () => {
    if (!selectedJob) return null;

    const updateJobStatus = (newStatus) => {
      setRepairJobs(repairJobs.map(job =>
        job.id === selectedJob.id ? { ...job, status: newStatus, updatedAt: new Date().toISOString().split('T')[0] } : job
      ));
      setSelectedJob({ ...selectedJob, status: newStatus });
    };

    return (
      <Dialog open={isJobDialogOpen} onOpenChange={setIsJobDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl">{selectedJob.jobNumber}</DialogTitle>
              <Badge className={getPriorityColor(selectedJob.priority)}>{selectedJob.priority}</Badge>
            </div>
            <DialogDescription>
              Created on {selectedJob.createdAt}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <Label className="text-sm font-semibold">Status</Label>
              <Select value={selectedJob.status} onValueChange={(value) => updateJobStatus(value)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="diagnosed">Diagnosed</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold">Customer</Label>
                <p className="mt-1">{selectedJob.customerName}</p>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <Phone className="h-3 w-3 mr-1" />
                  {selectedJob.customerPhone}
                </p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Assigned To</Label>
                <p className="mt-1">{selectedJob.assignedTo}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Device Information</Label>
              <div className="mt-2 bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Type:</span> {selectedJob.deviceType}</div>
                  <div><span className="text-gray-500">Model:</span> {selectedJob.deviceModel}</div>
                  <div className="col-span-2"><span className="text-gray-500">Serial:</span> {selectedJob.serialNumber}</div>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">Reported Issue</Label>
              <p className="mt-2 text-sm text-gray-700">{selectedJob.reportedIssue}</p>
            </div>

            {selectedJob.notes && (
              <div>
                <Label className="text-sm font-semibold">Technician Notes</Label>
                <p className="mt-2 text-sm text-gray-700">{selectedJob.notes}</p>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold">Parts Used</Label>
              {selectedJob.partsUsed.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {selectedJob.partsUsed.map((part, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                      <span className="text-sm">{part.partName}</span>
                      <span className="text-sm font-medium">Qty: {part.quantity} × ₹{part.price}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-2">No parts used yet</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold">Labor Charge</Label>
                <p className="mt-1 text-lg font-bold text-green-600">₹{selectedJob.laborCharge}</p>
              </div>
              <div>
                <Label className="text-sm font-semibold">Est. Completion</Label>
                <p className="mt-1 flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                  {selectedJob.estimatedCompletion}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsJobDialogOpen(false)}>Close</Button>
            <Button>Print Invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'jobs':
      case 'queue':
        return <KanbanView />;
      case 'intake':
        return <JobIntakeView />;
      case 'parts':
        return <SparePartsView />;
      case 'portal':
        return <CustomerPortalView />;
      default:
        return <DashboardView />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Wrench className="h-16 w-16 mx-auto mb-4 text-blue-600 animate-spin" />
          <div className="text-xl font-semibold">Loading Workshop Manager...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Wrench className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Workshop</h1>
                <p className="text-xs text-gray-500">Manager Pro</p>
              </div>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  activeView === item.id
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && (
                  <>
                    <span className="flex-1 text-left text-sm">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge variant="secondary" className="ml-auto">{item.badge}</Badge>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors">
            <Settings className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm">Settings</span>}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Search jobs, customers, parts..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
              </Button>
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                A
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {renderView()}
        </div>
      </div>

      <JobDetailDialog />
    </div>
  );
};

export default App;