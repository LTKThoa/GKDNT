import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';

import type { Product, ProductFields } from './types';

const productsCollection = collection(db, 'products');

export function subscribeToProducts(
  onProducts: (products: Product[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    productsCollection,
    (snapshot) => {
      const products = snapshot.docs.map((productDoc) => ({
        id: productDoc.id,
        ...(productDoc.data() as ProductFields),
      }));
      onProducts(products.sort((a, b) => a.name.localeCompare(b.name, 'vi')));
    },
    (error) => onError(error),
  );
}

export async function getProduct(id: string): Promise<Product | null> {
  const { getDoc } = await import('firebase/firestore');
  const productSnapshot = await getDoc(doc(productsCollection, id));

  if (!productSnapshot.exists()) {
    return null;
  }

  return {
    id: productSnapshot.id,
    ...(productSnapshot.data() as ProductFields),
  };
}

export async function createProduct(fields: ProductFields): Promise<void> {
  await addDoc(productsCollection, fields);
}

export async function updateProduct(id: string, fields: ProductFields): Promise<void> {
  await updateDoc(doc(productsCollection, id), fields);
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(productsCollection, id));
}

export async function deleteProducts(ids: string[]): Promise<void> {
  for (let offset = 0; offset < ids.length; offset += 450) {
    const batch = writeBatch(db);
    ids.slice(offset, offset + 450).forEach((id) => batch.delete(doc(productsCollection, id)));
    await batch.commit();
  }
}
