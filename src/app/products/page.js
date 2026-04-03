import { Suspense } from 'react';
import Products from '../../../components/Products';

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading products" style={{ width: 200, height: 200, display: "inline-block" }} />
        </div>
      }
    >
      <Products />
    </Suspense>
  );
}



