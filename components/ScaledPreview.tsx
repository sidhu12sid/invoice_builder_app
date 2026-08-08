'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import InvoicePreview from './InvoicePreview';
import { Invoice } from '@/lib/invoice';

/**
 * The invoice sheet is a fixed A4 width (210mm ≈ 794px). On a narrower column —
 * which happens easily at 125%/150% Windows display scaling — it would overflow
 * and get clipped, so shrink it to fit.
 *
 * `transform` doesn't affect layout, so the wrapper's height is set explicitly
 * to the scaled height; otherwise the page keeps the unscaled sheet's height.
 */
export default function ScaledPreview({
  data,
  remeasureKey,
}: {
  data: Invoice;
  /** Any value that changes when the surrounding layout does. */
  remeasureKey?: unknown;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  const measure = useCallback(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;

    const available = o.clientWidth;
    const natural = i.offsetWidth; // unaffected by the transform
    if (!available || !natural) return;

    const next = Math.min(1, available / natural);
    setScale(next);
    setHeight(i.offsetHeight * next);
  }, []);

  // ResizeObserver covers most cases, but re-measure explicitly on the things
  // known to change the layout: the sidebar collapsing and the sheet's own
  // content growing. Cheap, and it doesn't depend on RO being delivered.
  useLayoutEffect(measure, [measure, remeasureKey, data]);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;

    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  return (
    <div className="previewFit" ref={outer} style={{ height }}>
      <div
        className="previewFit__inner"
        ref={inner}
        style={{ transform: `scale(${scale})` }}
      >
        <InvoicePreview data={data} />
      </div>
    </div>
  );
}
