export type Product = {
  id: string;
  name: string;
  price: number;
  soluong: number;
  image: string;
};

export type ProductFields = Omit<Product, 'id'>;
