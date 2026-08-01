import { notFound } from "next/navigation";

import Hero from "@/components/Hero";
import Payment from "@/components/Payment";
import ReservationSummary from "@/components/ReservationSummary";
import SectionTitle from "@/components/SectionTitle";
import VillaCard from "@/components/VillaCard";
import Welcome from "@/components/Welcome";

import { robertBurkeProposal } from "@/data/proposals/robert-burke";

type ProposalPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProposalPage({
  params,
}: ProposalPageProps) {
  const { slug } = await params;

  if (slug !== robertBurkeProposal.slug) {
    notFound();
  }

  const proposal = robertBurkeProposal;

  const totalPerNight = proposal.villas.reduce(
    (total, villa) => total + villa.nightlyRate,
    0
  );

  const totalStay = totalPerNight * proposal.stay.nights;

  const deposit =
    totalStay * (proposal.payment.depositPercentage / 100);

  const remainingBalance = totalStay - deposit;

  return (
    <main
      data-proposal-root
      data-page-type="private-proposal"
      data-proposal-slug={proposal.slug}
      data-guest-name={proposal.guest.name}
      data-stay-title={proposal.stay.title}
      data-stay-period={`${proposal.stay.checkIn} — ${proposal.stay.checkOut}`}
      data-total-value={totalStay}
      data-deposit-value={deposit}
      data-guest-count={proposal.guest.guests}
      data-villa-count={proposal.villas.length}
      data-stay-nights={proposal.stay.nights}
    >
      <Hero
        guestName={proposal.guest.name}
        title={proposal.stay.title}
        checkIn={proposal.stay.checkIn}
        checkOut={proposal.stay.checkOut}
      />

      <Welcome
        guestName={proposal.guest.name}
        guests={proposal.guest.guests}
      />

      <section
        className="proposal-section villas-section"
        data-analytics-section="villas"
      >
        <div className="proposal-container">
          <SectionTitle
            eyebrow="Your private villa collection"
            title="Four residences. One shared experience."
            description="Each guest enjoys the privacy of an independent villa, while the entire group remains together within Casas da Vila Hotel."
          />

          <div className="villas-grid">
            {proposal.villas.map((villa, index) => (
              <VillaCard
                key={villa.name}
                name={villa.name}
                description={villa.description}
                nightlyRate={villa.nightlyRate}
                image={villa.image}
                featured={index === 0}
              />
            ))}
          </div>
        </div>
      </section>

      <ReservationSummary
        checkIn={proposal.stay.checkIn}
        checkOut={proposal.stay.checkOut}
        nights={proposal.stay.nights}
        guests={proposal.guest.guests}
        villaCount={proposal.villas.length}
        totalPerNight={totalPerNight}
        totalStay={totalStay}
        deposit={deposit}
        remainingBalance={remainingBalance}
      />

      <Payment
        deposit={deposit}
        remainingBalance={remainingBalance}
        notice={proposal.payment.notice}
        beneficiary={proposal.payment.beneficiary}
        bank={proposal.payment.bank}
        swift={proposal.payment.swift}
        country={proposal.payment.country}
        accountNumber={proposal.payment.accountNumber}
        receivingCurrency={proposal.payment.receivingCurrency}
        intermediaryBank={proposal.payment.intermediaryBank}
        intermediarySwift={proposal.payment.intermediarySwift}
      />
    </main>
  );
}