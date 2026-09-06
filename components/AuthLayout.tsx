import type { ReactNode } from 'react';

export default function AuthLayout({ children, mode }: { children: ReactNode; mode: 'login' | 'signup' | 'verify' | 'forgot-password' | 'reset-password' }) {
  return <main className={`accountLayout accountLayout--${mode}`}>
    <section className="accountMain">
      <div className="accountBrand"><span className="accountBrandMark" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5" /></svg></span>Invoice Generator</div>
      <div className="accountFormSlot">{children}</div>
      <p className="accountFooter">Made for your work. Built for your business.</p>
    </section>
    <aside className="accountFeature">
      <div className="accountFeatureInner">
        <span className="accountEyebrow">LESS ADMIN. MORE POSSIBILITY.</span>
        <h2>Your work deserves<br />a beautiful invoice.</h2>
        <p className="accountFeatureCopy">From the first billable hour to the final invoice, keep the details together and make every client interaction feel professional.</p>
        <div className="accountIllustration" aria-hidden="true">
          <div className="accountPaper"><div className="accountPaperTop"><span>INVOICE</span><span>№ 001</span></div><div className="accountPaperLine" /><div className="accountPaperLine short" /><div className="accountPaperTable"><span>Creative work</span><span>24 hrs</span><span>Consultation</span><span>8 hrs</span></div><div className="accountPaperBottom"><span>Ready for your client</span><span>↗</span></div></div>
          <div className="accountFloat"><span>✓</span> Every detail, in place.</div>
        </div>
        <div className="accountBenefits"><span>Live invoice preview</span><span>Saved client details</span><span>Easy PDF sharing</span></div>
      </div>
    </aside>
  </main>;
}
