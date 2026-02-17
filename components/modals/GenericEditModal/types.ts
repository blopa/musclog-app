// Base field config
type BaseFieldConfig = {
  key: string;
  label: string; // Can be i18n key or plain string
  required?: boolean;
  hidden?: boolean;
};

// Text field config
export type TextFieldConfig = BaseFieldConfig & {
  type: 'text';
  placeholder?: string;
  multiline?: boolean;
};

// Number field config
export type NumberFieldConfig = BaseFieldConfig & {
  type: 'number';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

// Boolean field config
export type BooleanFieldConfig = BaseFieldConfig & {
  type: 'boolean';
  subtitle?: string;
};

// Select field config
export type SelectFieldConfig = BaseFieldConfig & {
  type: 'select';
  options: {
    value: string | number;
    label: string; // Can be i18n key or plain string
  }[];
};

// Date field config
export type DateFieldConfig = BaseFieldConfig & {
  type: 'date';
};

// Icon field config
export type IconFieldConfig = BaseFieldConfig & {
  type: 'icon';
};

// Discriminated union of all field types
export type EditFieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | BooleanFieldConfig
  | SelectFieldConfig
  | DateFieldConfig
  | IconFieldConfig;

// Form values type
export type EditFormValues = Record<string, string | number | boolean | undefined | null>;

// Props for GenericEditModal
export type GenericEditModalProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  fields: EditFieldConfig[];
  initialValues: EditFormValues;
  onSave: (values: EditFormValues) => Promise<void>;
  isLoading?: boolean;
  loadError?: string;
  submitLabel?: string;
};
