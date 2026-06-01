export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  image_url: string | null;
  sort_order: number;
}

export interface ServiceType {
  id: string;
  category_id: string;
  category_slug: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  image_url: string | null;
  suggested_price: number;
  min_price_ratio: number;
  sort_order: number;
}

export interface ServiceCatalog {
  categories: ServiceCategory[];
  serviceTypes: ServiceType[];
}
