import { Suspense } from 'react';
import OrdersPage from '../../../components/Orders';

export default function Orders() {
  return (
    <Suspense fallback={<div>Loading...</div>}>

      <OrdersPage />
    </Suspense>
  );
}
