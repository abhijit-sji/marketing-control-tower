import { createContext, useContext, useReducer, useCallback, useMemo, ReactNode } from "react";
import type {
  PackageItem,
  PackageBuilderState,
  PackageBuilderContextValue,
  BillingType,
  WizardStep,
  Service,
  Estimate,
  EstimateItem,
} from "@/types/quote-builder";

// Generate unique ID for items
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Wizard step order for navigation
const STEP_ORDER: WizardStep[] = ['create', 'build', 'requirements'];

// Initial state
const initialState: PackageBuilderState = {
  currentStep: "create",
  client_name: "",
  project_name: "",
  billing_type: "one_time",
  notes: "",
  items: [],
};

// Action types
type Action =
  | { type: "SET_STEP"; payload: WizardStep }
  | { type: "GO_NEXT_STEP" }
  | { type: "GO_PREV_STEP" }
  | { type: "SET_CLIENT_NAME"; payload: string }
  | { type: "SET_PROJECT_NAME"; payload: string }
  | { type: "SET_BILLING_TYPE"; payload: BillingType }
  | { type: "SET_NOTES"; payload: string }
  | { type: "ADD_ITEM"; payload: PackageItem }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "UPDATE_ITEM_QUANTITY"; payload: { tempId: string; quantity: number } }
  | { type: "UPDATE_ITEM_PRICE"; payload: { tempId: string; price: number } }
  | { type: "UPDATE_ITEM_HOURS"; payload: { tempId: string; hours: number } }
  | { type: "REORDER_ITEMS"; payload: PackageItem[] }
  | { type: "CLEAR_ITEMS" }
  | { type: "RESET" }
  | { type: "LOAD_STATE"; payload: PackageBuilderState };

// Reducer
function packageBuilderReducer(state: PackageBuilderState, action: Action): PackageBuilderState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.payload };

    case "GO_NEXT_STEP": {
      const currentIndex = STEP_ORDER.indexOf(state.currentStep);
      const nextIndex = Math.min(currentIndex + 1, STEP_ORDER.length - 1);
      return { ...state, currentStep: STEP_ORDER[nextIndex] };
    }

    case "GO_PREV_STEP": {
      const currentIndex = STEP_ORDER.indexOf(state.currentStep);
      const prevIndex = Math.max(currentIndex - 1, 0);
      return { ...state, currentStep: STEP_ORDER[prevIndex] };
    }

    case "SET_CLIENT_NAME":
      return { ...state, client_name: action.payload };

    case "SET_PROJECT_NAME":
      return { ...state, project_name: action.payload };

    case "SET_BILLING_TYPE":
      return { ...state, billing_type: action.payload };

    case "SET_NOTES":
      return { ...state, notes: action.payload };

    case "ADD_ITEM":
      return { ...state, items: [...state.items, action.payload] };

    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter((item) => item.temp_id !== action.payload),
      };

    case "UPDATE_ITEM_QUANTITY":
      return {
        ...state,
        items: state.items.map((item) =>
          item.temp_id === action.payload.tempId
            ? { ...item, quantity: Math.max(1, action.payload.quantity) }
            : item
        ),
      };

    case "UPDATE_ITEM_PRICE":
      return {
        ...state,
        items: state.items.map((item) =>
          item.temp_id === action.payload.tempId
            ? { ...item, final_price: Math.max(0, action.payload.price) }
            : item
        ),
      };

    case "UPDATE_ITEM_HOURS":
      return {
        ...state,
        items: state.items.map((item) =>
          item.temp_id === action.payload.tempId
            ? { ...item, effort_hours: Math.max(0.5, action.payload.hours) }
            : item
        ),
      };

    case "REORDER_ITEMS":
      return { ...state, items: action.payload };

    case "CLEAR_ITEMS":
      return { ...state, items: [] };

    case "RESET":
      return initialState;

    case "LOAD_STATE":
      return action.payload;

    default:
      return state;
  }
}

// Context
const PackageBuilderContext = createContext<PackageBuilderContextValue | null>(null);

// Provider props
interface PackageBuilderProviderProps {
  children: ReactNode;
  initialEstimate?: Estimate & { items: EstimateItem[] };
}

// Provider component
export function PackageBuilderProvider({ children, initialEstimate }: PackageBuilderProviderProps) {
  const [state, dispatch] = useReducer(packageBuilderReducer, initialState, (initial) => {
    if (initialEstimate) {
      return {
        currentStep: "build" as WizardStep, // When editing, start at build step
        client_name: initialEstimate.client_name || "",
        project_name: initialEstimate.project_name,
        billing_type: initialEstimate.billing_type,
        notes: initialEstimate.notes || "",
        items: initialEstimate.items.map((item) => ({
          temp_id: generateTempId(),
          service_id: item.service_id,
          service_name: item.service_name,
          base_price: item.base_price,
          effort_hours: item.effort_hours,
          quantity: item.quantity,
          final_price: item.final_price,
          requirements_html: item.requirements_html,
          sort_order: item.sort_order,
        })),
      };
    }
    return initial;
  });

  // Step management actions
  const setStep = useCallback((step: WizardStep) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const goNextStep = useCallback(() => {
    dispatch({ type: "GO_NEXT_STEP" });
  }, []);

  const goPrevStep = useCallback(() => {
    dispatch({ type: "GO_PREV_STEP" });
  }, []);

  const canProceedToStep = useCallback((step: WizardStep): boolean => {
    switch (step) {
      case 'create':
        return true; // Can always go back to create
      case 'build':
        // Can proceed to build if project name is filled
        return state.project_name.trim().length > 0;
      case 'requirements':
        // Can proceed to requirements if we have items
        return state.items.length > 0;
      default:
        return false;
    }
  }, [state.project_name, state.items.length]);

  // Actions
  const setClientName = useCallback((name: string) => {
    dispatch({ type: "SET_CLIENT_NAME", payload: name });
  }, []);

  const setProjectName = useCallback((name: string) => {
    dispatch({ type: "SET_PROJECT_NAME", payload: name });
  }, []);

  const setBillingType = useCallback((type: BillingType) => {
    dispatch({ type: "SET_BILLING_TYPE", payload: type });
  }, []);

  const setNotes = useCallback((notes: string) => {
    dispatch({ type: "SET_NOTES", payload: notes });
  }, []);

  const addItem = useCallback((service: Service) => {
    const newItem: PackageItem = {
      temp_id: generateTempId(),
      service_id: service.id,
      service_name: service.name,
      base_price: service.base_price,
      effort_hours: service.effort_hours,
      quantity: 1,
      final_price: service.base_price,
      requirements_html: service.requirements_html,
      sort_order: state.items.length,
    };
    dispatch({ type: "ADD_ITEM", payload: newItem });
  }, [state.items.length]);

  const removeItem = useCallback((tempId: string) => {
    dispatch({ type: "REMOVE_ITEM", payload: tempId });
  }, []);

  const updateItemQuantity = useCallback((tempId: string, quantity: number) => {
    dispatch({ type: "UPDATE_ITEM_QUANTITY", payload: { tempId, quantity } });
  }, []);

  const updateItemPrice = useCallback((tempId: string, price: number) => {
    dispatch({ type: "UPDATE_ITEM_PRICE", payload: { tempId, price } });
  }, []);

  const updateItemHours = useCallback((tempId: string, hours: number) => {
    dispatch({ type: "UPDATE_ITEM_HOURS", payload: { tempId, hours } });
  }, []);

  const reorderItems = useCallback((items: PackageItem[]) => {
    dispatch({ type: "REORDER_ITEMS", payload: items });
  }, []);

  const clearItems = useCallback(() => {
    dispatch({ type: "CLEAR_ITEMS" });
  }, []);

  const resetBuilder = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const loadFromEstimate = useCallback((estimate: Estimate) => {
    const items = (estimate as any).items || [];
    dispatch({
      type: "LOAD_STATE",
      payload: {
        currentStep: "build", // When loading an estimate, go to build step
        client_name: estimate.client_name || "",
        project_name: estimate.project_name,
        billing_type: estimate.billing_type,
        notes: estimate.notes || "",
        items: items.map((item: EstimateItem) => ({
          temp_id: generateTempId(),
          service_id: item.service_id,
          service_name: item.service_name,
          base_price: item.base_price,
          effort_hours: item.effort_hours,
          quantity: item.quantity,
          final_price: item.final_price,
          requirements_html: item.requirements_html,
          sort_order: item.sort_order,
        })),
      },
    });
  }, []);

  const loadFromTemplate = useCallback((template: Estimate) => {
    const items = (template as any).items || [];
    dispatch({
      type: "LOAD_STATE",
      payload: {
        currentStep: "build", // When loading a template, go to build step
        client_name: "",
        project_name: "",
        billing_type: template.billing_type,
        notes: template.notes || "",
        items: items.map((item: EstimateItem) => ({
          temp_id: generateTempId(),
          service_id: item.service_id,
          service_name: item.service_name,
          base_price: item.base_price,
          effort_hours: item.effort_hours,
          quantity: item.quantity,
          final_price: item.final_price,
          requirements_html: item.requirements_html,
          sort_order: item.sort_order,
        })),
      },
    });
  }, []);

  // Computed values
  const totalHours = useMemo(() => {
    return state.items.reduce((sum, item) => sum + item.effort_hours * item.quantity, 0);
  }, [state.items]);

  const totalPrice = useMemo(() => {
    return state.items.reduce((sum, item) => sum + item.final_price * item.quantity, 0);
  }, [state.items]);

  const itemCount = useMemo(() => {
    return state.items.length;
  }, [state.items]);

  // Context value
  const value: PackageBuilderContextValue = useMemo(
    () => ({
      state,
      // Wizard step management
      setStep,
      goNextStep,
      goPrevStep,
      canProceedToStep,
      // Item management
      addItem,
      removeItem,
      updateItemQuantity,
      updateItemPrice,
      updateItemHours,
      reorderItems,
      clearItems,
      // Estimate metadata
      setClientName,
      setProjectName,
      setBillingType,
      setNotes,
      // Computed values
      totalHours,
      totalPrice,
      itemCount,
      // Actions
      resetBuilder,
      loadFromEstimate,
      loadFromTemplate,
    }),
    [
      state,
      setStep,
      goNextStep,
      goPrevStep,
      canProceedToStep,
      addItem,
      removeItem,
      updateItemQuantity,
      updateItemPrice,
      updateItemHours,
      reorderItems,
      clearItems,
      setClientName,
      setProjectName,
      setBillingType,
      setNotes,
      totalHours,
      totalPrice,
      itemCount,
      resetBuilder,
      loadFromEstimate,
      loadFromTemplate,
    ]
  );

  return (
    <PackageBuilderContext.Provider value={value}>
      {children}
    </PackageBuilderContext.Provider>
  );
}

// Hook to use the context
export function usePackageBuilder() {
  const context = useContext(PackageBuilderContext);
  if (!context) {
    throw new Error("usePackageBuilder must be used within a PackageBuilderProvider");
  }
  return context;
}
