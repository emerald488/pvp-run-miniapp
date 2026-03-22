interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  return (
    <div className="onboarding-screen">
      <div className="onboarding-logo">
        <div className="onboarding-hex-grid">
          <span className="onboarding-hex">⬡</span>
          <span className="onboarding-hex">⬡</span>
          <span className="onboarding-hex">⬡</span>
        </div>
      </div>

      <h1 className="onboarding-title">PVP Run</h1>
      <p className="onboarding-subtitle">Run. Capture. Compete.</p>

      <div className="onboarding-cards">
        <div className="onboarding-card">
          <span className="onboarding-card-icon">📍</span>
          <div>
            <div className="onboarding-card-title">Allow GPS Access</div>
            <div className="onboarding-card-desc">Required for tracking your runs</div>
          </div>
        </div>
        <div className="onboarding-card">
          <span className="onboarding-card-icon">🔔</span>
          <div>
            <div className="onboarding-card-title">Enable Notifications</div>
            <div className="onboarding-card-desc">Get alerts when your zones are attacked</div>
          </div>
        </div>
      </div>

      <button className="onboarding-btn" onClick={onComplete}>
        ⚡ LET'S GO!
      </button>
    </div>
  );
}
