interface TerritoryAlertProps {
  attackerName: string;
  zonesLost: number;
  onDefend: () => void;
  onDismiss: () => void;
}

export function TerritoryAlert({ attackerName, zonesLost, onDefend, onDismiss }: TerritoryAlertProps) {
  return (
    <div className="territory-alert-overlay">
      <div className="territory-alert-banner" onClick={onDismiss}>
        <div className="territory-alert-icon-wrap">
          <span className="territory-alert-icon">⚔️</span>
        </div>
        <div className="territory-alert-info">
          <div className="territory-alert-title">Territory Under Attack!</div>
          <div className="territory-alert-sub">{attackerName} captured {zonesLost} of your zones</div>
        </div>
        <span className="territory-alert-chevron">›</span>
      </div>

      <button className="territory-defend-btn" onClick={onDefend}>
        ⚔ DEFEND TERRITORY
      </button>
    </div>
  );
}
