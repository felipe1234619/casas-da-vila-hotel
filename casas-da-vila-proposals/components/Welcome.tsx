type WelcomeProps = {
  guestName: string;
  guests: number;
};

export default function Welcome({
  guestName,
  guests,
}: WelcomeProps) {
  return (
    <section id="welcome" className="proposal-section welcome-section">
      <div className="proposal-container welcome-layout">
        <div>
          <p className="eyebrow">A personal welcome</p>

          <h2 className="section-title">
            A New Year’s celebration shaped around your group.
          </h2>
        </div>

        <div className="welcome-copy">
          <p className="welcome-salutation">
            Dear Mr. {guestName.split(" ").slice(-1)[0]},
          </p>

          <p className="body-copy">
            Thank you for considering Casas da Vila Hotel for your New
            Year’s Eve stay in Trancoso.
          </p>

          <p className="body-copy">
            We have carefully prepared this private proposal for your
            group of {guests} guests, combining four individual villas
            within the same property. The arrangement offers the privacy
            of independent residences while allowing your group to enjoy
            the experience together.
          </p>

          <p className="body-copy">
            We would be delighted to welcome you for an unforgettable
            week in one of Brazil’s most distinctive coastal destinations.
          </p>

          <p className="welcome-signature">
            Warm regards,
            <br />
            <strong>Casas da Vila Hotel</strong>
          </p>
        </div>
      </div>
    </section>
  );
}