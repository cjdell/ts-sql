export interface Product {
  id: number;
  category_id: number;
  name: string;
  description?: string;
  price: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface Schema {
  product: Product;
  category: Category;
}

type SchemaStructure<T> = {
  [P in keyof T]: PropertiesStructure<T[P]>;
};

type PropertiesStructure<T> = {
  [P in keyof Required<T>]: null; // `null` because this value isn't actually used. We only care about keys.
};

/** TypeScript doesn't have reflection, so this is needed for now... */
export const SchemaStructure: SchemaStructure<Schema> = {
  product: {
    id: null,
    category_id: null,
    name: null,
    description: null,
    price: null,
  },
  category: {
    id: null,
    name: null,
  },
};
