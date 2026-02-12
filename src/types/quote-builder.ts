// ================================================
// QUOTE BUILDER MODULE - TypeScript Types
// ================================================

// ================================================
// Database Types
// ================================================

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  requirements_html: string | null;
  base_price: number;
  effort_hours: number;
  is_active: boolean;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  category?: ServiceCategory;
}

export type BillingType = 'one_time' | 'hourly' | 'monthly';
export type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'archived';
export type WizardStep = 'create' | 'build' | 'requirements';

export interface Estimate {
  id: string;
  client_name: string | null;
  project_name: string;
  billing_type: BillingType;
  status: EstimateStatus;
  total_hours: number;
  total_price: number;
  notes: string | null;
  is_template: boolean;
  template_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  items?: EstimateItem[];
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  service_id: string | null;
  service_name: string;
  base_price: number;
  effort_hours: number;
  quantity: number;
  final_price: number;
  requirements_html: string | null;
  sort_order: number;
  created_at: string;
}

// ================================================
// Form Types
// ================================================

export interface ServiceCategoryFormData {
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active: boolean;
}

export interface ServiceFormData {
  category_id: string | null;
  name: string;
  slug: string;
  description: string;
  requirements_html: string;
  base_price: number;
  effort_hours: number;
  is_active: boolean;
  sort_order: number;
}

export interface EstimateFormData {
  client_name: string;
  project_name: string;
  billing_type: BillingType;
  notes: string;
  is_template: boolean;
  template_name: string;
}

export interface EstimateItemFormData {
  service_id: string | null;
  service_name: string;
  base_price: number;
  effort_hours: number;
  quantity: number;
  final_price: number;
  requirements_html: string;
}

// ================================================
// Package Builder Context Types
// ================================================

export interface PackageItem extends Omit<EstimateItem, 'id' | 'estimate_id' | 'created_at'> {
  temp_id: string; // Client-side temporary ID for React keys
}

export interface PackageBuilderState {
  currentStep: WizardStep;
  client_name: string;
  project_name: string;
  billing_type: BillingType;
  notes: string;
  items: PackageItem[];
}

export interface PackageBuilderContextValue {
  state: PackageBuilderState;
  // Wizard step management
  setStep: (step: WizardStep) => void;
  goNextStep: () => void;
  goPrevStep: () => void;
  canProceedToStep: (step: WizardStep) => boolean;
  // Item management
  addItem: (service: Service) => void;
  removeItem: (tempId: string) => void;
  updateItemQuantity: (tempId: string, quantity: number) => void;
  updateItemPrice: (tempId: string, price: number) => void;
  updateItemHours: (tempId: string, hours: number) => void;
  reorderItems: (items: PackageItem[]) => void;
  clearItems: () => void;
  // Estimate metadata
  setClientName: (name: string) => void;
  setProjectName: (name: string) => void;
  setBillingType: (type: BillingType) => void;
  setNotes: (notes: string) => void;
  // Computed values
  totalHours: number;
  totalPrice: number;
  itemCount: number;
  // Actions
  resetBuilder: () => void;
  loadFromEstimate: (estimate: Estimate) => void;
  loadFromTemplate: (template: Estimate) => void;
}

// ================================================
// API Response Types
// ================================================

export interface ServiceWithCategory extends Service {
  category: ServiceCategory | null;
}

export interface EstimateWithItems extends Estimate {
  items: EstimateItem[];
}

// ================================================
// Component Props Types
// ================================================

export interface ServiceCatalogPanelProps {
  onServiceSelect: (service: Service) => void;
  selectedServiceIds?: string[];
}

export interface ServiceCardProps {
  service: Service;
  onAdd: (service: Service) => void;
  isAdded?: boolean;
}

export interface PackageItemRowProps {
  item: PackageItem;
  index: number;
  onQuantityChange: (tempId: string, quantity: number) => void;
  onPriceChange: (tempId: string, price: number) => void;
  onRemove: (tempId: string) => void;
}

export interface StickyTotalsBarProps {
  totalHours: number;
  totalPrice: number;
  itemCount: number;
  billingType: BillingType;
  onSave: () => void;
  onViewRequirements: () => void;
  isSaving?: boolean;
}

export interface RequirementsViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PackageItem[];
}

// ================================================
// Filter & Search Types
// ================================================

export interface ServiceFilterOptions {
  categoryId: string | null;
  searchQuery: string;
  showInactive: boolean;
}

export interface EstimateFilterOptions {
  status: EstimateStatus | 'all';
  isTemplate: boolean | null;
  searchQuery: string;
}

// ================================================
// Statistics Types
// ================================================

export interface QuoteBuilderStats {
  total_estimates: number;
  draft_estimates: number;
  sent_estimates: number;
  approved_estimates: number;
  total_revenue: number;
  average_estimate_value: number;
}
