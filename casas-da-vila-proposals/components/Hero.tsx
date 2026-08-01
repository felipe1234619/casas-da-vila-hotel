import Link from "next/link";

type HeroProps = {
  guestName: string;
  title: string;
  checkIn: string;
  checkOut: string;
};

export default function Hero({
  guestName,
  title,
  checkIn,
  checkOut,
}: HeroProps) {
  return (
    <section className="proposal-hero">
      <div className="proposal-hero-overlay" />

      <div className="proposal-hero-topbar">
        <p>Casas da Vila Hotel</p>
        <p>Trancoso · Bahia · Brazil</p>
      </div>

      <div className="proposal-hero-content">
        <p className="hero-kicker">Private accommodation proposal</p>

        <h1 className="hero-title">{title}</h1>

        <div className="hero-divider" />

        <p className="hero-prepared">Prepared exclusively for</p>

        <h2 className="hero-guest">{guestName}</h2>

        <p className="hero-dates">
          {checkIn} <span>—</span> {checkOut}
        </p>

        <Link href="#welcome" className="hero-button">
          Discover your proposal
        </Link>
      </div>

      <a
        href="#welcome"
        className="hero-scroll"
        aria-label="Scroll to proposal"
      >
        <span />
      </a>
    </section>
  );
}