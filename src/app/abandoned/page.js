import { Suspense } from 'react';
import AbandonedClient from '../../../components/Abandoneds';

export default function AbandonedPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
    <AbandonedClient/>
    </Suspense>
  );
}
