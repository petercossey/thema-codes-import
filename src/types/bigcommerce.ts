export interface BigCommerceCategory {
  name: string;
  description?: string;
  parent_id?: number;
  tree_id: number;
  is_visible?: boolean;
  url?: {
    path: string;
    is_customized: boolean;
  };
} 