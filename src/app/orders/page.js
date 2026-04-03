import { Suspense } from 'react';
import OrdersPage from '../../../components/Orders';

export default function Orders() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading orders" style={{ width: 200, height: 200, display: "inline-block" }} />
        </div>
      }
    >

      <OrdersPage />
    </Suspense>
  );
}



