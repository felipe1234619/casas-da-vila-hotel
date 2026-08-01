type ReservationSummaryProps = {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  villaCount: number;
  totalPerNight: number;
  totalStay: number;
  deposit: number;
  remainingBalance: number;
};

export default function ReservationSummary({
  checkIn,
  checkOut,
  nights,
  guests,
  villaCount,
  totalPerNight,
  totalStay,
  deposit,
  remainingBalance,
}: ReservationSummaryProps) {
  const formatGBP = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <section
      className="proposal-section reservation-section"
      data-analytics-section="pricing"
    >
      <div className="proposal-container">
        <div className="reservation-header">
          <div>
            <p className="eyebrow">Your stay</p>

            <h2 className="section-title">
              New Year&apos;s Eve in Trancoso
            </h2>
          </div>

          <p className="reservation-intro">
            A seven-night private villa arrangement for ten guests,
            prepared exclusively for Robert Burke and his party.
          </p>
        </div>

        <div className="reservation-grid">
          <div className="reservation-details">
            <div className="summary-row">
              <span>Arrival</span>
              <strong>{checkIn}</strong>
            </div>

            <div className="summary-row">
              <span>Departure</span>
              <strong>{checkOut}</strong>
            </div>

            <div className="summary-row">
              <span>Length of stay</span>
              <strong>{nights} nights</strong>
            </div>

            <div className="summary-row">
              <span>Guests</span>
              <strong>{guests}</strong>
            </div>

            <div className="summary-row">
              <span>Private villas</span>
              <strong>{villaCount}</strong>
            </div>

            <div className="summary-row">
              <span>Combined accommodation</span>
              <strong>{formatGBP(totalPerNight)} per night</strong>
            </div>
          </div>

          <aside className="reservation-financial">
            <p className="financial-label">
              Total accommodation
            </p>

            <p className="financial-total">
              {formatGBP(totalStay)}
            </p>

            <p className="financial-caption">
              For {nights} nights across {villaCount} private villas
            </p>

            <div className="financial-divider" />

            <div className="financial-row">
              <span>30% reservation deposit</span>
              <strong>{formatGBP(deposit)}</strong>
            </div>

            <div className="financial-row">
              <span>Remaining balance</span>
              <strong>{formatGBP(remainingBalance)}</strong>
            </div>

            <p className="financial-note">
              The reservation is confirmed upon receipt of the
              reservation deposit.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}