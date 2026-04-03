import { Suspense } from 'react';
import AbandonedClient from '../../../components/Abandoneds';

export default function AbandonedPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <lottie-player src="/Loader-cat.json" background="transparent" speed="1" loop autoplay aria-label="Loading abandoned orders" style={{ width: 200, height: 200, display: "inline-block" }} />
        </div>
      }
    >
    <AbandonedClient/>
    </Suspense>
  );
}



