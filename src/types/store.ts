export type CategorySlug = 'Tees' | 'Hoodies' | 'Bottoms' | 'Outerwear' | 'Accessories';

export type OrderStatus =
  | 'demo_pending'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface ProductColor {
  name: string;
  hex: string;
  images: string[];
}

export interface ProductSizeStock {
  size: string;
  stock: number;
  sku: string;
}

export interface SizeMeasurement {
  widthCm: number;
  lengthCm: number;
  shoulderOrInseamCm: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  collection: string;
  priceBrl: number;
  description: string;
  composition: string;
  careInstructions: string;
  fitNotes: string;
  isNew: boolean;
  isFeatured: boolean;
  isDemo: boolean;
  active: boolean;
  images: string[];
  colors: ProductColor[];
  sizes: ProductSizeStock[];
  measurements: Record<string, SizeMeasurement>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: CategorySlug;
  description: string;
  image: string;
  orderIndex: number;
}

export interface EditorialConfig {
  id: string;
  announcementText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCta: string;
  heroDesktopImage: string;
  heroMobileImage: string;
  brandKicker: string;
  brandTitle: string;
  brandCopy: string;
  campaignTitle: string;
  campaignCopy: string;
  campaignCta: string;
  campaignImage: string;
  storyKicker: string;
  storyTitle: string;
  storyCopy: string;
  storyImage: string;
  storyDetailImage: string;
  contactEmail: string;
  instagramHandle: string;
  shippingNote: string;
  returnsNote: string;
}

export interface CartItem {
  key: string;
  productId: string;
  slug: string;
  name: string;
  priceBrl: number;
  colorName: string;
  colorHex: string;
  size: string;
  sku: string;
  quantity: number;
  maxStock: number;
  image: string;
}

export interface ShippingQuote {
  id: string;
  label: string;
  carrier: string;
  estimatedDays: string;
  priceBrl: number;
}

export interface BrazilianAddress {
  id: string;
  userId?: string;
  label: string;
  recipientName: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault: boolean;
  createdAt?: string;
}

export interface OrderItem {
  productId: string;
  slug: string;
  name: string;
  colorName: string;
  size: string;
  sku: string;
  quantity: number;
  unitPriceBrl: number;
  image: string;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerCpf?: string;
  shippingAddress: Omit<BrazilianAddress, 'id' | 'userId' | 'isDefault' | 'createdAt' | 'label'>;
  shippingMethod: string;
  shippingCostBrl: number;
  paymentMethod: 'pix' | 'cartao';
  couponCode?: string;
  discountBrl: number;
  subtotalBrl: number;
  totalBrl: number;
  status: OrderStatus;
  isDemo: boolean;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CouponRecord {
  code: string;
  discountPercent: number;
  minOrderBrl: number;
  active: boolean;
  usageCount: number;
}

export type UserRole = 'customer' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  cpf?: string;
  phone?: string;
  role?: UserRole;
  authMethods?: string[];
  emailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CatalogFilters {
  category: CategorySlug | 'ALL';
  size: string;
  color: string;
  maxPrice: number | null;
  sort: 'newest' | 'price-asc' | 'price-desc';
  query: string;
}
