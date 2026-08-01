type PaymentProps = {
  deposit: number;
  remainingBalance: number;
  notice: string;
  beneficiary: string;
  bank: string;
  swift: string;
  country: string;
  accountNumber: string;
  receivingCurrency: string;
  intermediaryBank: string;
  intermediarySwift: string;
};

export default function Payment({
  deposit,
  remainingBalance,
  notice,
  beneficiary,
  bank,
  swift,
  country,
  accountNumber,
  receivingCurrency,
  intermediaryBank,
  intermediarySwift,
}: PaymentProps) {
  const formatGBP = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);

  const whatsappMessage = encodeURIComponent(
    "Hello, I would like to confirm the New Year's Eve 2027 reservation proposal for Robert Burke."
  );

  return (
    <section className="proposal-section payment-section">
      <div className="proposal-container">
        <div className="payment-heading">
          <div>
            <p className="eyebrow">Reservation & payment</p>

            <h2 className="section-title">
              Secure your stay with a 30% deposit.
            </h2>

            <div className="gold-line" />
          </div>

          <p className="payment-intro">
            The villas will be reserved exclusively for your group once the
            reservation deposit has been received and confirmed in writing.
          </p>
        </div>

        <div className="payment-grid">
          <article className="payment-card payment-card-highlight">
            <p className="payment-card-label">Reservation deposit</p>

            <p className="payment-deposit">
              {formatGBP(deposit)}
            </p>

            <p className="payment-card-copy">
              The reservation is confirmed upon receipt of the 30% deposit.
            </p>

            <div className="payment-card-divider" />

            <div className="payment-balance-row">
              <span>Remaining balance</span>
              <strong>{formatGBP(remainingBalance)}</strong>
            </div>
          </article>

          <article className="payment-card">
            <p className="payment-card-label">Beneficiary details</p>

            <dl className="bank-details">
              <div>
                <dt>Account holder</dt>
                <dd>{beneficiary}</dd>
              </div>

              <div>
                <dt>Bank</dt>
                <dd>{bank}</dd>
              </div>

              <div>
                <dt>Country</dt>
                <dd>{country}</dd>
              </div>

              <div>
                <dt>Account number</dt>
                <dd>{accountNumber}</dd>
              </div>

              <div>
                <dt>SWIFT</dt>
                <dd>{swift}</dd>
              </div>

              <div>
                <dt>Receiving currency</dt>
                <dd>{receivingCurrency}</dd>
              </div>
            </dl>
          </article>

          <article className="payment-card">
            <p className="payment-card-label">Intermediary bank</p>

            <dl className="bank-details">
              <div>
                <dt>Bank</dt>
                <dd>{intermediaryBank}</dd>
              </div>

              <div>
                <dt>SWIFT</dt>
                <dd>{intermediarySwift}</dd>
              </div>
            </dl>

            <div className="payment-card-divider" />

            <p className="payment-currency-note">{notice}</p>
          </article>
        </div>

        <div className="payment-confirmation">
          <div>
            <p className="payment-confirmation-title">
              Ready to confirm your reservation?
            </p>

            <p className="payment-confirmation-copy">
              Once the transfer has been completed, please send us the payment
              confirmation so we can secure the villas and issue your written
              reservation confirmation.
            </p>
          </div>

          <a
            className="payment-confirmation-button"
            href={`https://wa.me/?text=${whatsappMessage}`}
            target="_blank"
            rel="noreferrer"
          >
            Confirm reservation
          </a>
        </div>
      </div>
    </section>
  );
}